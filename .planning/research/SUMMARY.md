# Project Research Summary

**Project:** La Grieta — Riftbound TCG Companion App
**Domain:** TCG Companion App (Collection Tracker, Deck Builder, Points Tracker, Tournament Manager, WhatsApp Marketplace)
**Researched:** 2026-03-11
**Confidence:** MEDIUM

## Executive Summary

La Grieta is a multi-capability TCG companion app built on an established NestJS + tRPC + Next.js + PostgreSQL + Redis monorepo. The research phase covers five distinct capability modules layered on top of what already exists: a card browser, basic deck builder, user auth, and a scanner module. The critical architectural insight is that these five modules have hard dependencies — Collection Tracker (including wantlist/tradelist) must ship first because the WhatsApp Marketplace, want-match notifications, and "build from owned cards" features all require it. The Points Tracker and Tournament Manager are deliberately standalone to allow them to be built in parallel without waiting on Collection Tracker's full data.

The recommended approach is to avoid external AI/ML for card recognition in favor of perceptual hashing against 550 cards (manageable catalog size), use Socket.IO rooms backed by Redis for real-time scoring (not tRPC subscriptions), run all Swiss pairing logic client-side in IndexedDB for offline resilience, and integrate the WhatsApp marketplace through Meta's official Cloud API with the actively-maintained `@great-detail/whatsapp-js-sdk` fork. No new infrastructure is required — every new capability fits within the existing stack primitives (NestJS modules, Redis, Drizzle schema extensions, Next.js App Router pages).

The key risk profile breaks into four categories: (1) the collection schema must correctly model multiple copies per card from day one — a boolean ownership model cannot be retrofitted for marketplace use; (2) camera scanning on iOS Safari has significant cross-browser gotchas that will silently break for a large portion of the Honduran audience if not tested on physical hardware before shipping; (3) WhatsApp template approval is a hard external dependency with a 2-4 week warming period that must be started before Phase 5 development begins, not after; and (4) the tournament manager's offline-first guarantee requires IndexedDB persistence on every mutation, not just on-unload — this distinction is the difference between a feature that works and one that destroys trust on event day.

---

## Key Findings

### Recommended Stack

The existing monorepo stack handles every new capability without introducing new infrastructure. New libraries are additive, not structural changes. For camera-based card scanning: `blockhash-js` runs perceptual hashing client-side in the browser (no WASM, no Node.js dependency), `sharp-phash` pre-computes card fingerprints server-side at seed time using the already-installed `sharp ^0.33.0`. For real-time scoring: `@nestjs/platform-socket.io` + `@socket.io/redis-adapter` creates WebSocket rooms backed by Redis (already provisioned) with automatic long-polling fallback for restrictive venue networks. For offline tournament management: `dexie ^4.0.x` wraps IndexedDB with reactive live queries, `tournament-pairings ^2.0.1` provides a blossom-algorithm Swiss pairing engine, and `next-pwa ^5.6.0` delivers the offline PWA shell. For WhatsApp: `@great-detail/whatsapp-js-sdk ^8.x` (the actively-maintained fork — Meta's official SDK was archived June 2023). Deck builder enhancements require no new libraries — pure logic belongs in `packages/shared`.

**Core technologies:**
- `blockhash-js` (client) + `sharp-phash` (server seed): perceptual card fingerprinting — no ML overhead for 550-card catalog
- `@nestjs/platform-socket.io` + `@socket.io/redis-adapter`: WebSocket rooms for Points Tracker — NestJS-native, Redis already available
- `dexie ^4.0.x` + `dexie-react-hooks`: offline IndexedDB for tournament state — React hook integration, crash-resilient
- `tournament-pairings ^2.0.1`: Swiss pairings via blossom algorithm — pure ESM, no server required
- `@great-detail/whatsapp-js-sdk ^8.x`: WhatsApp Cloud API client — TypeScript, Node 22 compatible, active maintenance
- `nanoid ^5.0.0`: session IDs and deck share codes — URL-safe, collision-resistant
- `next-pwa ^5.6.0`: PWA service worker for tournament offline shell — community-maintained fork

**Critical version constraints:**
- NestJS 10 + socket.io 4 (peer dep via `@nestjs/platform-socket.io@10.x` — do not install `socket.io` separately)
- `sharp-phash ^2` requires `sharp ^0.33` (already satisfied)
- Dexie 4 is client-side only — all imports must be in `'use client'` components or dynamically imported with `{ ssr: false }`
- `tournament-pairings` is pure ESM — Next.js 14.2+ handles this without `transpilePackages`

### Expected Features

**Must have (table stakes) — largely existing or targeted this milestone:**
- Full card database with search/filters — already exists (550 cards from riftbound-tcg-data)
- Deck builder with format validation (40+12+1) — exists, needs champion-first flow + real validation
- User accounts with auth — already exists (JWT + refresh tokens)
- Collection tracker with multi-copy, variant, and condition support — not yet built; highest-priority gap
- Set completion and collection stats — blocked on collection tracker
- Wantlist and tradelist — blocked on collection tracker
- Deck share codes and import from competitors — pure logic, no dependencies

**Should have (competitive differentiators):**
- QR-synced live Points Tracker — no competing Riftbound app has this; Riftbound's scoring system is unique
- Champion-first deck building workflow — all competitors use generic list-first UX
- WhatsApp marketplace with want-match notifications — meets Honduran users in their primary communication channel; no TCG precedent found
- Offline-first tournament manager with Swiss pairings — TopDeck.gg and Limitless are cloud-first; La Grieta is the only offline option
- Condition and variant tracking (NM/LP/MP/HP + Alt-Art/Overnumbered/Signature) — no existing Riftbound tool does this
- "Can I build this deck?" buildability indicator — blocked on collection tracker
- Sample hand simulator and energy/might curve analytics

**Defer (v2+):**
- Live price API integration — high complexity, low ROI for Honduran market scale currently
- Android native app (React Native) — PWA covers scanning use case for v1
- Community meta/tier lists — requires user critical mass and clear Riot policy position
- Multi-language Spanish UI — important long-term, not blocking v1
- Card grading integration — Riftbound grading market not mature until at least 2027

**Never build:**
- Metagame win-rate aggregation — explicitly prohibited by Riot policy
- Tournament brackets via Riot API — same prohibition
- Real-time chat competing with WhatsApp — splits attention from the marketplace's social layer

### Architecture Approach

The architecture adds five new module groups to the existing monorepo without changing its foundations. Two modules live primarily in NestJS (`points-tracker` with WebSocket gateway, `whatsapp` with webhook controller + bot handlers), one lives primarily in Next.js as an offline-capable client application (`tournament/` with Dexie + Zustand), one is a schema extension and service enhancement to the existing `collection` module (wantlist/tradelist with `list_type` enum), and one is pure shared logic in `packages/shared` (deck builder algorithms). The WhatsApp module deliberately uses a plain `@Controller()` — not tRPC — because Meta sends raw HTTP POST payloads. Card scanning reuses the existing `ScannerService.identify()` for both web camera scans and WhatsApp photo messages, avoiding duplicate image recognition infrastructure.

**Major components:**
1. `points-tracker` NestJS module — WebSocket gateway with Socket.IO rooms backed by Redis hashes; QR token is room key; no account required for joining player
2. `tournament/` Next.js pages — IndexedDB-first via Dexie, Swiss pairings via `tournament-pairings`, sync to PostgreSQL is fire-and-forget when online
3. `whatsapp` NestJS module — webhook controller (raw HTTP, HMAC-SHA256 verified), message router (text commands / image / interactive), notification worker (Redis subscriber), delegates image matching to `ScannerService`
4. `collection` module extension — adds `list_type` enum (`owned | wanted | trading`), cross-match query service, notification trigger via Redis pub/sub
5. Deck builder enhancements — champion-first validation logic, share code encoding, hand simulator, curve analytics; all in `packages/shared` as pure TS utilities

### Critical Pitfalls

1. **Collection schema with boolean ownership model** — The schema must use `CollectionEntry` as an atomic unit (multiple rows per `userId + cardId`) from migration zero. A `UNIQUE(user_id, card_id)` constraint makes the marketplace impossible to build later. This is the highest-recovery-cost mistake in the project.

2. **Camera scanning on iOS Safari** — `facingMode: "environment"` as an exact constraint silently falls back to front camera on iOS. Camera permission is re-prompted between sessions. HTTPS is required. Test on a physical iPhone over HTTPS before any camera code ships. Use `{ ideal: "environment" }`, implement error handling for all five `getUserMedia` error types, and treat manual search as a co-equal entry point.

3. **Perceptual hash false matches without confirmation UX** — Cards sharing champion art produce similar hashes. Scanning must never automatically add a card — always present a "Is this [Card Name]?" confirmation step with card art. Design the confirmation UX before writing any camera code.

4. **WebSocket state loss on mobile browser background** — iOS aggressively kills backgrounded WebSocket connections in a half-open state. Implement 15-second heartbeat ping/pong, reconnect with full server state resync, and a persistent connection status indicator in the Points Tracker UI.

5. **WhatsApp template rejection at launch** — Meta's template review is opaque and new phone numbers face a 250 conversations/24h rate limit cap during a 2-4 week warming period. Draft and submit all notification templates during Phase 4 development (before Phase 5 starts). Never start or end a template with a variable. Categories matter: card listing alerts are Utility, not Marketing.

6. **Tournament data loss on browser refresh** — Write to IndexedDB on every mutation, not on page unload. "Offline-first" must mean "survives crash," not "survives losing wifi." The server is the backup; IndexedDB is the source of truth during live play.

7. **Trade matching without database indexes** — A cross-join between wantlists and tradelists without `card_id` indexes becomes a full table scan. Run matching as a background Bull job, triggered only when lists change, with Redis-cached results (5-minute TTL). Perform `EXPLAIN ANALYZE` against a 500-user dataset before shipping.

---

## Implications for Roadmap

Based on the dependency graph from FEATURES.md and the build order from ARCHITECTURE.md:

### Phase 1: Collection Tracker Foundation

**Rationale:** Collection Tracker is the keystone feature. WhatsApp Marketplace, want-match notifications, wantlist/tradelist cross-matching, "can I build this deck?", and collection stats all depend on it. Nothing at the marketplace layer can function without it. Schema decisions made here are permanent — the `CollectionEntry` multi-copy model must be correct from the first migration.

**Delivers:** Multi-copy collection with condition (NM/LP/MP/HP/Damaged) and variant (Normal/Alt-Art/Overnumbered/Signature) tracking; wantlist and tradelist as `list_type` enum on `CollectionEntry`; set completion stats; collection UI with wantlist and tradelist tabs; cross-match query service (foundational for marketplace notifications); R2 photo upload for card images.

**Addresses:** Table stakes — collection list, set completion, wantlist/tradelist; competitive differentiator — variant + condition tracking.

**Must avoid:** `UNIQUE(user_id, card_id)` constraint (Pitfall 7), `AllowedHeaders: "*"` in R2 CORS (use `["content-type"]`), making camera scan the only add-card path.

**Stack:** Drizzle schema extension (list_type enum, multi-row CollectionEntry), R2 presigned URL upload, `blockhash-js` + `sharp-phash` for scanner hash pre-computation.

**Research flag:** Standard patterns — collection tracker is a well-understood domain. No phase research needed.

---

### Phase 2: Deck Builder Enhancements

**Rationale:** Pure logic work with no upstream dependencies. Can be built in parallel with or immediately after Phase 1. Deck builder improvements (champion-first flow, format validation, share codes, hand simulator, curve analytics) are self-contained in `packages/shared`. Delivers immediate user value to the competitive player segment while marketplace infrastructure matures.

**Delivers:** Champion-first deck creation workflow; real-time 40+12+1 format validation; energy/might curve bar chart; sample hand simulator (draw N from shuffled deck); share codes (nanoid + base62); import from Piltover Archive and riftbound.gg text list formats; "can I build this deck?" indicator (uses collection data if available, otherwise skips).

**Addresses:** Table stakes — deck share/export; competitive differentiators — champion-first workflow, sample hand, curve analytics.

**Must avoid:** None specific — this phase is low-pitfall territory.

**Stack:** Pure TypeScript in `packages/shared`; `nanoid ^5.0.0` for share codes; no new libraries.

**Research flag:** No research needed. Standard patterns.

---

### Phase 3: Points Tracker + QR Pairing

**Rationale:** Standalone feature with no upstream dependencies. High community visibility — this is the feature that will get La Grieta demoed at events. Because it is standalone (no login required for joining player), it can ship before the marketplace is complete and immediately establish La Grieta's presence at tournaments.

**Delivers:** 1v1/2v2/FFA battlefield scoring UI; QR code generation (host) and join-by-token flow (opponent, no account needed); real-time score sync via Socket.IO rooms; connection status indicator (green/amber/red); 15-second heartbeat with full-state reconnect; score event append-only log with last-10 undo; optional match history written to PostgreSQL when host is authenticated.

**Addresses:** Competitive differentiator — QR-synced Points Tracker is unique to La Grieta.

**Must avoid:** Storing room state in process memory (use Redis hash with TTL — Pitfall from Architecture anti-pattern 1); no heartbeat = invisible state loss on mobile (Pitfall 3); tRPC subscriptions for game state (use raw Socket.IO).

**Stack:** `@nestjs/platform-socket.io ^10.x`, `@socket.io/redis-adapter ^8.3.0`, `qrcode ^1.5.4`, `nanoid ^5.0.0` (6-char room token), `match_sessions` Drizzle schema.

**Research flag:** WebSocket gateway + Redis adapter is well-documented in NestJS official docs. No phase research needed.

---

### Phase 4: Tournament Manager

**Rationale:** Offline-first architecture means this phase is deliberately isolated from backend availability. The Swiss pairing logic runs entirely client-side. Building it after Phase 3 means Socket.IO infrastructure is confirmed working, but there is no hard dependency. This phase must be complete (and IndexedDB persistence fully tested) before Phase 5 begins, because TO workflow + deck submission data feeds into the marketplace's community presence.

**Delivers:** Tournament creation and player registration; Swiss pairings via `tournament-pairings` blossom algorithm with correct bye handling; IndexedDB persistence on every mutation via Dexie.js; browser crash/refresh recovery tested against 2-round tournament state; standings table; print-to-PDF for current pairings; optional deck list submission linked to deck builder; optional sync to PostgreSQL on reconnect; export-to-JSON checkpoint at every round boundary.

**Addresses:** Competitive differentiator — offline-first tournament manager; TopDeck.gg and Limitless are cloud-first; no competing Riftbound tool has this.

**Must avoid:** State in component memory without IndexedDB backing (Pitfall 5); custom Swiss algorithm (Pitfall 6 — use `tournament-pairings`); no test for odd player counts (3, 5, 7, 9).

**WhatsApp prerequisite (critical):** Submit all WhatsApp notification templates for Meta approval during this phase. Approval is typically fast but the 2-4 week number warming period must begin before Phase 5 development starts.

**Stack:** `dexie ^4.0.x`, `dexie-react-hooks ^4.2.0`, `tournament-pairings ^2.0.1`, `next-pwa ^5.6.0` (offline shell).

**Research flag:** Dexie + offline-first patterns are well-documented. `tournament-pairings` is verified on npm. No phase research needed unless Riftbound publishes specific Swiss tiebreaker rules that differ from standard.

---

### Phase 5: WhatsApp Marketplace Bot

**Rationale:** The highest upstream-dependency phase. Requires Phase 1 (wantlist/tradelist data to send meaningful notifications), Phase 2 (deck data for optional deck-list marketplace posts), and a Meta Business Account with approved templates and a warmed phone number. The WhatsApp bot is also the revenue-generating layer (marketplace listings, future premium mini shops) — it ships last because it leverages everything built before it.

**Delivers:** Webhook controller with HMAC-SHA256 signature verification; text command handler (/search, /list, /help) with fuzzy card name matching; photo message handler that delegates to `ScannerService.identify()` for card identification; want-match notification worker (Redis subscriber triggers WhatsApp message when wantlisted card is listed); marketplace listing creation with collection entry locking (prevents double-listing); `whatsapp_users` table for phone-to-user mapping and opt-in tracking; asynchronous processing (200 ACK before processing — Meta requires response within 20 seconds).

**Addresses:** Competitive differentiator — WhatsApp marketplace is unique; no other TCG app meets users in their existing channel.

**Must avoid:** Processing webhook payload before sending 200 ACK (Pitfall from Architecture anti-pattern 5 — use EventEmitter or Bull queue); webhook without signature verification (security mistake); template messages with consecutive variables or variable-first/last positions (Pitfall 4); trade matching without indexes (Pitfall 8); marketplace listing without locking underlying CollectionEntry.

**Stack:** `@great-detail/whatsapp-js-sdk ^8.x`, ioredis (already installed), Bull/BullMQ for async processing, `whatsapp_users` Drizzle schema.

**Research flag:** WhatsApp Cloud API integration patterns have good documentation. Meta Business Account setup and template approval are operational steps, not technical unknowns. Consider a brief pre-phase research spike on the `@great-detail/whatsapp-js-sdk` API surface to confirm webhook verification and media download patterns against the current Cloud API version before starting implementation.

---

### Phase Ordering Rationale

- **Collection Tracker must be first** because six downstream features depend on it and the schema must be correct from the initial migration. Retrofitting a boolean ownership model later requires a full data migration and rewrite of all downstream queries.
- **Deck Builder second** because it is the fastest win (pure logic, no dependencies) and improves a feature that already has users, demonstrating forward momentum.
- **Points Tracker third** because it is standalone and high-visibility — gets La Grieta into tournament venues and in players' hands before marketplace is ready.
- **Tournament Manager fourth** because its offline-first guarantee is non-negotiable and requires rigorous testing. The WhatsApp template warming period starts here.
- **WhatsApp Marketplace last** because it aggregates everything — collection data, deck data, TO relationships — and has the most external operational dependencies (Meta approval, phone warming).

This ordering mirrors the Architecture research build order exactly and is consistent with the Feature dependency graph.

### Research Flags

Phases needing deeper research during planning:
- **Phase 5 (WhatsApp Marketplace):** Run a pre-implementation spike on `@great-detail/whatsapp-js-sdk` webhook verification and media download to confirm API surface matches Cloud API v23. Also validate that Honduras Meta Business registration has no country-specific restrictions before committing to this approach.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Collection Tracker):** Collection tracker schema and R2 presigned URL patterns are well-established.
- **Phase 2 (Deck Builder):** Pure TypeScript logic, well-understood algorithms.
- **Phase 3 (Points Tracker):** NestJS WebSocket gateway + Redis adapter patterns are in official NestJS docs with sample code.
- **Phase 4 (Tournament Manager):** Dexie and `tournament-pairings` are both documented and verified.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Existing stack inspected directly (HIGH). New libraries verified against official docs and npm (HIGH). `blockhash-js` browser compatibility and `tournament-pairings` blossom algorithm correctness verified via web search (MEDIUM — not directly run). |
| Features | HIGH | Riftbound-specific competitor landscape verified by inspecting Piltover Archive, riftbound.gg, Riftbound Companion iOS, and Magical Meta. Feature gaps are real and confirmed. WhatsApp marketplace TCG precedent is LOW — no direct analog found; pattern adapted from Telegram commerce bots. |
| Architecture | HIGH | Existing codebase inspected directly. NestJS WebSocket + Redis patterns are from official docs. WhatsApp webhook pattern from Meta documentation. Offline-first IndexedDB pattern from LogRocket and sachith.co.uk with current-year sources. |
| Pitfalls | MEDIUM | Camera scanning iOS issues verified via MDN and Apple community reports (HIGH). WhatsApp template rejection reasons verified against Meta docs and WUSeller checklist (HIGH). Swiss bye duplication and perceptual hash collision behavior verified via academic and community sources (MEDIUM). Trade match performance trap is inference from data model analysis (MEDIUM). |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Riftbound-specific Swiss tiebreaker rules:** The `tournament-pairings` package uses standard chess-derived tiebreakers (match points, opponents' match wins, opponents' opponents' match wins). Riftbound may have its own official tiebreaker rules published by Riot. Verify before Phase 4 implementation begins.
- **Meta Business Account registration for Honduras:** Honduras WhatsApp Business registration has no known country restrictions, but verify this operational step early — it is the critical path for Phase 5.
- **WhatsApp Cloud API pricing at scale:** Currently free for first 1,000 conversations/month with per-message pricing beyond that (since July 2025). Validate the pricing model against projected usage before committing to WhatsApp as the marketplace communication layer.
- **Camera scan accuracy on Riftbound-specific card art:** Perceptual hashing accuracy on actual Riftbound card art has not been empirically tested. The confirmation-step UX is the correct mitigation, but accuracy should be measured on a sample of 20-30 Riftbound cards (especially Alt-Art variants) during Phase 1 implementation before committing to hash-only matching.
- **`@great-detail/whatsapp-js-sdk` production stability:** The SDK is actively maintained (1,380 commits, Node 22 support) but is not Meta's official library. Monitor for API version lag between the SDK and the Cloud API during development.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `apps/api/package.json`, `apps/web/package.json`, `packages/db/`, `packages/shared/` (inspected directly)
- [Meta WhatsApp Cloud API docs](https://developers.facebook.com/docs/whatsapp/cloud-api/) — pricing, template requirements, webhook verification
- [NestJS WebSocket Gateways docs](https://docs.nestjs.com/websockets/gateways) — gateway decorators and patterns
- [NestJS WebSocket Adapters docs](https://docs.nestjs.com/websockets/adapter) — Redis adapter setup
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — browser API support and constraint behavior
- [WhatsApp/WhatsApp-Nodejs-SDK GitHub](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK) — confirmed archived June 2023
- [great-detail/WhatsApp-JS-SDK GitHub](https://github.com/great-detail/WhatsApp-JS-SDK) — v8.x, active, Cloud API v23

### Secondary (MEDIUM confidence)
- [Dexie.js official site](https://dexie.org) — v4.0 current, dexie-react-hooks 4.2.0
- [socket.io Redis Adapter docs](https://socket.io/docs/v4/redis-adapter/) — v8.3.0 current
- [tournament-pairings npm](https://www.npmjs.com/package/tournament-pairings) — v2.0.1 (Oct 2025)
- [Piltover Archive](https://piltoverarchive.com), [riftbound.gg](https://riftbound.gg/builder/), [Riftbound Companion iOS](https://spark.mwm.ai/us/apps/riftbound-companion/6740396103), [Magical Meta](https://magicalmeta.ink/riftbound) — competitor feature review
- [LogRocket offline-first frontend 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — IndexedDB patterns
- [WhatsApp template approval checklist](https://www.wuseller.com/blog/whatsapp-template-approval-checklist-27-reasons-meta-rejects-messages/) — 27 rejection reasons
- [Hookdeck WhatsApp webhooks guide](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices) — silent subscription failure pattern
- [Cloudflare R2 presigned URLs docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) — CORS configuration

### Tertiary (LOW confidence)
- WhatsApp marketplace as TCG commerce layer — no direct TCG precedent found; pattern adapted from Telegram commerce bot analysis
- `blockhash-js` browser compatibility — verified via GitHub README; not directly run in browser
- Riftbound-specific Swiss tiebreaker rules — Riot has not published a formal tournament operations guide as of research date; standard TCG rules assumed

---

*Research completed: 2026-03-11*
*Ready for roadmap: yes*
