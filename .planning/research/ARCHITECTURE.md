# Architecture Research

**Domain:** TCG companion app — new capability modules on top of existing NestJS/tRPC/Next.js monorepo
**Researched:** 2026-03-11
**Confidence:** HIGH (codebase inspected directly; patterns verified against NestJS official docs and search results)

---

## Existing Architecture Baseline

Before documenting the new components, here is what already exists and must not be broken.

```
apps/
  api/                          NestJS + Express + tRPC
    src/
      modules/
        auth/                   JWT + refresh token cookies
        card/                   Card catalog (read-only from seed)
        collection/             Per-user card inventory (CRUD)
        deck/                   Deck builder
        scanner/                NCC fingerprint matcher (in-memory, loads on boot)
        price-sync/             Placeholder price module
        user/                   Profile management
        throttler/              Rate-limit middleware
      trpc/                     tRPC router, context, controller, adapter
      core/                     DB (Drizzle/Postgres) + Redis injection
      config/                   Auth / DB / Redis config
  web/                          Next.js 14 App Router
    (auth)/                     Login, register
    (dashboard)/                Collection, decks, scanner, profile
    cards/                      Public card browser
packages/
  db/                           Drizzle schema + client (shared)
  shared/                       Zod schemas + constants (shared)
  r2/                           Cloudflare R2 client
  tsconfig/                     Base TS config
```

**Key constraints from the existing design:**
- tRPC uses `httpLink` not `httpBatchLink` — batch breaks with the Express adapter
- Scanner module loads ~550 card fingerprints into process memory at startup (ready flag + poll endpoint)
- All DB access through Drizzle ORM — no raw SQL
- Zod schemas live in `packages/shared` and are the single source of truth for types
- Redis is already wired through `CoreModule` — available to any module

---

## System Overview — Full Architecture With New Modules

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Next.js Web │  │ React Native │  │  WhatsApp    │  │  TO Tablet  │  │
│  │  (browser)   │  │  (mobile)    │  │  (user msg)  │  │  (offline)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
└─────────┼─────────────────┼─────────────────┼─────────────────┼──────────┘
          │ tRPC/HTTP        │ tRPC/HTTP        │ Webhook POST    │ tRPC/HTTP
          │                 │                 │                 │ (or offline)
┌─────────▼─────────────────▼─────────────────▼─────────────────▼──────────┐
│  NestJS API  (apps/api)                                                    │
│                                                                            │
│  EXISTING MODULES                        NEW MODULES                       │
│  ┌───────────┐ ┌────────────┐           ┌────────────┐ ┌───────────────┐  │
│  │   auth    │ │  scanner   │           │  points-   │ │  whatsapp     │  │
│  │   card    │ │ collection │           │  tracker   │ │  (webhook +   │  │
│  │   deck    │ │   user     │           │  gateway   │ │  bot handler) │  │
│  └───────────┘ └────────────┘           └─────┬──────┘ └───────┬───────┘  │
│                                               │                │           │
│                                         ┌─────▼──────┐        │           │
│                                         │  WebSocket │        │           │
│                                         │  Gateway   │        │           │
│                                         └─────┬──────┘        │           │
├─────────────────────────────────────────┬─────┘───────────────┘───────────┤
│  INFRASTRUCTURE                         │                                  │
│  ┌──────────────┐  ┌─────────────────┐  │  ┌──────────────────────────┐   │
│  │  PostgreSQL  │  │  Redis          ◄──┘  │  Cloudflare R2           │   │
│  │  (Drizzle)   │  │  (cache +       │     │  (card photos,           │   │
│  │              │  │   pub/sub for   │     │   listing images)        │   │
│  │              │  │   WS rooms)     │     │                          │   │
│  └──────────────┘  └─────────────────┘     └──────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  TOURNAMENT MANAGER  (apps/web — self-contained, offline-capable)          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Next.js page + Zustand store + IndexedDB (via idb-keyval/Dexie)  │    │
│  │  Swiss pairing logic runs client-side (pure TS, no network req)   │    │
│  │  Syncs to API when online (optional persistence)                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### 1. Card Scanner (EXISTING — already shipped)

| Aspect | Detail |
|--------|--------|
| What it owns | NCC fingerprint matching against in-memory card index |
| Lives in | `apps/api/src/modules/scanner/` |
| Communicates with | `collection` module (after match, user adds via `collection.add`) |
| Remaining work | Wantlist/tradelist flags on add; variant/condition selection already in UI |

**Current data flow:**
```
Web (getUserMedia) → canvas crop → base64 JPEG
  → tRPC scanner.identify mutation → ScannerService.identify()
  → NCC against 550 in-memory fingerprints → top-K matches
  → user picks match → tRPC collection.add
```

**Outstanding gap:** The scanner confirms a card but does not surface wantlist or tradelist membership at the moment of match. Adding this is a read join, not a new component.

---

### 2. Points Tracker + QR Pairing (NEW)

This is a real-time feature. Two players on different devices share a game state.

**Architecture decision:** Use NestJS WebSocket gateway with Socket.IO and Redis pub/sub adapter. Redis is already provisioned. A room per match identified by a short random token (the QR payload). No account required for the joining player — the room token is the authentication.

| Aspect | Detail |
|--------|--------|
| Lives in | `apps/api/src/modules/points-tracker/` (new NestJS module) |
| Gateway | `@WebSocketGateway()` using `@nestjs/platform-socket.io` + Redis adapter |
| Room key | 6-character alphanumeric token (e.g. `AB12CD`), TTL 4 hours in Redis |
| Auth | Host: JWT required. Joiner: room token only (no account needed) |
| State storage | Redis hash per room — score state, battlefield control, player names |
| Match history | Written to PostgreSQL on room close (optional, only if host is authenticated) |

**QR pairing flow:**
```
Host opens /tracker → creates room via tRPC → gets token → QR displayed
Opponent scans QR → opens /tracker/join/[token] → WebSocket connect with token
Server validates token → both clients join Socket.IO room [token]
Any score event → emitted to room → both screens update instantly
Room expires after 4 hours or explicit close
```

**New DB schema needed:**
```sql
match_sessions (id, token, host_user_id nullable, mode, state jsonb, created_at, expires_at)
-- state: { scores: {...}, battlefields: {...}, history: [...] }
```

**New files:**
```
apps/api/src/modules/points-tracker/
  points-tracker.module.ts
  points-tracker.gateway.ts     WebSocket gateway (rooms, score events)
  points-tracker.service.ts     Room creation, state mutations, expiry
  points-tracker.router.ts      tRPC: createRoom, getRoom, endMatch

apps/web/src/app/(public)/tracker/
  page.tsx                      Host view — creates room, shows QR
  join/[token]/page.tsx         Joiner view — shows synced state
  components/
    score-board.tsx
    battlefield-tracker.tsx
    qr-display.tsx
```

---

### 3. Tournament Manager (NEW — offline-first)

**Architecture decision:** Run entirely client-side in the browser. The Swiss pairing algorithm is pure TypeScript — no server round-trip needed. State lives in IndexedDB (via Dexie.js) so it survives page refreshes and browser restarts without internet. Optional sync to PostgreSQL when online.

This is the only major feature that does NOT add a new NestJS module as primary owner — it is a client-side application embedded in the Next.js app.

| Aspect | Detail |
|--------|--------|
| Lives in | `apps/web/src/app/(dashboard)/tournament/` |
| State management | Zustand store with IndexedDB persistence (Dexie.js or idb-keyval) |
| Swiss pairing | `tournament-pairings` npm package — pure JS, verified on npm |
| Network dependency | None for core operations; API calls only for player deck list submission |
| Account requirement | Tournament Organizer must be logged in; players submit deck lists via web form |

**Data model (client-side, IndexedDB):**
```typescript
Tournament {
  id: string
  name: string
  format: 'swiss'
  rounds: Round[]
  players: Player[]
  status: 'registration' | 'in_progress' | 'complete'
  createdAt: Date
}

Round {
  number: number
  pairings: Pairing[]
  status: 'pending' | 'in_progress' | 'complete'
}

Pairing {
  id: string
  player1Id: string
  player2Id: string
  result: '1-0' | '0-1' | '0.5-0.5' | null
  tableNumber: number
}
```

**Optional server component** (`apps/api/src/modules/tournament/`):
- Stores finalized tournament results in PostgreSQL
- Provides deck list submission endpoint for players
- Not required for day-of operations

**New files:**
```
apps/web/src/app/(dashboard)/tournament/
  page.tsx                      Tournament list / create
  [id]/page.tsx                 Active tournament view
  [id]/pairings/page.tsx        Current round pairings
  [id]/standings/page.tsx       Standings table
  components/
    player-registration.tsx
    swiss-round.tsx
    standings-table.tsx

packages/shared/src/
  swiss-pairing.ts              Pure TS Swiss logic wrapper (thin wrapper on tournament-pairings)
```

---

### 4. WhatsApp Marketplace Bot (NEW)

**Architecture decision:** Use Meta's WhatsApp Cloud API (official, on-premises API deprecated Oct 2025). Webhook receives inbound messages. A dedicated NestJS module handles message routing (text commands vs. photo messages vs. template responses).

For image processing, do NOT use an external AI vision API. Instead, reuse the existing `ScannerService` — the same NCC fingerprint matching that powers camera scanning also works on photos sent through WhatsApp. The bot downloads the image from Meta's media endpoint, passes it to `ScannerService.identify()`, and responds with matches.

| Aspect | Detail |
|--------|--------|
| Lives in | `apps/api/src/modules/whatsapp/` |
| Inbound | HTTP POST webhook at `/api/whatsapp/webhook` (standard Express controller, NOT tRPC) |
| Verification | `GET /api/whatsapp/webhook` — Meta hub challenge handshake |
| Outbound | Meta Cloud API — `POST https://graph.facebook.com/v19.0/{phone-number-id}/messages` |
| Image scanning | Delegates to `ScannerService.identify()` — no new image processing |
| Notification | Redis pub/sub — when a listing matches a user's wantlist, trigger WhatsApp message |
| Secret storage | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` in env |

**Why a plain Express controller, not tRPC:** Meta sends webhooks as standard HTTP POST requests. tRPC procedures expect tRPC-formatted request bodies. The webhook controller lives alongside tRPC but handles raw request/response directly.

**Message routing:**
```
Inbound webhook
  ↓
WhatsAppController.handleWebhook()
  ↓
MessageRouterService.route(message)
  ├─ type === 'text'  → CommandHandler (search, price, help, list)
  ├─ type === 'image' → ImageHandler → ScannerService.identify() → reply with matches
  └─ type === 'interactive' → InteractionHandler (button clicks, list selections)
```

**Notification trigger flow:**
```
ListingService.create() → publishes to Redis channel 'listing:created'
WhatsApp NotificationWorker subscribes → queries wantlists for card match
  → sends WhatsApp message to matched users via Cloud API
```

**New files:**
```
apps/api/src/modules/whatsapp/
  whatsapp.module.ts
  whatsapp.controller.ts        Express controller for webhook
  whatsapp.service.ts           Outbound message sending (Cloud API)
  message-router.service.ts     Route incoming messages by type
  handlers/
    command.handler.ts          Text commands: /search, /list, /help
    image.handler.ts            Photo → ScannerService → reply
    interaction.handler.ts      Button/list responses
  notification.worker.ts        Redis subscriber → push notifications

packages/db/src/schema/
  whatsapp-users.ts             phone_number → user_id mapping, opt-in status
```

---

### 5. Collection Wantlist / Tradelist (ENHANCEMENT to existing module)

This is not a new module — it extends the existing `collection` module and DB schema.

| Aspect | Detail |
|--------|--------|
| Lives in | `apps/api/src/modules/collection/` (extend existing) |
| DB change | Add `list_type` enum column to `collections` table: `'owned' | 'wanted' | 'trading'` |
| Cross-matching | New service method: find users where `wanted` card matches another user's `trading` card |
| Notification trigger | Cross-match found → notify via WhatsApp or in-app (WhatsApp module does the sending) |

**DB migration:**
```sql
ALTER TYPE collection_list_type ADD VALUE IF NOT EXISTS 'wanted';
ALTER TYPE collection_list_type ADD VALUE IF NOT EXISTS 'trading';
ALTER TABLE collections ADD COLUMN list_type collection_list_type NOT NULL DEFAULT 'owned';
```

---

## Recommended Project Structure (additions only)

```
apps/api/src/modules/
  points-tracker/               WebSocket gateway + room management
    points-tracker.module.ts
    points-tracker.gateway.ts   @WebSocketGateway decorator
    points-tracker.service.ts   Room CRUD, Redis state
    points-tracker.router.ts    tRPC: createRoom, getRoom
  tournament/                   Optional server-side tournament persistence
    tournament.module.ts
    tournament.router.ts
    tournament.service.ts
  whatsapp/                     Webhook receiver + bot logic
    whatsapp.module.ts
    whatsapp.controller.ts      Plain NestJS controller (not tRPC)
    whatsapp.service.ts
    message-router.service.ts
    notification.worker.ts
    handlers/
      command.handler.ts
      image.handler.ts
      interaction.handler.ts

apps/web/src/app/
  (public)/
    tracker/                    Points tracker (host — no login required)
      page.tsx
      join/[token]/page.tsx
  (dashboard)/
    tournament/                 Tournament manager
      page.tsx
      [id]/page.tsx
      [id]/pairings/page.tsx
      [id]/standings/page.tsx
    collection/                 Extend with wantlist/tradelist tabs
      wantlist/page.tsx
      tradelist/page.tsx

packages/db/src/schema/
  match-sessions.ts             Points tracker rooms
  tournament-results.ts         Optional tournament persistence
  whatsapp-users.ts             Phone → user mapping
```

---

## Architectural Patterns

### Pattern 1: NestJS WebSocket Gateway with Redis Pub/Sub

**What:** A NestJS `@WebSocketGateway()` class that uses `@nestjs/platform-socket.io` with a Redis adapter (`socket.io-redis`). Each match room is a Socket.IO room keyed by the short token. Redis pub/sub ensures events reach all connected clients even if the API is scaled horizontally later.

**When to use:** Any feature requiring bidirectional real-time sync between two or more clients (Points Tracker). Do not use for the WhatsApp bot — that is request/response, not persistent connection.

**Trade-offs:** Adds Socket.IO to the bundle. Redis is already available so the adapter cost is low. The Points Tracker has simple state (a handful of integers) — no need for CRDT or operational transform complexity.

```typescript
// points-tracker.gateway.ts sketch
@WebSocketGateway({ namespace: '/tracker', cors: true })
export class PointsTrackerGateway {
  @SubscribeMessage('score:update')
  async handleScoreUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ScoreUpdateDto,
  ) {
    const room = client.data.roomToken as string;
    const newState = await this.service.applyScoreUpdate(room, data);
    // Broadcast to room (includes sender for optimistic UI reconciliation)
    this.server.to(room).emit('state:sync', newState);
  }
}
```

---

### Pattern 2: Client-Side Swiss Pairings with IndexedDB Persistence

**What:** All tournament logic runs in the browser. Zustand manages in-memory state. Dexie.js persists to IndexedDB on every state mutation. The `tournament-pairings` npm package generates Swiss rounds via a blossom matching algorithm. No network required from tournament creation through result entry.

**When to use:** Any workflow that must function on tournament day when venue WiFi fails. The pattern is intentional degradation: all writes go to IndexedDB first, API sync is fire-and-forget when online.

**Trade-offs:** State lives in the browser, not the server — meaning a different device cannot see the same tournament without server sync. For tournament organizers running from a single device (the typical case), this is fine.

```typescript
// swiss-pairing.ts wrapper
import { swiss } from 'tournament-pairings';

export function generateRound(players: Player[], completedRounds: Round[]): Pairing[] {
  const standings = computeStandings(players, completedRounds);
  return swiss(standings, completedRounds.length + 1);
}
```

---

### Pattern 3: Webhook Controller Alongside tRPC

**What:** A plain NestJS `@Controller()` for external webhooks (WhatsApp) that lives outside the tRPC namespace. The global prefix `/api` applies to both. tRPC handles `/api/trpc/*`. WhatsApp webhook handles `/api/whatsapp/*`.

**When to use:** Any external service that pushes events via standard HTTP (Meta, Stripe, etc.). These callers do not speak tRPC.

**Trade-offs:** Two routing paradigms in one server. Keep them clearly separated by module. Webhook controllers must validate request signatures (X-Hub-Signature-256 for Meta) before processing — do not skip this.

```typescript
@Controller('whatsapp')
export class WhatsAppController {
  @Get('webhook')
  verifyWebhook(@Query() query: WebhookVerifyQuery, @Res() res: Response) {
    if (query['hub.verify_token'] === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.send(query['hub.challenge']);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  @Post('webhook')
  @HttpCode(200) // Meta requires 200 ack within 20s or retries
  async handleWebhook(@Body() body: WhatsAppWebhookBody) {
    await this.messageRouter.route(body);
  }
}
```

---

### Pattern 4: ScannerService Reuse for WhatsApp Image Processing

**What:** The WhatsApp image handler downloads the media URL from Meta's CDN, converts it to a Buffer, and calls `ScannerService.identify()` directly. No new image recognition infrastructure needed.

**When to use:** Wherever card identification from photo is needed — web scanner and WhatsApp bot share the same underlying service.

**Trade-offs:** `ScannerService` is a singleton that holds ~550 fingerprints in memory. A single NestJS process can serve both the web scanner and WhatsApp bot efficiently. If request volume grows significantly, fingerprints could be precomputed and stored in Redis to share across multiple processes.

---

## Data Flow

### Points Tracker — Score Update Flow

```
Player action (tap score +1)
  ↓
Web client emits: socket.emit('score:update', { room, player, delta, battlefield })
  ↓
PointsTrackerGateway.handleScoreUpdate()
  ↓
PointsTrackerService.applyScoreUpdate()
  → loads state from Redis hash
  → validates move (within game rules)
  → writes new state back to Redis
  → checks win condition
  ↓
server.to(room).emit('state:sync', newState)
  ↓
Both clients receive and re-render score display
```

### WhatsApp Listing Notification Flow

```
User creates marketplace listing (tRPC listing.create)
  ↓
ListingService.create() → inserts row → publishes to Redis 'listing:created'
  ↓
WhatsApp NotificationWorker (Redis subscriber, runs in same process)
  → queries collections where list_type='wanted' AND card_id=listing.card_id
  → for each wantlisting user: fetch their whatsapp_users record
  → send WhatsApp message via Cloud API: "A card on your wantlist is now available"
```

### Tournament — Offline Pairing Flow

```
TO enters round results in browser
  ↓
Zustand action → compute new standings
  ↓
swiss(standings, roundNumber) → new pairings
  ↓
Dexie.js persists updated Tournament object to IndexedDB
  ↓
React re-renders pairings table
  ↓
(when online) fire-and-forget: tRPC tournament.syncRound() → PostgreSQL
```

---

## Build Order (Phase Dependencies)

The following ordering reflects which components unblock which others.

```
Phase 1: Collection Tracker Extensions (wantlist/tradelist)
  Reason: WhatsApp cross-matching and marketplace depend on knowing what users want
  Outputs: list_type column, wantlist/tradelist UI, cross-match query

Phase 2: Deck Builder Enhancements
  Reason: No dependencies from new modules — standalone improvement
  Outputs: validation, share codes, sample hand simulator

Phase 3: Points Tracker + QR Pairing
  Reason: Standalone feature, high user value for community play
  Outputs: WebSocket gateway, Redis room state, QR pairing flow
  Prereq: Redis adapter installed, match_sessions table added

Phase 4: Tournament Manager
  Reason: Offline-first client work, no backend dependencies for core functionality
  Outputs: IndexedDB persistence, Swiss pairing, TO workflow
  Prereq: None for offline mode; Phase 1 collection data useful for deck submission

Phase 5: WhatsApp Bot (Marketplace + Notifications)
  Reason: Requires Phase 1 wantlist/tradelist to send meaningful notifications
  Requires: Meta Business Account, phone number, WhatsApp Cloud API access
  Outputs: Webhook controller, command handler, image scan via ScannerService, notifications
  Prereq: Phase 1 complete; ScannerService already exists
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| WhatsApp Cloud API | Outbound REST (POST to graph.facebook.com) | Requires approved Meta Business Account; webhook must be HTTPS |
| Meta Media CDN | Download image for WhatsApp bot scanning | Use AbortSignal timeout same as ScannerService.downloadImage() |
| Cloudflare R2 | Presigned URL upload for collection photos | Pattern already established in packages/r2 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| WhatsApp module ↔ Scanner module | Direct service injection (NestJS DI) | ScannerService must be exported from ScannerModule |
| WhatsApp module ↔ Collection module | Direct service injection | Read wantlist entries for notification targeting |
| Listing creation ↔ Notification worker | Redis pub/sub (same process) | Use `ioredis` subscriber pattern; keep in same module |
| Points Tracker gateway ↔ Redis | socket.io-redis adapter | Enables multi-instance deployment later; low cost now |
| Tournament (client) ↔ API | Optional tRPC sync calls | Fire-and-forget; always write to IndexedDB first |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing WebSocket Room State Only in Process Memory

**What people do:** Keep match scores in a `Map<token, GameState>` inside the NestJS gateway.
**Why it's wrong:** A server restart loses all active matches. Horizontal scaling breaks because two instances do not share maps.
**Do this instead:** Write all room state to Redis hashes with a TTL. The gateway reads from Redis on every event and writes back atomically.

---

### Anti-Pattern 2: Running Swiss Pairing on the Server per Request

**What people do:** POST player results to the API, server runs pairings, returns next round.
**Why it's wrong:** Tournament day internet outage kills operations. Any latency feels bad during live events.
**Do this instead:** All pairing logic runs client-side. Server only stores final results for archival. Client is the source of truth during live play.

---

### Anti-Pattern 3: Building a Custom Image Recognition Service for WhatsApp

**What people do:** Integrate OpenAI Vision or Clarifai to identify card photos sent by WhatsApp users.
**Why it's wrong:** Unnecessary cost, latency, and external dependency. The existing NCC fingerprint matcher already handles ~550-card catalog with acceptable accuracy.
**Do this instead:** Delegate to `ScannerService.identify()` which is already battle-tested from the web scanner feature.

---

### Anti-Pattern 4: Exposing the WhatsApp Webhook via tRPC

**What people do:** Create a tRPC procedure for the webhook endpoint because "everything is tRPC."
**Why it's wrong:** Meta sends raw HTTP POST with its own JSON schema. tRPC procedures expect tRPC enveloped requests. The webhook would fail verification.
**Do this instead:** Create a plain `@Controller('whatsapp')` in the WhatsApp module alongside the existing tRPC controller. Both sit under the `/api` global prefix.

---

### Anti-Pattern 5: Blocking the WhatsApp 200 ACK on Processing

**What people do:** `await messageRouter.route(body)` before sending the HTTP 200 response.
**Why it's wrong:** Meta requires a 200 acknowledgement within 20 seconds or retries the webhook. Card scanning + DB queries could exceed this.
**Do this instead:** Respond 200 immediately, then process the message asynchronously. Use a NestJS `EventEmitter` or a simple queue (Bull/BullMQ with Redis) to handle processing in background.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single NestJS process, all modules in one app — current approach is fine |
| 1k-10k users | Redis adapter for WebSocket already in place; scanner fingerprints could move to Redis if memory pressure grows |
| 10k+ users | Split WhatsApp bot into separate worker process (webhook stays, processing queue grows); scanner fingerprints precomputed and stored to avoid per-instance download |

**First bottleneck:** ScannerService loads ~550 card images from external CDN at startup. On cold start this takes 30-60 seconds. Multiple instances each run this load independently. If horizontal scaling is needed, precompute fingerprints to PostgreSQL `bytea` or Redis, and load from there instead of CDN.

**Second bottleneck:** WhatsApp notification volume on popular listings. A single Redis subscriber handles this at current scale. If needed, add BullMQ to process notifications as jobs rather than synchronously in the subscriber callback.

---

## Sources

- NestJS official docs — WebSocket Gateways: https://docs.nestjs.com/websockets/gateways
- NestJS official docs — WebSocket Adapters: https://docs.nestjs.com/websockets/adapter
- LogRocket — Scalable WebSockets with NestJS and Redis: https://blog.logrocket.com/scalable-websockets-with-nestjs-and-redis/
- Meta WhatsApp Cloud API docs — Image Messages: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/image-messages/
- Firefox QR Pairing Architecture: https://mozilla.github.io/ecosystem-platform/explanation/pairing-flow-architecture
- tournament-pairings npm package: https://www.npmjs.com/package/tournament-pairings
- LogRocket — Offline-first frontend apps 2025: https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/
- NestJS sample Redis IO adapter: https://github.com/nestjs/nest/blob/master/sample/02-gateways/src/adapters/redis-io.adapter.ts
- WhatsApp Cloud API integration guide (2026): https://medium.com/@aktyagihp/whatsapp-cloud-api-integration-in-2026-0493dd05d644
- Existing codebase — inspected directly (apps/api, apps/web, packages/db, packages/shared)

---
*Architecture research for: La Grieta TCG companion app — new capability modules*
*Researched: 2026-03-11*
