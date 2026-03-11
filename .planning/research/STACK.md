# Stack Research

**Domain:** TCG Companion App — Collection Tracker, Points Tracker, Tournament Manager, Deck Builder Enhancements, WhatsApp Marketplace
**Researched:** 2026-03-11
**Confidence:** MEDIUM (most decisions verified via official docs + npm; some version constraints inferred from existing package.json)

---

## Existing Stack (Do Not Re-research)

| Layer | Technology | Version |
|-------|------------|---------|
| API | NestJS + tRPC | @nestjs ^10, @trpc/server ^11 |
| Web | Next.js | ^14.2.0 |
| ORM | Drizzle | ^0.38.0 |
| DB | PostgreSQL | (Docker) |
| Cache | Redis via ioredis | ^5.4.0 |
| Storage | Cloudflare R2 | (S3-compatible) |
| Image processing | sharp | ^0.33.0 (already installed in api) |
| OCR | tesseract.js | ^7.0.0 (already installed in web) |

---

## New Capability Stack

### 1. Camera-Based Card Scanning (Web, getUserMedia)

**Approach:** The 550-card catalog is small enough for perceptual hashing rather than ML inference. Pre-compute a pHash fingerprint for every card image at seed time, store in PostgreSQL. On scan, capture a video frame via Canvas API, compute the hash client-side with blockhash-js, then match against stored hashes via Hamming distance over HTTP.

Tesseract.js is already installed in `apps/web` and handles OCR for card name text as a secondary confirmation signal.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `getUserMedia` + Canvas API | Browser native | Capture video frames from camera | No library needed; supported in all modern browsers including mobile Safari 14.5+; HTTPS required (already configured in dev script) |
| `blockhash-js` | ^0.0.3 | Client-side perceptual hashing in browser | Runs in browser without Node.js (sharp-phash is server-only); works on canvas ImageData directly; no WASM dependency; 550 cards is well within its performance envelope |
| `sharp-phash` | ^2.0.0 | Server-side pHash pre-computation at seed time | Already have sharp ^0.33.0; used once at seed to build the hash index, not on hot path |
| `tesseract.js` | ^7.0.0 | OCR fallback: read card name text if visual hash confidence is low | Already installed; use as secondary signal, not primary |

**What NOT to use:**

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TensorFlow.js / ONNX ML model | 550 cards is too small for ML inference to be worth the 30-50MB model bundle overhead | Perceptual hashing (blockhash-js) + Hamming distance |
| AWS Rekognition / Google Vision API | External API dependency adds latency, cost, and a third-party account requirement | Local hash matching |
| sharp-phash in the browser | sharp is a Node.js-only native module; it cannot run client-side | blockhash-js for browser, sharp-phash for server seed script |

---

### 2. Real-Time QR Sync (Points Tracker)

**Approach:** Generate a short session ID (nanoid) server-side. Encode it into a QR code rendered on screen. When an opponent scans, both clients join the same Socket.IO room keyed on that session ID. Game state is authoritative on the server (Redis hash), broadcast to both clients on every mutation. No account required for the joining player.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@nestjs/platform-socket.io` | ^10.x (matches NestJS 10) | NestJS WebSocket gateway | Native NestJS integration; @nestjs/websockets decorators; already in the established NestJS 10 ecosystem |
| `socket.io` | ^4.x (peer dep of platform-socket.io) | WebSocket transport with fallback | Automatic reconnection, rooms, namespaces; fallback to long-polling on restrictive networks (common in Honduran venues) |
| `@socket.io/redis-adapter` | ^8.3.0 | Broadcast across multiple API instances | Redis is already in the stack; adapter is the NestJS-recommended approach for multi-instance scaling; v8.3.0 is current |
| `qrcode` | ^1.5.4 | Server-side QR code generation as PNG/SVG | Simple, well-maintained, no external dependency; generate QR on API, return as data URL |
| `nanoid` | ^5.0.0 | Collision-resistant short session IDs | URL-safe, small, fast; 21-char default makes brute-forcing session IDs impractical |

**tRPC note:** The existing tRPC setup uses httpLink (not batch). WebSocket game state should bypass tRPC entirely — use raw Socket.IO events for the real-time channel. tRPC subscriptions exist but add complexity without benefit here since the client-side is Next.js (not React Native yet).

**What NOT to use:**

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| tRPC subscriptions for game state | tRPC WS subscriptions require a separate WebSocket server config and conflict with the established httpLink setup | Raw Socket.IO rooms |
| Server-Sent Events (SSE) | One-directional; can't handle opponent score updates flowing back | Socket.IO (bidirectional) |
| Pusher / Ably | Third-party dependency, cost at scale, unnecessary when NestJS + Redis is already in stack | @nestjs/platform-socket.io + Redis adapter |

---

### 3. Offline-First Tournament Manager

**Approach:** Tournament state lives in IndexedDB on the Tournament Organizer's device (browser or future React Native). Swiss pairings are computed locally via `tournament-pairings`. When connectivity returns, sync to PostgreSQL via a background queue. No cloud dependency on event day.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `dexie` | ^4.0.x | IndexedDB wrapper for offline-first storage | Version 4 is current and stable; React hooks via `dexie-react-hooks`; live queries re-render components on DB change; simpler API than raw IndexedDB; proven in PWA contexts |
| `dexie-react-hooks` | ^4.2.0 | `useLiveQuery` hook for reactive DB reads in Next.js | Eliminates manual state management; tournament bracket auto-updates on pairing insert |
| `tournament-pairings` | ^2.0.1 | Swiss pairing generation via blossom algorithm | Latest version (Oct 2025); pure JavaScript ESM; supports Swiss, single/double elimination, round robin; weighted blossom gives correct pairings per standard rules; no server required |
| Workbox (via `next-pwa`) | ^5.6.0 | Service worker for PWA offline shell | Makes the tournament page installable and functional without network; cache API responses for the static card data |

**Sync strategy:** When online, use a background `sync` event (Workbox Background Sync) to POST pending tournament mutations to the NestJS API. The API writes to PostgreSQL. Conflict resolution: last-write-wins is acceptable since only one TO manages a given tournament.

**What NOT to use:**

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| localStorage for tournament state | 5MB limit; no indexing; synchronous blocking writes | Dexie + IndexedDB |
| PouchDB / CouchDB sync | Adds CouchDB infra dependency; overkill for single-TO use case | Dexie + custom NestJS sync endpoint |
| `tournament-organizer` npm package | Less maintained than `tournament-pairings`; does more than needed (full tournament lifecycle management in one opinionated object) | `tournament-pairings` (pure pairing functions, composable) |

---

### 4. WhatsApp Marketplace Bot

**Approach:** Use the official Meta WhatsApp Cloud API directly via HTTP (no SDK, see below). NestJS handles the webhook endpoint, processes incoming messages, and dispatches replies. Store conversation state in Redis (short TTL for multi-turn flows like "sending a photo to list a card"). Do not use Baileys.

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Meta WhatsApp Cloud API | v20.0 (current stable) | Send/receive messages, handle media uploads | Official API with SLA; free for first 1000 conversations/month; per-message pricing since July 2025; Honduras-focused business scale stays within free tier early on |
| `@great-detail/whatsapp-js-sdk` | ^8.x | TypeScript wrapper for Cloud API v23 | The official Meta Node.js SDK is **archived** (read-only since 2023); this fork is actively maintained (1,380 commits), supports Node 22/24, ESM + CJS, full TypeScript types, covers webhooks, media, templates |
| NestJS webhook controller | — (existing infra) | Receive and verify Meta webhook challenges + message events | Standard HMAC-SHA256 signature verification on every incoming webhook; queue heavy operations (image processing, DB writes) to avoid 30s timeout |
| Redis (ioredis, already installed) | ^5.4.0 | Conversation state machine per phone number | TTL-keyed hashes track multi-step flows (e.g., "awaiting card photo"); avoids DB writes for ephemeral flow state |

**Baileys warning — do not use:**

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Baileys / WhiskeySockets | Unofficial reverse-engineered protocol; WhatsApp can break it without notice; violates ToS; phone number ban risk for a production business app | Meta Cloud API + @great-detail/whatsapp-js-sdk |
| Evolution API | Same unofficial protocol risk as Baileys; adds self-hosted infrastructure | Meta Cloud API |
| Official `whatsapp` npm package (Meta SDK) | **Archived June 2023**, no longer maintained, pinned to Cloud API v16 | @great-detail/whatsapp-js-sdk |

**Registration prerequisite:** Requires a Meta Business Account, a verified business phone number, and a Facebook App with WhatsApp product enabled. This is a real prerequisite — cannot be mocked in development. Use Meta's test number for local dev.

---

## Deck Builder Enhancements

No new libraries needed. All enhancements (validation, curve analytics, share codes, hand simulator) are pure logic that belongs in `@la-grieta/shared` as Zod schemas + utility functions. Share codes use nanoid (already recommended above) + base62 encoding of deck state.

---

## Supporting Libraries Summary

| Library | Install In | Version | Purpose |
|---------|-----------|---------|---------|
| `blockhash-js` | `apps/web` | ^0.0.3 | Client-side perceptual hashing for camera scan |
| `sharp-phash` | `apps/api` | ^2.0.0 | Server-side hash generation at card seed time |
| `@nestjs/platform-socket.io` | `apps/api` | ^10.x | WebSocket gateway for Points Tracker |
| `@socket.io/redis-adapter` | `apps/api` | ^8.3.0 | Multi-instance WebSocket broadcast |
| `qrcode` | `apps/api` | ^1.5.4 | QR code generation (returns data URL) |
| `nanoid` | `apps/api` + `packages/shared` | ^5.0.0 | Session IDs, share codes |
| `dexie` | `apps/web` | ^4.0.x | IndexedDB for offline tournament state |
| `dexie-react-hooks` | `apps/web` | ^4.2.0 | Reactive DB queries in React components |
| `tournament-pairings` | `apps/web` + `packages/shared` | ^2.0.1 | Swiss pairings algorithm |
| `next-pwa` | `apps/web` | ^5.6.0 | Service worker + offline shell for tournament page |
| `@great-detail/whatsapp-js-sdk` | `apps/api` | ^8.x | WhatsApp Cloud API TypeScript client |

---

## Installation

```bash
# apps/web — card scanning
pnpm --filter @la-grieta/web add blockhash-js

# apps/api — card scan hash pre-computation
pnpm --filter @la-grieta/api add sharp-phash

# apps/api — Points Tracker real-time
pnpm --filter @la-grieta/api add @nestjs/platform-socket.io @socket.io/redis-adapter qrcode
pnpm --filter @la-grieta/api add -D @types/qrcode

# apps/web + packages/shared — nanoid (already in ecosystem, verify)
pnpm --filter @la-grieta/api add nanoid
pnpm --filter @la-grieta/web add nanoid

# apps/web — offline tournament
pnpm --filter @la-grieta/web add dexie dexie-react-hooks tournament-pairings next-pwa

# apps/api — WhatsApp Marketplace
pnpm --filter @la-grieta/api add @great-detail/whatsapp-js-sdk
```

---

## Version Compatibility Notes

| Constraint | Details |
|------------|---------|
| NestJS 10 + socket.io 4 | `@nestjs/platform-socket.io@10.x` ships socket.io 4 as a peer dep; do not install socket.io separately |
| sharp ^0.33 + sharp-phash ^2 | sharp-phash v2 requires sharp ^0.33 — already satisfied by existing install |
| Next.js 14 + next-pwa | Use `next-pwa@5.6.0` (the community-maintained fork); the original `next-pwa` is abandoned; verify `next.config.js` wrapping pattern |
| @great-detail/whatsapp-js-sdk + Node 22 | Tested on Node v22 LTS; confirm Node version in Dockerfile matches (currently Alpine with Node — verify) |
| tournament-pairings 2.0.1 | Pure ESM module — Next.js 14 handles ESM fine but ensure `transpilePackages` is NOT needed (Next.js 14.2+ handles ESM automatically) |
| Dexie 4 | Requires IndexedDB API — not available in Node.js SSR. Wrap all Dexie imports in `'use client'` components or dynamic imports with `{ ssr: false }` |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `blockhash-js` (client-side hash) | TensorFlow.js MobileNet | If catalog exceeds 5,000 cards and visual similarity across cards becomes ambiguous — not the case for 550 cards |
| Socket.IO + @nestjs/platform-socket.io | Native WebSocket (ws library) | If you need absolute minimal overhead and can accept no reconnection logic or rooms abstraction — not worth the tradeoff here |
| Dexie 4 + tournament-pairings | Full local SQLite via wa-sqlite | If tournament data becomes relational and complex — overkill for current bracket + pairing requirements |
| @great-detail/whatsapp-js-sdk | Raw fetch() to Meta Cloud API endpoints | If SDK falls behind Cloud API versioning — raw fetch is always the escape hatch; Meta's REST API is stable and versioned |
| Meta Cloud API | Baileys | Only if Meta Cloud API approval is blocked and you accept ToS risk — not recommended for any production use |

---

## Stack Patterns by Scenario

**If camera scan match confidence is low (Hamming distance > 10):**
- Fall back to tesseract.js OCR on the same captured frame
- Match card name text against the local card catalog via fuse.js (already installed in `apps/web`)
- Prompt user to confirm the match before saving

**If Socket.IO connection is blocked by restrictive network (venue firewall):**
- Socket.IO falls back to HTTP long-polling automatically
- No code change required; it is the default fallback behavior in socket.io v4

**If WhatsApp Cloud API approval is delayed:**
- Build the bot logic against the webhook handler first using Meta's test number
- The webhook + message processing pipeline is identical regardless of which phone number is used

**If tournament page must work on Android Chrome without internet:**
- `next-pwa` with `runtimeCaching` for `/tournament` routes
- Dexie stores all bracket data locally
- The page functions fully offline; sync happens when connectivity returns

---

## Sources

- `apps/api/package.json` and `apps/web/package.json` — existing installed versions (HIGH confidence)
- [WhatsApp/WhatsApp-Nodejs-SDK GitHub](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK) — confirmed archived June 2023 (HIGH confidence via WebFetch)
- [great-detail/WhatsApp-JS-SDK GitHub](https://github.com/great-detail/WhatsApp-JS-SDK) — v8.x, active, Cloud API v23 support (HIGH confidence via WebFetch)
- [socket.io Redis Adapter docs](https://socket.io/docs/v4/redis-adapter/) — v8.3.0 current, requires socket.io 4.3.1+ (HIGH confidence via WebFetch)
- [Dexie.js official site](https://dexie.org) — v4.0 current, React hooks in dexie-react-hooks 4.2.0 (HIGH confidence via WebFetch)
- [tournament-pairings npm](https://www.npmjs.com/package/tournament-pairings) — v2.0.1 (Oct 2025), Swiss via blossom algorithm (MEDIUM confidence via WebSearch)
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — browser API support (HIGH confidence)
- [commonsmachinery/blockhash-js GitHub](https://github.com/commonsmachinery/blockhash-js) — browser-compatible, no native deps (MEDIUM confidence via WebSearch)
- [Meta WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api/) — official API, per-message pricing since July 2025 (HIGH confidence via WebSearch)
- [@nestjs/platform-socket.io npm](https://www.npmjs.com/package/@nestjs/platform-socket.io) — v11.1.13 current as of March 2026; use ^10.x to match existing NestJS 10 (HIGH confidence via WebSearch)

---

*Stack research for: La Grieta — Milestone 2 capabilities*
*Researched: 2026-03-11*
