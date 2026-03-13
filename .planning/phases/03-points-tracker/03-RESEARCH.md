# Phase 3: Points Tracker - Research

**Researched:** 2026-03-12
**Domain:** Real-time WebSocket match sync, QR join, Riftbound scoring rules, news scraping
**Confidence:** HIGH (core stack well understood and verified against project patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Board-centric layout: battlefields as large tappable zones in center; player scores at edges
- 2 battlefields in 1v1, 3 battlefields in 2v2 and FFA
- Score shown as simple number format (e.g., "5/8") — no progress bars or dots
- Battlefield zones show actual card art from the card database as background
- Full-screen match mode: hide dashboard bottom nav during active match, small 'Exit' button
- Support portrait and landscape orientations — landscape for table-propped viewing
- Auto-assigned player colors (blue, red, green, yellow) — no player color picking
- Tap battlefield to cycle: Uncontrolled → Player 1 → Player 2 → Contested → Uncontrolled
- Both peers can tap (host and guest share the same interface) — trust-based
- Single undo for accidental taps (5-second window, both players see undo notification)
- App enforces 8th point rule — blocks invalid win, shows warning
- Battlefields are cards from the player's deck; secret selection → simultaneous reveal
- Authenticated users pick from deck's battlefield cards; guests build temp deck
- Track ABCD phases (Awaken, Beginning, Channel, Draw) — phase indicator
- Scoring auto-triggers during Beginning (B) phase: +1 per controlled battlefield
- Conquest scoring (+1) triggers when battlefield control changes via tap
- Track who goes first; remind about first-turn rune draw bonus (Channel: 3 instead of 2)
- Explicit "Next Turn" button to advance to next player's turn
- Optional turn timer: configurable (3/5/10 min), off by default, shows on both screens
- Quick setup wizard: 6 steps (format → mode → names → first player → battlefield → reveal)
- Two modes: "Local Match" (single device) and "Synced Match" (QR join, multi-device)
- Player names: auth users auto-fill from profile display name, guests type their name
- Pause button: either player can pause; "Paused" overlay with pause duration timer
- End match anytime (concession): confirmation dialog, saved to history with "Concession" tag
- Win celebration: full-screen overlay, winner name, final score, animation/confetti
- Collapsible turn-by-turn history log (hidden by default)
- 2v2: team scores + individual names; team total racing to 11; 3 battlefields; team color indicators
- New "Match" (or "Play") bottom nav tab alongside Collection, Decks, Profile
- Match tab landing: "New Match" button + match history list
- Match history only visible for authenticated users (PTS-08)
- QR code encodes a web URL (e.g., lagrieta.gg/match/abc123) — no app download needed
- Manual join code fallback: 6-character code (e.g., "ABC-123") at a URL
- Joiners choose role: Player or Spectator
- Spectator mode: read-only synced view (judges, audiences)
- Unlimited spectators; shareable match URL
- Auto-reconnect on disconnect: "Reconnecting..." banner; 15-second heartbeat for iOS stability
- In FFA/2v2: each player joins individually; host assigns team membership in 2v2
- Guests get full deck editor experience; temp deck in session/local storage; discarded after match
- News displayed on dashboard home page (first thing after login)
- Content scraped from riftbound.gg blog and Riftbound social media (Twitter/X, Discord)
- Card feed layout: vertical list with thumbnail, title, source badge, date, excerpt
- Tap to open full article via external link
- Scraping runs on cron schedule (same @nestjs/schedule pattern as deck-sync)

### Claude's Discretion
- WebSocket vs SSE implementation details for real-time sync
- QR code generation library choice
- Turn timer UI positioning and animation
- Scraping implementation for each news source (RSS, API, DOM scraping)
- News refresh interval (cron frequency)
- Exact celebration animation/confetti implementation
- Landscape layout adaptation details
- Local match single-device UX (how two players share one screen)
- Session storage strategy for guest temp decks
- Match history pagination and data retention period

### Deferred Ideas (OUT OF SCOPE)
- Undo support for last 10 actions (current phase: single undo only)
- Match replay/playback from history
- Tournament integration (Phase 4)
- In-app news reader
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PTS-01 | User can create a 1v1 match session (2 battlefields, first to 8 points) | Match session schema + MatchGateway room pattern |
| PTS-02 | User can create a 2v2 match session (3 battlefields, first to 11 points) | Same session schema with format enum; team concept in match_players |
| PTS-03 | User can create a FFA match session (3-4 players, 3 battlefields, first to 8) | Session schema + FFA role tracking |
| PTS-04 | User can track battlefield control (who controls each battlefield) | MatchEvent pattern; battlefield state in server-authoritative model |
| PTS-05 | System auto-scores +1 on conquest and +1 per controlled battlefield at turn start | Server-side scoring engine, 8th-point rule enforcement |
| PTS-06 | Opponent can join synced session via QR code without an account | `optionalAuthProcedure` for join; nanoid join codes; `react-qr-code` |
| PTS-07 | Both players see real-time score updates on their screens | Socket.IO gateway rooms; full-state sync on reconnect |
| PTS-08 | Authenticated users can view their match history | `match_sessions` + `match_players` tables; protectedProcedure query |
| PLAT-02 | News section displaying Riftbound community updates and announcements | NestJS news module; axios+cheerio scraper; `@nestjs/schedule` cron |
</phase_requirements>

---

## Summary

Phase 3 introduces two fully novel technical domains to La Grieta: real-time bi-directional state sync via WebSockets, and a news aggregation scraper. Both fit cleanly into the existing NestJS module architecture. The rest of the phase — scoring logic, battlefield tracking, match history — are straightforward CRUD extensions of patterns already established in Phases 1 and 2.

**WebSocket choice:** Socket.IO via `@nestjs/websockets` + `@nestjs/platform-socket.io` is the right choice over SSE for this feature. Match state requires client-to-server events (tap battlefield, advance phase, concede) — SSE is server-push only, making it unsuitable. Socket.IO rooms provide natural match isolation: each match gets a room named by session ID, and the server maintains the single source of truth for game state.

**QR join:** The QR code encodes a public URL (`/match/[code]`). The web app generates the QR client-side using `react-qr-code` (zero-cost, no server round-trip, SVG output). Session codes are 6-character nanoid slugs (nanoid is already in `apps/api/package.json` as a dependency). Guest join uses the existing `optionalAuthProcedure` pattern.

**News scraping:** Follows the established `deck-sync` cron pattern exactly. `axios` + `cheerio` for static HTML/RSS parsing; `@nestjs/schedule` cron already in the project. The existing `DeckSyncService` is a direct template.

**Primary recommendation:** Use Socket.IO gateway (rooms per match) for real-time, server-authoritative state. tRPC handles all REST-style operations (create match, fetch history, fetch news). The Gateway sits alongside tRPC in the NestJS app, not as a replacement.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/websockets` | ^10.x | Gateway decorator, lifecycle hooks | Official NestJS WebSocket abstraction |
| `@nestjs/platform-socket.io` | ^10.x | Socket.IO adapter for NestJS | Brings rooms, namespaces, auto-reconnect |
| `socket.io` | ^4.x | WebSocket server (peer dep of platform) | De facto Node.js WebSocket library |
| `socket.io-client` | ^4.x | Client for Next.js web | Works with all browsers including mobile Safari |
| `react-qr-code` | ^2.0.x | SVG QR code generation, client-side | Zero latency, no server cost, maintained |
| `axios` + `cheerio` | already available | News scraping HTML/RSS | Same pattern as existing deck-sync |
| `nanoid` | already in api deps | 6-char session join codes | Already in project, URL-safe, collision-resistant |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `canvas-confetti` | ^1.9.x | Win celebration confetti animation | Client-side only, lightweight, no React dep |
| `@nestjs/schedule` | already in api deps | News cron job | Already in project for deck-sync |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.IO | Native WebSocket (`ws` package) | Socket.IO adds rooms, reconnect, namespaces, fallback — no good reason to avoid it here |
| Socket.IO | SSE | SSE is server-push only; match requires client→server events (tap, advance) — SSE cannot do this |
| react-qr-code | qrcode.js | qrcode.js is heavier; react-qr-code is React-native SVG, zero canvas/DOM issues in Next.js |
| canvas-confetti | framer-motion | framer-motion is heavy (~140KB); canvas-confetti is 7KB and handles the animation well |

**Installation:**
```bash
# API
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io --filter @la-grieta/api

# Web
pnpm add socket.io-client react-qr-code canvas-confetti --filter @la-grieta/web
pnpm add -D @types/canvas-confetti --filter @la-grieta/web
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/modules/match/
├── match.module.ts          # NestJS module wiring
├── match.service.ts         # Business logic (create, join, score, history)
├── match.router.ts          # tRPC procedures (REST-style: create, join, history)
├── match.gateway.ts         # Socket.IO gateway (real-time events)
└── match-scoring.ts         # Pure scoring engine (no I/O, testable)

apps/api/src/modules/news/
├── news.module.ts
├── news.service.ts          # Scraper + cron + DB queries
└── news.router.ts           # tRPC: getLatest

packages/db/src/schema/
├── match-sessions.ts        # match_sessions table
├── match-players.ts         # match_players table (per-player per-session)
└── news-articles.ts         # news_articles table

packages/shared/src/schemas/
├── match.schema.ts          # Zod schemas for all match types
└── news.schema.ts           # Zod schema for news articles

apps/web/src/app/(dashboard)/match/
├── page.tsx                 # Match tab: New Match button + history list
├── [code]/
│   └── page.tsx             # Active match view (full-screen)
└── new/
    └── page.tsx             # Setup wizard
```

### Pattern 1: Socket.IO Gateway with Room Isolation

**What:** Each match session gets its own Socket.IO room named by session code. The server maintains authoritative game state in memory (backed by Redis for horizontal scaling). All state mutations go through the server; clients receive diffs.

**When to use:** Bidirectional real-time sync where multiple clients must stay in lock-step.

**Example:**
```typescript
// apps/api/src/modules/match/match.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'], credentials: true },
  namespace: '/match',
})
export class MatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  async handleConnection(client: Socket) {
    const code = client.handshake.query['code'] as string;
    if (!code) { client.disconnect(); return; }
    await client.join(code); // join the match room
    // Send full state to newly connected client
    const state = await this.matchService.getFullState(code);
    client.emit('state:full', state);
  }

  handleDisconnect(client: Socket) {
    // Socket.IO auto-removes from rooms on disconnect
    this.server.to(/* room */).emit('player:disconnected', { socketId: client.id });
  }

  @SubscribeMessage('battlefield:tap')
  async onBattlefieldTap(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { battlefieldIndex: number; playerId: string },
  ) {
    const code = [...client.rooms].find(r => r !== client.id)!;
    const newState = await this.matchService.applyBattlefieldTap(code, data);
    // Broadcast to ALL in room (including sender)
    this.server.to(code).emit('state:patch', newState);
  }
}
```

### Pattern 2: Server-Authoritative Scoring Engine

**What:** All scoring logic lives in a pure function module on the server. Clients never compute scores — they only send events and receive state patches.

**When to use:** Any match feature where both screens must agree on the score.

**Example:**
```typescript
// apps/api/src/modules/match/match-scoring.ts
// Pure function — no I/O, fully testable

export type BattlefieldControl = 'uncontrolled' | 'player1' | 'player2' | 'contested';
export type MatchFormat = '1v1' | '2v2' | 'ffa';

export interface MatchState {
  format: MatchFormat;
  battlefields: BattlefieldControl[];
  scores: Record<string, number>; // playerId -> score
  currentPlayerId: string;
  phase: 'A' | 'B' | 'C' | 'D';
  winTarget: number; // 8 for 1v1/FFA, 11 for 2v2
}

/** Apply +1 per controlled battlefield at Beginning phase start */
export function scoreBeginningPhase(state: MatchState): MatchState {
  const controlled = state.battlefields.filter(b => b === 'player1' || b === 'player2');
  const delta = controlled.reduce((acc, b) => {
    const pid = b === 'player1' ? getPlayer1Id(state) : getPlayer2Id(state);
    acc[pid] = (acc[pid] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return applyScoreDelta(state, delta);
}

/** Apply +1 conquest point when battlefield changes control */
export function scoreConquest(state: MatchState, bf: number, newController: string): MatchState {
  return applyScoreDelta(state, { [newController]: 1 });
}

/** Enforce 8th point rule: final point must come from holding, or conquer ALL battlefields */
export function validateWinCondition(state: MatchState, candidateWinner: string): boolean {
  const score = state.scores[candidateWinner] ?? 0;
  if (score < state.winTarget - 1) return true; // not a win scenario yet
  const controlled = state.battlefields.filter(b => controllerOf(b) === candidateWinner);
  // Valid win: holds at least one battlefield (standard holding win)
  // OR conquered all battlefields this turn (handled by caller tracking turn conquests)
  return controlled.length > 0;
}
```

### Pattern 3: tRPC + Socket.IO Hybrid

**What:** Use tRPC for REST-style operations (create match, fetch history, get news). Use Socket.IO for real-time streaming. The two systems coexist in the same NestJS app on different ports/paths.

**When to use:** This entire phase — most actions are either REST (setup, history) or real-time events (tap, advance phase).

**REST via tRPC (existing pattern):**
```typescript
// match.router.ts — follows existing deck.router.ts pattern exactly
buildRouter() {
  return this.trpc.router({
    create: this.trpc.optionalAuthProcedure   // guest or auth can create
      .input(matchCreateSchema)
      .mutation(({ ctx, input }) => this.matchService.create(ctx.userId ?? null, input)),

    join: this.trpc.optionalAuthProcedure     // guest join via code
      .input(matchJoinSchema)
      .mutation(({ ctx, input }) => this.matchService.join(ctx.userId ?? null, input)),

    history: this.trpc.rateLimitedProtectedProcedure  // auth required
      .input(matchHistorySchema)
      .query(({ ctx, input }) => this.matchService.history(ctx.userId, input)),
  });
}
```

### Pattern 4: News Scraping Cron (follows deck-sync.service.ts)

**What:** A `@Cron`-decorated method that runs at regular intervals, fetches HTML or RSS from news sources, parses with cheerio, and upserts into `news_articles` table.

**When to use:** PLAT-02 news feed. Same `isSyncing` guard pattern as `DeckSyncService`.

**Example:**
```typescript
// news.service.ts — mirrors deck-sync.service.ts structure
@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private isSyncing = false;

  @Cron('0 */4 * * *') // every 4 hours
  async syncCron(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const articles = await this.scrapeRiftboundGg();
      await this.upsertArticles(articles);
    } finally {
      this.isSyncing = false;
    }
  }

  private async scrapeRiftboundGg(): Promise<NewsArticle[]> {
    const { data } = await axios.get('https://riftbound.gg/blog');
    const $ = cheerio.load(data);
    // Parse blog post cards
    return $('.post-card').map((_, el) => ({
      title: $(el).find('.post-title').text().trim(),
      excerpt: $(el).find('.post-excerpt').text().trim(),
      url: $(el).find('a').attr('href') ?? '',
      publishedAt: new Date($(el).find('time').attr('datetime') ?? ''),
      source: 'riftbound.gg',
      thumbnailUrl: $(el).find('img').attr('src') ?? null,
    })).get();
  }
}
```

### Pattern 5: QR Code + Join URL

**What:** The host's setup flow generates a `nanoid`-based join code and a full URL. The web frontend renders the QR as an SVG using `react-qr-code`. Guest scans with phone camera, opens URL, is shown the join UI without needing an account.

**Join URL shape:** `/match/[code]` — Next.js page handles both active participants and late joiners.

**Example:**
```tsx
// apps/web — QR display component
import QRCode from 'react-qr-code';

function MatchQRCode({ code }: { code: string }) {
  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/match/${code}`;
  return (
    <div>
      <QRCode value={joinUrl} size={200} />
      <p className="lg-text-muted text-center mt-2 font-mono text-lg">{code}</p>
      <p className="lg-text-muted text-center text-sm">or type: lagrieta.gg/match/{code}</p>
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **Client-side scoring:** Never compute scores in the browser. All battlefield tap events go to the server; the server computes the new score and broadcasts the full updated state. Prevents score desync between two phones.
- **Storing full match state only in Socket.IO memory:** Persist match state to Redis (or DB) on every mutation so reconnecting clients and server restarts don't lose state.
- **Using tRPC for real-time events:** tRPC httpLink is request/response only. Do not try to poll tRPC for match state updates — use Socket.IO events.
- **Skipping the 15-second heartbeat:** iOS mobile Safari aggressively closes idle WebSocket connections in the background. Without a ping/pong heartbeat at ~15s, the connection silently dies and the user sees stale scores.
- **Scraping without upsert guards:** Always upsert news articles by URL as unique key to prevent duplicates on each cron run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket rooms | Custom pub/sub in Redis | Socket.IO rooms | Built-in room broadcast, auto-cleanup on disconnect |
| QR code generation | Canvas drawing or SVG path math | `react-qr-code` | Correct QR spec, error correction, no dependencies |
| Short join codes | Custom hash/base62 | `nanoid(8)` (already in project) | Collision-resistant, URL-safe, already available |
| iOS reconnect | Custom polling fallback | Socket.IO auto-reconnect + 15s heartbeat | Socket.IO handles exponential backoff; just configure heartbeat |
| Confetti animation | CSS keyframes | `canvas-confetti` (7KB) | Hardware-accelerated, mobile-compatible, trivial API |
| RSS parsing | XML string splitting | Cheerio (HTML/XML query) | Handles malformed markup, standard jQuery-like selectors |

**Key insight:** The real complexity in this phase is the scoring rules and state machine, not the transport layer. Socket.IO commoditizes the hard WebSocket parts. Focus implementation effort on the Riftbound-specific logic (ABCD phases, 8th point rule, conquest scoring).

---

## Common Pitfalls

### Pitfall 1: iOS Safari WebSocket Disconnects
**What goes wrong:** On iOS, when the user switches apps or locks the screen, the browser suspends the WebSocket connection. After 30-60 seconds, the connection silently closes. The user returns to a match with stale scores and no "reconnecting" indicator.
**Why it happens:** iOS aggressively suspends background processes to save battery; WebSocket connections are not exempt.
**How to avoid:** Configure Socket.IO server with `pingInterval: 15000, pingTimeout: 30000`. On the client, listen for `disconnect` and emit `reconnect` events to re-fetch full state. Display a "Reconnecting..." banner while disconnected.
**Warning signs:** Testing only on desktop; works fine on laptop but fails on iPhone after 1 minute.

### Pitfall 2: CORS on Socket.IO Gateway
**What goes wrong:** The tRPC HTTP server has CORS configured. The Socket.IO gateway runs on a separate path/port and needs its own CORS config. If omitted, mobile browsers block the WebSocket upgrade.
**Why it happens:** `@WebSocketGateway()` does not inherit the NestJS app-level CORS config.
**How to avoid:** Set `cors` option directly in `@WebSocketGateway({ cors: { origin: [...], credentials: true } })`.
**Warning signs:** Socket.IO connection works in Postman but fails in the browser with CORS errors.

### Pitfall 3: Socket.IO Port Conflict
**What goes wrong:** By default, a NestJS Socket.IO gateway tries to open on port 80, which conflicts with the existing Express HTTP server on port 3001.
**Why it happens:** `@WebSocketGateway()` without explicit port uses its own HTTP server unless configured to attach to the existing Express adapter.
**How to avoid:** Use `@WebSocketGateway({ path: '/socket.io' })` without a `port` option. Call `app.useWebSocketAdapter(new IoAdapter(app))` in `main.ts` to share the existing Express HTTP server. This makes Socket.IO accessible at `ws://localhost:3001/socket.io`.
**Warning signs:** App fails to start with "EADDRINUSE" or Socket.IO connects on a random port.

### Pitfall 4: State Desync on Reconnect
**What goes wrong:** Player A disconnects briefly, reconnects. Their client missed 3 state patches. Their score display is now wrong.
**Why it happens:** Socket.IO events are fire-and-forget once a client disconnects — missed events are not replayed.
**How to avoid:** On `connect` (or `reconnect`) event, immediately emit `state:request` and the server responds with `state:full` — the complete current match state. Client replaces local state with the server's version.
**Warning signs:** Only testing with stable connections; score mismatches appear after page refresh.

### Pitfall 5: NestJS Gateway Not Registered in AppModule
**What goes wrong:** Gateway is created but WebSocket connections are refused (404 or connection reset).
**Why it happens:** NestJS DI requires the Gateway to be listed in a module's `providers` array.
**How to avoid:** Add `MatchGateway` to `MatchModule` providers, and import `MatchModule` in `AppModule`.
**Warning signs:** Gateway file exists, but `handleConnection` never fires.

### Pitfall 6: Guest Join Race Condition
**What goes wrong:** Guest opens the join URL before the host has finished setup, resulting in "session not found" error.
**How to avoid:** The `join` endpoint returns a `status` field: `'waiting' | 'ready' | 'in_progress'`. The join page polls (via tRPC query with `refetchInterval`) until `ready`, then establishes the Socket.IO connection.

### Pitfall 7: News Scraper Selector Rot
**What goes wrong:** Riftbound.gg redesigns their blog; CSS selectors break silently; no news appears.
**Why it happens:** DOM scrapers are fragile; HTML changes break `.find('.post-card')` queries.
**How to avoid:** Prefer RSS/Atom feeds if available (machine-readable, stable format). Wrap each scraper in try/catch per source so one broken source doesn't fail the whole cron. Log selector failures clearly.

---

## Code Examples

### DB Schema: match_sessions
```typescript
// packages/db/src/schema/match-sessions.ts
import { pgTable, uuid, varchar, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const matchFormatEnum = pgEnum('match_format', ['1v1', '2v2', 'ffa']);
export const matchStatusEnum = pgEnum('match_status', ['waiting', 'active', 'completed', 'abandoned']);

export const matchSessions = pgTable('match_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 10 }).notNull().unique(), // e.g. "ABC-123"
  format: matchFormatEnum('format').notNull(),
  status: matchStatusEnum('status').notNull().default('waiting'),
  hostUserId: uuid('host_user_id'),          // nullable — host may be guest
  winTarget: integer('win_target').notNull(), // 8 or 11
  state: jsonb('state').notNull(),            // full MatchState JSON
  winnerId: varchar('winner_id', { length: 100 }), // playerId string (not FK — guests have no userId)
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### DB Schema: match_players
```typescript
// packages/db/src/schema/match-players.ts
import { pgTable, uuid, varchar, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { matchSessions } from './match-sessions';

export const playerRoleEnum = pgEnum('player_role', ['player', 'spectator']);

export const matchPlayers = pgTable('match_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => matchSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),          // nullable for guests
  guestName: varchar('guest_name', { length: 100 }),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: playerRoleEnum('role').notNull().default('player'),
  teamId: integer('team_id'),       // 1 or 2 for 2v2; null for 1v1/FFA
  color: varchar('color', { length: 20 }).notNull(), // 'blue' | 'red' | 'green' | 'yellow'
  finalScore: integer('final_score'),
  isWinner: boolean('is_winner').default(false),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});
```

### DB Schema: news_articles
```typescript
// packages/db/src/schema/news-articles.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const newsArticles = pgTable('news_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 500 }).notNull().unique(), // upsert key
  title: varchar('title', { length: 300 }).notNull(),
  excerpt: text('excerpt'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  source: varchar('source', { length: 50 }).notNull(), // 'riftbound.gg' | 'twitter' | 'discord'
  publishedAt: timestamp('published_at'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
});
```

### Socket.IO Client Setup in Next.js
```typescript
// apps/web/src/lib/match-socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getMatchSocket(code: string): Socket {
  if (socket?.connected) return socket;
  socket = io(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}`, {
    path: '/socket.io',
    query: { code },
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });
  return socket;
}

export function disconnectMatchSocket() {
  socket?.disconnect();
  socket = null;
}
```

### NestJS main.ts: Attach IoAdapter
```typescript
// Append to apps/api/src/main.ts bootstrap() — after app.enableCors()
import { IoAdapter } from '@nestjs/platform-socket.io';
app.useWebSocketAdapter(new IoAdapter(app));
// Socket.IO is now accessible at ws://localhost:3001/socket.io
// (same port as the Express HTTP server)
```

### Zod Schemas (match.schema.ts)
```typescript
// packages/shared/src/schemas/match.schema.ts
import { z } from 'zod';

export const matchFormatSchema = z.enum(['1v1', '2v2', 'ffa']);
export const matchModeSchema = z.enum(['local', 'synced']);
export const battlefieldControlSchema = z.enum(['uncontrolled', 'player1', 'player2', 'contested']);
export const matchPhaseSchema = z.enum(['A', 'B', 'C', 'D']);

export const matchCreateSchema = z.object({
  format: matchFormatSchema,
  mode: matchModeSchema,
  playerNames: z.array(z.string().min(1).max(50)).min(1).max(4),
  firstPlayerId: z.string(),
});

export const matchJoinSchema = z.object({
  code: z.string().length(6),
  displayName: z.string().min(1).max(50),
  role: z.enum(['player', 'spectator']).default('player'),
});

export const matchHistorySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const matchStateSchema = z.object({
  format: matchFormatSchema,
  phase: matchPhaseSchema,
  currentPlayerId: z.string(),
  battlefields: z.array(battlefieldControlSchema),
  scores: z.record(z.string(), z.number()),
  turnNumber: z.number().int().min(1),
  winTarget: z.number().int(),
  winnerId: z.string().nullable(),
  isPaused: z.boolean(),
  turnHistory: z.array(z.object({
    turn: z.number(),
    playerId: z.string(),
    events: z.array(z.string()),
  })),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Long-polling for real-time | Socket.IO WebSockets | ~2015+ | Eliminates server load from polling |
| Server-side QR PNG generation | Client-side SVG via react-qr-code | 2022+ | Zero cost, instant, works offline |
| Separate WebSocket port | Attach IoAdapter to existing HTTP server | NestJS 9+ | Single port, simpler infra |
| DOM scraping only | RSS/Atom preferred, DOM as fallback | 2020+ | More stable; less brittle |

**Deprecated/outdated:**
- `socket.io` v2/v3: Use v4 — breaking changes in room APIs.
- `next-qrcode`: Last published 2 years ago; prefer `react-qr-code` (actively maintained).

---

## Open Questions

1. **Does riftbound.gg provide an RSS feed?**
   - What we know: The CONTEXT.md says scrape riftbound.gg blog — DOM scraping is planned.
   - What's unclear: Whether an RSS/Atom endpoint exists (would be far more stable than DOM scraping).
   - Recommendation: Check `riftbound.gg/feed`, `riftbound.gg/rss`, `riftbound.gg/feed.xml` during Wave 0. If found, use `rss-parser` npm package instead of cheerio for that source.

2. **Twitter/X scraping feasibility**
   - What we know: Twitter has aggressively restricted scraping since 2023. The free tier API is extremely limited.
   - What's unclear: Whether the CONTEXT.md's "Twitter/X" source is intended as a Twitter API integration or DOM scraping.
   - Recommendation: Treat Twitter/X as LOW priority for v1. Implement riftbound.gg blog first. If Twitter scraping is required, evaluate `nitter` mirror instances or skip for now. Discord announcements via webhook-to-RSS bridges (like `discordrss.com`) are more reliable.

3. **Redis for match state storage**
   - What we know: Redis is already in the project (ioredis). In-memory socket state is lost on server restart.
   - What's unclear: Whether Railway deployment has Redis always available or only sometimes.
   - Recommendation: Store full `MatchState` JSON in the `match_sessions.state` JSONB column on every mutation. Redis can cache it for speed but the DB is the source of truth. This avoids Redis dependency for correctness.

4. **Socket.IO + Railway/proxy setup**
   - What we know: Railway is the deployment target (see `railway.toml`). Some Railway configurations use HTTPS proxies.
   - What's unclear: Whether Railway's proxy configuration properly handles WebSocket upgrade headers.
   - Recommendation: Test Socket.IO connection through Railway early in implementation (Plan 1). Configure `transports: ['websocket']` on the client — avoid `polling` fallback which is not needed and causes double-connections.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.0 |
| Config file | `apps/api/vitest.config.ts` (already exists) |
| Quick run command | `pnpm --filter @la-grieta/api test -- --reporter=verbose match` |
| Full suite command | `pnpm --filter @la-grieta/api test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PTS-01 | Create 1v1 session, get back code + initial state | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ Wave 0 |
| PTS-02 | Create 2v2 session with team assignments | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ Wave 0 |
| PTS-03 | Create FFA session with 3-4 players | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ Wave 0 |
| PTS-04 | Battlefield tap cycles control state correctly | unit | `pnpm --filter @la-grieta/api test -- match-scoring` | ❌ Wave 0 |
| PTS-05 | Scoring: +1 conquest on tap, +1 per controlled at B phase | unit | `pnpm --filter @la-grieta/api test -- match-scoring` | ❌ Wave 0 |
| PTS-05 | 8th point rule: blocks invalid win, allows valid win | unit | `pnpm --filter @la-grieta/api test -- match-scoring` | ❌ Wave 0 |
| PTS-06 | Guest join with code returns session info without auth | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ Wave 0 |
| PTS-07 | Real-time broadcast (gateway events) | manual | n/a — requires Socket.IO test client setup | manual |
| PTS-08 | Match history returns only auth user's matches | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ Wave 0 |
| PLAT-02 | News scraper upserts articles, no duplicates | unit | `pnpm --filter @la-grieta/api test -- news.service` | ❌ Wave 0 |
| PLAT-02 | getLatest returns articles ordered by publishedAt desc | unit | `pnpm --filter @la-grieta/api test -- news.service` | ❌ Wave 0 |

**Note on PTS-07:** Full Socket.IO gateway testing requires either an integration test with a live Socket.IO client or a mock server. The existing test pattern (mock Drizzle chains) is sufficient for the service layer. Gateway broadcast behavior is verified manually during implementation.

### Sampling Rate
- **Per task commit:** `pnpm --filter @la-grieta/api test -- match`
- **Per wave merge:** `pnpm --filter @la-grieta/api test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/__tests__/match.service.spec.ts` — covers PTS-01 through PTS-06, PTS-08
- [ ] `apps/api/__tests__/match-scoring.spec.ts` — covers PTS-04, PTS-05 (pure function, easiest to test)
- [ ] `apps/api/__tests__/news.service.spec.ts` — covers PLAT-02
- [ ] DB migration file: `packages/db/drizzle/0002_match_and_news.sql`
- [ ] Shared schema exports for match + news in `packages/shared/src/index.ts`

---

## Sources

### Primary (HIGH confidence)
- [NestJS WebSocket Gateways docs](https://docs.nestjs.com/websockets/gateways) — gateway decorator, lifecycle hooks, adapter pattern
- [Socket.IO Server API v4](https://socket.io/docs/v4/server-api/) — rooms, namespaces, emit patterns
- Existing project code: `apps/api/src/modules/deck-sync/deck-sync.service.ts` — cron pattern template
- Existing project code: `apps/api/src/trpc/trpc.service.ts` — `optionalAuthProcedure` for guest access
- Existing project code: `apps/api/package.json` — confirms `nanoid`, `@nestjs/schedule`, `ioredis` already available

### Secondary (MEDIUM confidence)
- [react-qr-code npm](https://www.npmjs.com/package/react-qr-code) — v2.0.18, actively maintained, 337 dependents
- [VideoSDK NestJS WebSocket 2025](https://www.videosdk.live/developer-hub/websocket/nest-js-websocket) — 2025 best practices confirmed
- [Ably: WebSockets and iOS](https://ably.com/topic/websockets-ios) — iOS heartbeat requirement confirmed
- [Web scraping with Axios and Cheerio 2025](https://blog.apify.com/web-scraping-with-axios-and-cheerio/) — confirmed as standard approach

### Tertiary (LOW confidence)
- Twitter/X scraping feasibility — not verified; ecosystem is highly volatile post-2023
- Railway WebSocket proxy behavior — not verified against current Railway docs; test early

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Socket.IO and NestJS WebSocket are the established pattern, verified against official docs and existing project dependencies
- Architecture: HIGH — directly follows existing NestJS module patterns in this codebase (deck-sync, deck.router.ts, optionalAuthProcedure)
- Pitfalls: HIGH — iOS WebSocket issues and CORS on Gateway are well-documented and project-specific risks noted in STATE.md
- Scoring engine: HIGH — pure business logic, no external dependencies
- News scraping stability: MEDIUM — riftbound.gg blog structure unverified; Twitter/X LOW

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 (stable stack; Socket.IO API is very stable)
