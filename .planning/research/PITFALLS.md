# Pitfalls Research

**Domain:** TCG companion app — Collection Tracker, Points Tracker, Tournament Manager, Deck Builder, WhatsApp Marketplace
**Researched:** 2026-03-11
**Confidence:** MEDIUM (camera scanning and WhatsApp API sections verified against official sources; TCG-specific patterns from community analysis)

---

## Critical Pitfalls

### Pitfall 1: Camera Scanning Works in Dev, Breaks for 80% of Users in Production

**What goes wrong:**
The card scanner demo works perfectly in a Chrome desktop session. Then it ships, and iOS Safari users (half the Honduran market runs iPhones) hit repeated permission re-prompts, the `facingMode: "environment"` constraint silently falls back to front camera, and HTTPS-only enforcement means any user on HTTP gets a hard `NotAllowedError` with no explanation.

**Why it happens:**
Safari historically ignores `facingMode` constraints even though `getSupportedConstraints()` reports them as supported. Safari also re-prompts for camera permissions between sessions in ways Chrome does not. Developers test on Chrome desktop and ship without testing the real device scenario.

**How to avoid:**
- Always test camera scanning on a physical iOS device over HTTPS from day one
- Implement explicit error handling for every `getUserMedia` error type: `NotAllowedError`, `NotFoundError`, `OverconstrainedError`, `NotReadableError`, `SecurityError`
- Show a user-readable message for each error ("Your browser blocked camera access — tap here to grant it in Settings")
- Provide a manual search fallback that is promoted equally to scanning — never make scanning the only entry point
- Use `{ video: { facingMode: { ideal: "environment" } } }` (ideal, not exact) to allow graceful fallback
- Require HTTPS in production — Cloudflare handles this automatically

**Warning signs:**
- Testing only on Chrome desktop during development
- No error boundaries around `getUserMedia` calls
- Camera button that shows a blank screen on failure instead of an error state

**Phase to address:** Collection Tracker (Phase 1) — build the fallback before the scanner, not after

---

### Pitfall 2: Perceptual Hashing Collapses on TCG Cards

**What goes wrong:**
Cards of the same type across sets share nearly identical art (same character, similar composition, only frame color differs). Perceptual hashing — the standard approach for "does this image match that image" — generates similar hashes for visually similar cards, causing false matches. With 550 cards and multiple variants (Normal, Alt-Art, Overnumbered, Signature) per card, hash collisions will be frequent enough to make scanning unreliable.

**Why it happens:**
Perceptual hashing is designed to detect "same image with minor changes." TCG cards violate the assumption that similar-looking images are the same image — different cards with the same champion art look nearly identical. Mirroring, cropping, and borders further degrade hash accuracy.

**How to avoid:**
- Do not attempt fully automated card ID from camera — the accuracy ceiling is too low for 550 cards with variants
- Use camera scanning for pre-filtering only: extract the card name text via OCR or match against a constrained subset (user inputs the set or champion first, scanner narrows to 20 candidates)
- Present a confirmation step: "Is this [Card Name]?" with the card image — let the user confirm
- For users in low-light conditions (tournament hall), camera scanning will fail regardless; make manual search fast (type 3 characters, see results)
- Consider a two-step flow: scan barcode/QR if official product has one, fall back to manual for everything else

**Warning signs:**
- Claiming "instant card recognition" in requirements without a confidence threshold plan
- No confirmation step in the scan flow
- Testing only against well-lit, undamaged reference card images

**Phase to address:** Collection Tracker (Phase 1) — design the scan-then-confirm UX pattern before writing a line of camera code

---

### Pitfall 3: QR Code Session Sync Drops State on Tab Switch or Background

**What goes wrong:**
The Points Tracker syncs two screens via QR code. Player A scans Player B's QR, both see the same score state in real time. But on mobile browsers, backgrounding the app or switching tabs causes WebSocket connections to silently die. When the user returns, state appears frozen at the last known value with no indication that the connection is lost.

**Why it happens:**
Mobile browsers aggressively throttle and kill background WebSocket connections. The application never detects the drop because the TCP connection lingers in a half-open state until a timeout (which can be minutes). Both sides show stale state confidently.

**How to avoid:**
- Implement a heartbeat ping/pong on the WebSocket every 15 seconds; if no pong within 5 seconds, mark connection as lost and show a visual indicator
- On reconnect, always resync full state from the server — never assume partial state is current
- Show a persistent connection status indicator in the Points Tracker UI (green dot = live, amber = reconnecting, red = offline)
- Design the session as a room with a short-lived session ID (stored in URL hash); re-joining the room after reconnect should restore all state from server
- Use SSE as a fallback if WebSocket is unavailable (SSE survives mobile browser throttling better on some devices)

**Warning signs:**
- No heartbeat implementation
- State stored only in client-side memory without server persistence
- No visual indicator of connection health in the points tracker UI

**Phase to address:** Points Tracker (Phase 3) — design the reconnection protocol before implementing score actions

---

### Pitfall 4: WhatsApp Template Messages Get Rejected After Launch

**What goes wrong:**
The marketplace bot sends notifications: "Your wishlisted card [Name] is now listed by [Seller]." This goes through Meta's template approval system. The template gets rejected — or approved, then silently paused — because it contains a variable in the wrong position, is categorized as Marketing instead of Utility, or triggers Meta's spam scoring on a new phone number with zero history.

**Why it happens:**
Meta's template review is machine-learning based, fast (minutes) but opaque. New WhatsApp Business phone numbers have "low quality rating" by default, meaning rate limits are severely constrained (250 conversations/24h starting tier) and flagging risk is high. Template pacing means even approved templates are rolled out slowly on fresh accounts. Most developers don't discover this until launch day.

**How to avoid:**
- Draft all notification templates before starting development and submit them for approval during the build phase, not at launch
- Categories matter: card listing alerts are Utility, not Marketing — miscategorization triggers rejection
- Never start or end a template with a variable like `{{1}}`; always surround variables with static text
- Never use consecutive variables: `{{1}} {{2}}` is rejected
- Plan for a 2-4 week warming period on a new WhatsApp Business phone number before reaching real users
- Build the bot's notification system to queue messages when under rate limits rather than dropping them
- Have a fallback notification path (email or in-app) for marketplace events in case WhatsApp delivery fails

**Warning signs:**
- Templates written after the bot is code-complete
- No email/in-app notification fallback
- Single phone number with no number warming plan

**Phase to address:** WhatsApp Marketplace (Phase 5) — submit templates for approval in the phase before marketplace development begins

---

### Pitfall 5: Tournament Manager Offline Data is Lost on Browser Refresh

**What goes wrong:**
The tournament organizer runs Swiss pairings at an event. The browser is refreshed (or crashes). All round data, pairings, and scores are gone. The TOs scramble to reconstruct manually. The offline-first feature that was the core value proposition fails on the most important day.

**Why it happens:**
"Offline-first" is often implemented as "works without internet for the current session" rather than "survives browser restarts." Developers store state in React/component state or even `localStorage` without a proper persistence layer, and don't test the refresh scenario.

**How to avoid:**
- All tournament state must be persisted to IndexedDB on every mutation — not just synced to server when online
- Use a library like Dexie.js (IndexedDB wrapper) with explicit write-on-change, not flush-on-unload
- Implement export-to-JSON at every round boundary as a paper trail ("save checkpoint" button visible to TO)
- Test the crash scenario explicitly: populate 8 players and 2 rounds, hard-refresh, verify full recovery
- On reconnect to internet, sync to server; while offline, run entirely from IndexedDB — the server is the backup, not the source of truth for the TO's session

**Warning signs:**
- Tournament state stored in component state or Redux without IndexedDB persistence
- No "export round data" function
- No test for the refresh-mid-tournament scenario

**Phase to address:** Tournament Manager (Phase 4) — write the IndexedDB persistence layer first, before the Swiss pairing logic

---

### Pitfall 6: Swiss Bye Assignment Awards Byes to the Same Player Repeatedly

**What goes wrong:**
With an odd number of players, Swiss pairings must assign one player a bye each round. A naive implementation (assign bye to last-place player) awards the bye to the same player multiple times in a small tournament, inflating their score unfairly or depressing it if byes score 0.

**Why it happens:**
Swiss pairing is solved in chess with rigorous algorithms (Dutch system, Burstein system). TCG tournament managers frequently roll their own naive implementations based on sort-and-pair, which doesn't account for bye history or avoid rematches.

**How to avoid:**
- Use the `tournament-pairings` npm package (maintained, implements weighted blossom algorithm with proper bye and rematch avoidance)
- Define the bye score explicitly before implementation: Riftbound may have a specific rule — if none exists, use a game loss win (1-0 game score, 3 match points)
- Track each player's bye history and enforce: no player receives more than one bye per tournament
- Test with 3, 5, 7, 9 players — the edge cases hit on odd counts

**Warning signs:**
- Custom Swiss algorithm from scratch
- No test cases for odd player counts
- Bye history not stored in the round data

**Phase to address:** Tournament Manager (Phase 4)

---

### Pitfall 7: Collection Data Model Doesn't Distinguish Copies from Cards

**What goes wrong:**
The database schema stores `user_id + card_id` as unique — so a user can own exactly one of each card. A player who owns three copies of "Jinx" at different conditions (NM, LP, HP) can't represent that in the system. Marketplace listings become impossible to model (can't list one copy while keeping another).

**Why it happens:**
The initial mental model is "does the user have this card?" (boolean). The correct model is "how many copies, each with its own attributes?" (collection entries). The boolean model is easy to build and breaks at marketplace time.

**How to avoid:**
- Design the collection schema with `CollectionEntry` as the atomic unit: `{ id, userId, cardId, condition, variant, quantity, purchasePrice, notes, photos[] }`
- Allow multiple `CollectionEntry` rows per `(userId, cardId)` — one per condition/variant combination
- Marketplace listings reference a `CollectionEntry` not a card — the listing locks that specific copy
- Wantlist entries reference card + acceptable conditions + maximum quantity — not a CollectionEntry (they don't own it yet)

**Warning signs:**
- Collection schema with `UNIQUE(user_id, card_id)` constraint
- `hasCard` boolean anywhere in the data model
- Deck builder checking collection by card ID without accounting for condition or locked copies

**Phase to address:** Collection Tracker (Phase 1) — schema must be correct before any feature is built on top of it

---

### Pitfall 8: Marketplace Trade Matching Runs as a Full Table Scan

**What goes wrong:**
Trade matching compares every user's tradelist against every other user's wantlist — a cross join. At 100 users with 50-card tradelists and 30-card wantlists, that's 1.5 million row comparisons per match run. At 500 users it's 37.5 million. The feature works fine in staging and degrades to timeouts in production.

**Why it happens:**
The matching query is written intuitively (join wantlists to tradelists on card_id) without an index plan. As collection sizes grow, the query time grows quadratically.

**How to avoid:**
- Index on `card_id` in both wantlist and tradelist tables
- Run matching as a background job (Bull queue), not in the request cycle
- Trigger a match run only when a tradelist or wantlist is updated (not on every card view)
- Limit match output: "Users who have cards you want" → paginate, don't return all at once
- Cache match results in Redis with a TTL of 5 minutes — exact real-time matching is not needed

**Warning signs:**
- Match query without `EXPLAIN ANALYZE` run against a realistic dataset
- Match triggered on every page load
- No pagination on match results

**Phase to address:** WhatsApp Marketplace (Phase 5) — index and background job design before shipping trade matching

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store collection state in localStorage only | Fast to ship | Lost on clear, not synced, no cross-device | Never — use IndexedDB + server sync |
| Single WhatsApp phone number for all bot messages | Simple setup | Rate limit caps outreach; one quality downgrade affects all features | MVP only — plan number segmentation |
| Perceptual hash with no confirmation step | Fast demo | 5-15% false matches shipped to users, destroys trust | Never without confirmation UX |
| Roll your own Swiss pairing | Control | Bye duplication bugs, rematch edge cases | Never — use tournament-pairings package |
| Collection schema with boolean hasCard | Simple query | Cannot support marketplace, condition, copies | Never — correct schema from day one |
| Sync tournament state on unload only | Less DB writes | All data lost on crash/refresh | Never — write on every mutation |
| Run trade matching synchronously in request | Simpler code | Timeout at production scale | MVP with small user count only; queue before public launch |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare R2 presigned URLs | Using `AllowedHeaders: "*"` in CORS config (works on AWS, silently broken on R2) | Set `AllowedHeaders: ["content-type"]` specifically |
| Cloudflare R2 presigned URLs | Not setting Content-Type in signature — client sends different type, gets 403 | Include Content-Type in presigned URL generation; enforce it client-side |
| WhatsApp Cloud API webhooks | Webhook URL verified but app never subscribed to events — silent failure | Verify subscription status separately from URL verification in Meta dashboard |
| WhatsApp Cloud API tokens | Using 24-hour user token in production | Use System User token (non-expiring) stored in secrets manager |
| WhatsApp templates | Submitting templates after build is complete | Submit during planning/design phase — approval takes minutes to 48h, plus warming period |
| getUserMedia (Safari iOS) | Using `facingMode: "environment"` as exact constraint | Use `{ ideal: "environment" }` for graceful degradation |
| tRPC WebSocket subscriptions | Assuming broadcast works like HTTP responses (one-to-many from single request ID) | Use Redis pub/sub for broadcasting; tRPC WebSocket handles one-to-one responses |
| IndexedDB (offline tournament) | Relying on browser storage quota without checking available space | Check `navigator.storage.estimate()` before large writes; cap tournament data storage |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Trade match query without indexes | Match page times out; DB CPU spikes | Index `card_id` on wantlist and tradelist; run as background job | ~200 active users with populated collections |
| Loading full 550-card catalog on every collection page | Slow initial render; large API payloads | Paginate card list; cache card catalog in Redis; bundle card data for offline use | First production load; always visible |
| Storing card images in PostgreSQL as BLOBs | DB size explodes; backups slow | All images via Cloudflare R2 URLs only; never store binary in DB | At ~1,000 collection photos |
| WebSocket connections per user for points tracker without connection pooling | Memory grows with concurrent games; no reconnect on pod restart | Stateless room design; store room state in Redis; connection is ephemeral | At ~50 concurrent games |
| Sending WhatsApp notifications synchronously in the request cycle | Request timeouts when Meta API is slow; user gets 500 error | Queue all WhatsApp sends via Bull; respond to user immediately, send async | Every request when Meta API has >2s latency |
| Running camera scan inference on the main thread | UI freezes during image processing | Use Web Worker for image processing; never block main thread | Every scan attempt |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing collection entry IDs in URLs without ownership check | User A can view or modify User B's collection entries via ID enumeration | Scope all collection queries by `userId` from JWT; never trust client-provided `userId` |
| Marketplace listing without locking the underlying collection entry | Same copy listed twice; double-sold | Add `listed_at` timestamp and `listing_id` FK to `CollectionEntry`; enforce mutex |
| WhatsApp webhook endpoint without signature verification | Malicious actor sends fake marketplace events; fake listings created | Verify `X-Hub-Signature-256` on every webhook payload before processing |
| QR code session with no expiry or invalidation | Old QR codes reactivate finished games; stale sessions accumulate | Session IDs expire after match end + 24h; single-use confirmation on join |
| Presigned R2 URLs with long expiry times for user-uploaded collection photos | Leaked URL gives permanent access to private photos | Set presigned URL expiry to 15 minutes for upload, 1 hour for signed read URLs |
| No rate limiting on collection mutation endpoints | Bot can flood collection with thousands of fake entries | Rate limit at 100 req/min per IP; additional per-user limit on write endpoints |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Making camera scan the only way to add cards | Users with poor lighting, old phones, or camera-shy get blocked | Scan and manual search are co-equal entry points; manual is not a fallback |
| Showing card collection as a flat list of 550 cards | Overwhelming; users don't know what they own vs. don't own | Default view is "My Collection" (owned cards only); separate browse-all view |
| No undo on collection entry deletion | User accidentally deletes a copy; no recovery | Soft-delete with 30-second undo toast; hard delete deferred |
| WhatsApp bot that requires exact command syntax | Honduran users abandon bots that don't understand natural variation | Use fuzzy matching on card names; accept "jinx", "Jinx", "la jinx", etc. |
| Tournament pairings without a printed fallback | Power outage → tournament stops → TOs have nothing | "Print Round" button generates a PDF of current pairings and standings |
| Points tracker with no score history | Score dispute: who controlled what battlefield? No log | Append-only score event log; display last 10 actions with undo option |
| Wantlist/tradelist with no bulk import | Adding 30 cards to a wantlist one at a time → users give up | Bulk add: type multiple card names, select from results list, add all |

---

## "Looks Done But Isn't" Checklist

- [ ] **Camera scanning:** Manual add flow is equally polished — test scanning with a damaged card, a foil card, and in dim lighting. If any of these break, the feature is not done.
- [ ] **Collection tracker:** Multiple copies of the same card at different conditions are tracked independently — verify by adding three Jinx cards (NM, LP, HP) and confirming they appear as three separate entries.
- [ ] **Points tracker sync:** Test the reconnect scenario: open a game, background the app for 60 seconds, return — state must recover without manual refresh.
- [ ] **Tournament manager:** Refresh the browser mid-tournament — all round data must survive and re-render correctly from IndexedDB.
- [ ] **Swiss pairings:** Run with 3, 5, 7, and 9 players — verify no player receives two byes in a single tournament.
- [ ] **WhatsApp bot:** Test with misspelled card names, lowercase, mixed case, and the card name in Spanish — matcher must handle all.
- [ ] **Trade matching:** Add a card to your wantlist, then add the same card to another user's tradelist — a match notification must appear. Verify it does not appear for the same match twice.
- [ ] **Marketplace listing:** List a card, verify the underlying collection entry is marked as unavailable. Attempt to list the same physical copy again — system must reject it.
- [ ] **Deck builder validation:** Build a deck, attempt to include a card you don't own in your collection — the builder must flag it. Remove from collection, verify the deck shows it as unowned.
- [ ] **R2 photo upload:** Upload a collection card photo on iOS Safari — verify CORS headers are correct and the image appears without refreshing.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Collection schema with wrong uniqueness constraint | HIGH | Data migration to new CollectionEntry model; all downstream queries rewritten |
| Template message rejection at launch | MEDIUM | Resubmit corrected template (fast approval); add in-app notification fallback within a day |
| Tournament data lost on browser refresh | HIGH | Manual reconstruction from paper; user trust broken; implement IndexedDB persistence before re-launch |
| Trade matching timeout in production | MEDIUM | Add DB indexes (minutes); move to background job (hours); no data loss |
| R2 CORS misconfiguration | LOW | Update R2 CORS config in Cloudflare dashboard; takes effect immediately |
| WebSocket sessions not recovering on disconnect | MEDIUM | Add heartbeat + reconnect logic; can be shipped as a hotfix without data migration |
| Swiss bye duplication in live tournament | HIGH | No clean fix mid-tournament; TO must manually adjust; replace algorithm before next event |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Camera scanning Safari iOS failures | Collection Tracker (Phase 1) | Manual test on physical iPhone over HTTPS before shipping |
| Perceptual hash card ID false matches | Collection Tracker (Phase 1) | UX review: scan flow must include confirmation step |
| Collection schema wrong (boolean ownership) | Collection Tracker (Phase 1) | Schema review: `CollectionEntry` table with multi-row support before first migration |
| Multiple copies per card not tracked | Collection Tracker (Phase 1) | Integration test: add 3 copies of same card at different conditions |
| QR sync loses state on background/tab switch | Points Tracker (Phase 3) | Reconnection test: background app for 60s, verify state recovery |
| Tournament data lost on refresh | Tournament Manager (Phase 4) | Crash test: populate 2 rounds, hard-refresh, verify full recovery |
| Swiss bye duplication | Tournament Manager (Phase 4) | Automated test: run 100 random 5-player tournaments, verify no player gets 2 byes |
| WhatsApp template rejection at launch | Before WhatsApp Marketplace (Phase 5) | Templates submitted and approved during Phase 4 development |
| Trade matching table scan | WhatsApp Marketplace (Phase 5) | `EXPLAIN ANALYZE` on match query with 500-user dataset before launch |
| Marketplace double-listing same copy | WhatsApp Marketplace (Phase 5) | Test: attempt to create two listings for the same CollectionEntry |
| R2 CORS misconfiguration | Collection Tracker (Phase 1) | Upload test on Safari iOS before shipping photo feature |
| WhatsApp webhook without signature verification | WhatsApp Marketplace (Phase 5) | Security review: send a forged webhook payload, verify 401 response |

---

## Sources

- [MDN getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Common getUserMedia errors — addpipe.com](https://blog.addpipe.com/common-getusermedia-errors/)
- [Safari camera permission re-prompt bug — Apple Community](https://discussions.apple.com/thread/256081579)
- [WhatsApp template approval checklist: 27 rejection reasons — WUSeller](https://www.wuseller.com/blog/whatsapp-template-approval-checklist-27-reasons-meta-rejects-messages/)
- [WhatsApp webhooks: silent subscription failure — Hookdeck](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices)
- [WhatsApp webhook implementation guide — Meta](https://business.whatsapp.com/blog/how-to-use-webhooks-from-whatsapp-business-api)
- [Offline sync and conflict resolution patterns — sachith.co.uk](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/)
- [Offline-first frontend apps 2025: IndexedDB and SQLite — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- [Cloudflare R2 presigned URLs — Cloudflare Docs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [R2 CORS fix for presigned URLs — DEV Community](https://dev.to/ehteshamdev/how-to-fix-cors-error-while-uploading-files-on-cloudflare-r2-using-presigned-urls-21dm)
- [Perceptual hashing limitations — Hackerfactor](https://hackerfactor.com/blog/index.php?/archives/432-Looks-Like-It.html)
- [Perceptual hashing analysis — ScienceDirect](https://www.sciencedirect.com/article/pii/S1877050921011030)
- [Swiss pairing bye duplication — bluebones.net](https://bluebones.net/2018/04/swiss-pairing-algorithm/)
- [tournament-pairings npm package](https://www.npmjs.com/package/tournament-pairings)
- [WebSocket architecture best practices — Ably](https://ably.com/topic/websocket-architecture-best-practices)
- [tRPC WebSocket subscriptions — tRPC docs](https://trpc.io/docs/server/websockets)

---

*Pitfalls research for: La Grieta TCG companion app — Collection Tracker, Points Tracker, Tournament Manager, Deck Builder, WhatsApp Marketplace*
*Researched: 2026-03-11*
