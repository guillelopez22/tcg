# Phase 3: Points Tracker - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Any two (or more) players at a table can start a scored Riftbound match, sync scores to all screens in real time via QR code, and see the correct battlefield-control scoring rules applied automatically. Guests can join without an account and build a temporary deck. Authenticated users can view their match history. The news section displays scraped Riftbound community updates on the dashboard. Covers PTS-01 through PTS-08, PLAT-02.

</domain>

<decisions>
## Implementation Decisions

### Scoring Interface Layout
- Board-centric layout: battlefields as large tappable zones in the center of the screen
- Player scores displayed at edges (top/bottom for 1v1, around edges for 3-4 players in FFA)
- 2 battlefields in 1v1, 3 battlefields in 2v2 and FFA
- Score shown as simple number format (e.g., "5/8") — no progress dots or progress bars
- Battlefield zones show actual card art from the card database as background, with card name overlaid
- Full-screen match mode: hide dashboard bottom navigation during active match, small 'Exit' button in corner
- Support both portrait and landscape orientations — landscape for table-propped viewing
- Auto-assigned player colors from a palette (blue, red, green, yellow) — no player color picking

### Battlefield Control Interaction
- Tap battlefield to cycle control: Uncontrolled → Player 1 → Player 2 → Contested → Uncontrolled
- Both players (peers) can tap — same interface for host and guest, trust-based like the physical game
- Single undo for accidental taps (5-second window, both players see undo notification) — consistent with collection undo pattern
- App enforces the 8th point rule: final winning point must come from holding, or player must conquer ALL battlefields that turn. Shows warning and blocks invalid win.

### Battlefield Selection
- Battlefields are part of the player's deck (each deck contains 3+ battlefield cards)
- Each player secretly selects their battlefield card(s) on their own phone
- "Reveal" button appears when all players have chosen — both phones flip cards simultaneously
- Authenticated users pick from their deck's battlefield cards
- Guests build a full temporary deck (same editor experience as Phase 1.2) — temp deck stored in session, discarded after match ends

### Turn & Phase Tracking
- Track ABCD turn phases: Awaken, Beginning, Channel, Draw — phase indicator on screen
- Phase advances on tap, helps new players remember the sequence
- Scoring auto-triggers during Beginning (B) phase: +1 per controlled battlefield for active player
- Conquest scoring (+1) triggers when battlefield control changes via tap
- Track which player goes first (designated during setup), app reminds about first-turn rune draw bonus (Channel: 3 instead of 2)
- Explicit "Next Turn" button to advance to next player's turn
- Optional turn timer: configurable (3/5/10 min per turn), off by default, shows countdown on both screens

### Match Flow
- Quick setup wizard: Step 1: Pick format (1v1/2v2/FFA) → Step 2: Choose Local Match or Synced Match → Step 3: Enter/confirm player names → Step 4: Select who goes first → Step 5: Secret battlefield selection → Step 6: Reveal & start
- Two match modes: "Local Match" (single device, shared screen) and "Synced Match" (QR join, multi-device)
- Player names: authenticated users auto-fill from profile display name, guests type their name
- Pause button: either player can pause, shows "Paused" overlay with pause duration timer
- End match available anytime (concession): confirmation dialog, winner by concession, saved to match history with "Concession" tag
- Win celebration: full-screen overlay with winner name, final score, animation/confetti, and "Rematch" / "End Session" buttons
- Collapsible turn-by-turn history log: hidden by default, shows "Turn 3: P1 conquered BF2 (+1), P2 holds BF1 (+1)"

### 2v2 Specifics
- Team scores + individual names: show team total (shared score racing to 11) with each teammate's name under the team label
- 3 battlefields, team color control indicators
- Both teammates on same team can interact with the board

### Match Tab & Navigation
- New "Match" (or "Play") bottom nav tab alongside Collection, Decks, Profile
- Match tab landing: big "New Match" button at top, followed by match history list (recent matches with scores, opponents, dates)
- Match history only visible for authenticated users (PTS-08)

### QR Join & Sync
- QR code encodes a web URL (e.g., lagrieta.gg/match/abc123) — opponent scans with phone camera, opens in browser, no app download needed
- Manual join code fallback alongside QR: 6-character code (e.g., "ABC-123") that can be typed at a URL
- QR/code displayed after host completes setup
- Joiners choose role: Player or Spectator
- Spectator mode: read-only synced view, good for judges and audiences
- Unlimited spectators — anyone with the link/code can join as spectator
- Shareable match URL — spectators can share the live link further (WhatsApp groups, Discord, social media during tournaments)
- Auto-reconnect on disconnect: "Reconnecting..." banner, server sends full game state on reconnect, 15-second heartbeat for iOS mobile browser stability
- In FFA/2v2: each player joins individually on their own phone, host assigns team membership in 2v2

### Guest Temp Deck
- Guests get the full deck editor experience (same as Phase 1.2): champion-first workflow, zone tabs, card search, format validation
- Temp deck stored in session/local storage, discarded after match ends
- No suggestion engine or ownership badges (guest has no collection) but full format validation

### Match History (PTS-08)
- Authenticated users see past matches in the Match tab: format, players, final scores, date, duration, who won
- Match detail view shows turn log, battlefield names, scoring breakdown

### Haptics & Sound
- Phone vibrates on score changes, subtle sound on conquest
- Can be muted in settings
- Win celebration has more prominent feedback

### News Section (PLAT-02)
- News displayed on dashboard home page (first thing after login)
- Content scraped from multiple sources: riftbound.gg blog, Riftbound social media (Twitter/X, Discord announcements)
- Card feed layout: vertical list of news cards with thumbnail image (if available), title, source badge, date, excerpt
- Tap to open full article via external link
- Scraping runs on a cron schedule (similar to existing deck-sync cron pattern)

### Claude's Discretion
- WebSocket vs SSE implementation details for real-time sync
- QR code generation library
- Turn timer UI positioning and animation
- Scraping implementation for each news source (RSS, API, DOM scraping)
- News refresh interval (cron frequency)
- Exact celebration animation/confetti implementation
- Landscape layout adaptation details
- Local match single-device UX (how two players share one screen)
- Session storage strategy for guest temp decks
- Match history pagination and data retention period

</decisions>

<specifics>
## Specific Ideas

- Battlefields are actual cards from the player's deck — each deck contains at least 3 battlefield cards to choose from
- Secret battlefield selection mirrors the real Riftbound rules: face-down pick, then simultaneous reveal
- The app should feel like a match companion, not just a scoreboard — knowing both players' full decks makes it more valuable
- Spectator mode enables tournament streaming: share the match URL on WhatsApp groups or Discord for live audience viewing
- The 8th point rule enforcement prevents rule mistakes at the table — important for newer players
- Honduran community shares everything via WhatsApp — the shareable match URL is critical for tournament engagement
- ABCD phase tracking doubles as a learning tool for new Riftbound players
- News scraping follows the same cron pattern as the existing riftdecks.com deck-sync module (@nestjs/schedule)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deck-card-editor.tsx`: Full zone-aware editor — reuse for guest temp deck builder
- `deck.service.ts`: Deck CRUD + card validation — extend for temp deck sessions
- `deck-sync.service.ts`: Cron scraping pattern for riftdecks.com — reuse pattern for news scraping
- `card.service.ts`: Card search and lookup — reuse for battlefield card selection
- `sonner` toast library: Undo pattern established in collection — reuse for match undo
- `lg-*` design system classes: Consistent styling across all new components
- `recharts`: Already used in stats — could be used for match analytics if needed
- Auth system: JWT + refresh tokens, `optionalAuthProcedure` for public endpoints (guest access)
- `useAuth()` hook: Conditional rendering for auth-dependent features (match history)

### Established Patterns
- NestJS module pattern: `*.module.ts` + `*.service.ts` + `*.router.ts` — new match module
- Zod schemas as single source of truth for types — match session schemas
- tRPC with httpLink (NOT httpBatchLink) — match endpoints
- Dashboard layout group `(dashboard)` with auth guard — match page within dashboard
- `@nestjs/schedule` cron pattern — news scraper schedule
- `next-intl` `useTranslations()` — all new UI strings need i18n

### Integration Points
- Bottom nav: `apps/web/src/app/(dashboard)/layout.tsx` — add Match/Play tab
- Dashboard home: `apps/web/src/app/(dashboard)/` — add news feed section
- New match module: `apps/api/src/modules/match/` — match sessions, scoring, real-time sync
- New news module: `apps/api/src/modules/news/` — scraping service, news endpoint
- DB schema: `packages/db/src/schema/` — new `match_sessions`, `match_players`, `match_events`, `news_articles` tables
- Shared schemas: `packages/shared/src/schemas/` — match and news Zod schemas
- WebSocket/SSE: New real-time transport for match sync (not yet in codebase)

</code_context>

<deferred>
## Deferred Ideas

- Undo support for Points Tracker (last 10 actions) — tracked as ADV-04 in v2 requirements, current phase has single undo only
- Match replay/playback from history — view a completed match turn-by-turn
- Tournament integration — linking match sessions to tournament brackets (Phase 4)
- In-app news reader (render articles in-app instead of external links)

</deferred>

---

*Phase: 03-points-tracker*
*Context gathered: 2026-03-12*
