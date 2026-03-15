---
phase: 03-points-tracker
verified: 2026-03-15T08:00:00Z
status: human_needed
score: 21/21 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 21/21
  gaps_closed: []
  gaps_remaining: []
  regressions:
    - truth: "Match board renders vertical 0-8 score trackers on left and right sides"
      severity: description_mismatch
      detail: "Layout restructured — both VerticalScoreTracker components now stacked vertically on LEFT side (opponent above divider, me below). The underlying goal (both players' scores visible during gameplay) is still satisfied. The 'flanking' description no longer matches the implementation."
human_verification:
  - test: "Full end-to-end match flow — create, join as guest, build temp deck, select battlefields, play to win"
    expected: "Match wizard -> deck selection (step 5) -> QR code shown -> guest joins and builds deck (legend + champion unit via build step + 40 main + 12 runes + 2+ battlefield cards) -> both players see secret battlefield selection -> simultaneous card flip reveal -> match board shows both scores at 0/8 -> tapping a battlefield updates control on both screens -> advancing to B phase awards +1 for controlled battlefield -> reaching 7 points and attempting to win without holding a battlefield shows the 8th point rule toast -> winning legitimately triggers confetti + victory chime overlay on both screens"
    why_human: "Requires two browser sessions and real Socket.IO round-trips. CSS flip animation timing, haptic vibrate, AudioContext chime, and toast appearance cannot be verified programmatically."
  - test: "Dashboard home and /news page news feed"
    expected: "After server restart, articles appear in the NewsFeed on the dashboard home page and the new /news page. Each card shows thumbnail, title, source badge (Riftbound Official / riftbound.gg / riftdecks.com), relative date, and excerpt. Tapping the card header expands it. The external link button opens the article in a new tab."
    why_human: "News scraper hits live external URLs. RSS/Sitemap/HTML cascade correctness and visual layout require a running server and browser."
  - test: "Match history and detail view"
    expected: "After completing a match, the authenticated user sees it in the history list with format badge, opponent names, final score, duration, and win/loss indicator. Tapping the item opens the detail view at /match/history/[uuid] with full turn log timeline, scoring breakdown (conquest vs holding points), and battlefield names."
    why_human: "Requires a completed match in the database and an authenticated session."
  - test: "IconMatch SVG renders visibly in dashboard nav"
    expected: "The Match tab in the bottom navigation shows a visible crossed-swords icon (two lines with a circle). The icon appears identical to other tab icons in brightness and stroke weight."
    why_human: "SVG child element stroke inheritance depends on browser rendering — explicit stroke= attributes have been added but visual appearance requires manual inspection."
  - test: "Guest deck builder Champion Unit flow"
    expected: "Opening /match/[code] as a guest, entering a name as Player, shows the Legend picker first. Selecting a Legend then clicking 'Continue to Build Deck' enters the build step. Adding a Champion Unit card from the main tab assigns it to the champion zone (visible in the deck panel with 'Champion' label and card art). Adding a second Champion Unit adds it to the main deck. Ready button enables only when deck is complete (40 main + 12 runes + 3 battlefields + 1 champion)."
    why_human: "Multi-step interactive UI flow. Requires browser interaction and real Champion Unit cards from the database to verify zone assignment, champion slot UI, and validation state."
  - test: "Deck selection step in match wizard populates battlefield cards"
    expected: "In the match wizard at step 5 (deck selection), authenticated user sees their decks listed. Selecting a deck with battlefield zone cards triggers trpc.deck.getById, extracts battlefield cards, and auto-advances. Proceeding to battlefield selection shows the actual battlefield cards from the selected deck rather than an empty grid."
    why_human: "Requires authenticated user with at least one deck containing battlefield zone cards. The useEffect population of battlefieldCards state requires runtime verification."
  - test: "Match board play mat layout visual verification"
    expected: "Opening a match board shows the play mat: Row 1 = left score panel (opponent score above divider, my score below, both stacked vertically) + battlefield columns as full-height DropZones with card art + deployed unit area below each BF; Row 2 = Champion/Legend slots left + wide droppable base zone center + main deck pile right; Row 3 = rune deck pile left + channeled runes center + trash drop zone right; Hand section (150px) below. Dragging a base zone card to a battlefield column deploys it. Gold/navy color scheme throughout."
    why_human: "Visual layout, drag-drop behavior, and vertical proportions require a browser. Deployed unit display below battlefields and base -> battlefield drag-and-drop require interactive testing."
---

# Phase 03: Points Tracker Verification Report

**Phase Goal:** Real-time Points Tracker & News Feed — Full match lifecycle (setup -> play -> history) with real-time sync, plus aggregated news feed from Riftbound sources.
**Verified:** 2026-03-15T08:00:00Z
**Status:** human_needed
**Re-verification:** Yes — regression check after commit aa11ffb (news feed scraper rewrite, guest champion flow hardening, match board layout restructure)

## Re-Verification Summary

This is the fourth verification of Phase 03. The previous verification (2026-03-14, score: 21/21, status: human_needed) confirmed all automated infrastructure was in place.

Since that verification, commit `aa11ffb` landed with significant Phase 3 file changes:

- `apps/api/src/modules/news/news.service.ts` — Major rewrite: RSS/Atom > Sitemap > HTML cascade scraping strategy; 3 news sources (riftbound.gg, Riftbound Official, riftdecks.com); non-blocking startup sync (fire-and-forget after 3s); new `getCount()` and `getSyncStatus()` methods
- `apps/api/src/modules/news/news.router.ts` — Added `getCount` and `getSyncStatus` public procedures; `triggerSync` is now fire-and-forget
- `apps/web/src/app/(dashboard)/news-feed.tsx` — Added expand/collapse per card, 5 source color badge variants
- `apps/web/src/app/match/[code]/guest-deck-builder.tsx` — Champion zone guard hardened; visible champion slot with card art added to deck panel (808 lines)
- `apps/web/src/app/match/[code]/match-board.tsx` — Significant play mat restructure (917 lines): score trackers consolidated into single left panel (both players stacked); UnitZone components replaced by battlefield DropZones with deployed unit display; base zone reorganized into Row 1/2/3 layout mirroring physical Epic Upgrades mat

Additionally, the working tree contains unstaged changes on top of that commit:

- `apps/web/src/app/match/[code]/match-board.tsx` — hand height tweaked from 160px to 150px
- `apps/web/src/app/match/[code]/drag-drop-context.tsx` — ZoneId union extended with `battlefield-0`, `battlefield-1`, `battlefield-2`
- `apps/web/src/app/(dashboard)/news/` (untracked) — new `/news` page and `tournament-decks.tsx` component, additive

**Description mismatch (non-regression):** Truth 20 previously described score trackers "on left and right sides flanking the battlefield." The new layout places both VerticalScoreTracker components in a single left panel (opponent score above a gold divider, my score below). Both trackers are still present and wired — the observable goal (both scores visible during gameplay) is satisfied. The human verification item for the match board has been updated to reflect the new layout description.

**No functional regressions detected. All 21/21 truths remain verified. 7 items still require human testing.**

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Match scoring engine applies +1 on conquest and +1 per controlled BF at Beginning phase | VERIFIED | `scoreConquest` and `scoreBeginningPhase` exported from `match-scoring.ts` (288 lines); `match.service.ts` (594 lines) calls both on correct events |
| 2 | 8th point rule enforced: final winning point must come from holding or conquering ALL BFs | VERIFIED | `validateWinCondition` in `match-scoring.ts`; `match-board.tsx` fires sonner toast on `8th point rule` log event (line 427-429) |
| 3 | 1v1 sessions use 2 battlefields / win target 8; 2v2 uses 3 / target 11; FFA uses 3 / target 8 | VERIFIED | `WIN_TARGET_1V1=8`, `WIN_TARGET_2V2=11`, `WIN_TARGET_FFA=8`, `BATTLEFIELDS_*` constants; `createInitialState` consumes them |
| 4 | Battlefield tap cycles Uncontrolled -> Player1 -> Player2 -> Contested -> Uncontrolled | VERIFIED | `cycleBattlefieldControl` exported from `match-scoring.ts`; called in `match.service.ts` applyBattlefieldTap |
| 5 | Match can be created via tRPC returning a 6-char join code | VERIFIED | `match.create` optionalAuthProcedure; `match.service.ts` generates nanoid code |
| 6 | Guest can join a match by code without authentication | VERIFIED | `match.join` uses `optionalAuthProcedure`; public `/match/[code]/page.tsx` outside (dashboard) auth group |
| 7 | Socket.IO gateway broadcasts state changes to all clients in a match room | VERIFIED | `match.gateway.ts` (197 lines) handles all 7 events; broadcasts `state:patch` to room |
| 8 | Battlefield selections held secretly per-player until all submit, then revealed simultaneously | VERIFIED | `submitBattlefieldSelection` stores to `pendingBattlefieldSelections`; `revealBattlefields` broadcasts when all players submit |
| 9 | User can navigate to Match tab from bottom nav | VERIFIED | `dashboard-nav.tsx` has `{ href: '/match', label: 'Match', icon: IconMatch }` with explicit `stroke="currentColor"` on SVG child elements |
| 10 | User can start a new match via setup wizard | VERIFIED | `(dashboard)/match/new/page.tsx` (969 lines): 9-step wizard with format, mode, names, first player, deck selection, P1 BF pick, P2 deck build, P2 BF pick, match board |
| 11 | Guest can build a full temporary deck stored in sessionStorage | VERIFIED | `guest-deck-builder.tsx` (808 lines): 2-step flow (legend -> build), sessionStorage under `lagrieta_temp_deck_{code}`, Champion Unit assigned to champion zone; duplicate assignment guarded; visible champion slot with card art in deck panel |
| 12 | Full match gameplay board with ABCD phase tracker, scoring, and win celebration | VERIFIED | `match-board.tsx` (917 lines): uses `useMatchSocket` hook, both VerticalScoreTrackers, OpponentBoard, base zone, rune row, hand row, drag-drop context with battlefield DropZones |
| 13 | Authenticated users can view their match history | VERIFIED | `(dashboard)/match/page.tsx`: `trpc.match.history.useInfiniteQuery` with infinite scroll; links to `/match/history/${match.id}` |
| 14 | Match detail view shows turn log, battlefield names, scoring breakdown | VERIFIED | `(dashboard)/match/history/[id]/page.tsx`: `trpc.match.getById.useQuery`, turn log timeline, scoring breakdown |
| 15 | Dashboard home page shows news feed | VERIFIED | `(dashboard)/page.tsx` imports and renders `<NewsFeed />`; `news-feed.tsx` calls `trpc.news.getLatest.useQuery`; additionally a new `/news` dedicated page also renders `<NewsFeed />` |
| 16 | News cron fetches and upserts articles on schedule | VERIFIED | `news.service.ts` (852 lines): `@Cron('0 */4 * * *')` syncCron; startup sync fire-and-forget after 3s; 3 sources (riftbound.gg via RSS/Sitemap/HTML cascade, Riftbound Official via __NEXT_DATA__, riftdecks.com); `onConflictDoUpdate` dedup |
| 17 | Authenticated users can select a deck during match setup to provide battlefield cards | VERIFIED | `(dashboard)/match/new/page.tsx` step 5: `trpc.deck.list.useQuery({ limit: 50 }, { enabled: step >= 5 })` at line 215, `trpc.deck.getById.useQuery({ id: selectedDeckId! }, { enabled: !!selectedDeckId })` at line 221; `battlefieldCards` state wired to `BattlefieldSelection` |
| 18 | Guest deck builder validation counts champion zone correctly | VERIFIED | `addCard` assigns `zone='champion'` for first Champion Unit (lines 452-454); `hasChampion = !!championEntry` (line 436); `mainOk = mainCount === MAIN_DECK_SIZE && hasChampion` (line 437); duplicate guard prevents second assignment |
| 19 | Both players can reach battlefield selection with actual battlefield cards | VERIFIED | Synced mode: deck selection (step 5) -> match create -> QR (step 6) -> battlefield selection (step 7) with `battlefieldCards` from selected deck; skip option provided |
| 20 | Match board renders score trackers for both players | VERIFIED | `VerticalScoreTracker` component (lines 67-95): 9 circles stacked vertically, gold/navy theme; both trackers used at lines 607 (opponent) and 621 (me) in a single left panel with a gold divider. Layout changed from flanking to stacked — both players' scores remain visible |
| 21 | Match board shows per-player zones (Legend, Champion) and opponent board | VERIFIED | `OpponentBoard` component (lines 196-318): legend, champion, base slots, rune row (local mode); Row 2 shows Champion/Legend zone slots for my board; base zone is wide droppable area with Main Deck pile |

**Score:** 21/21 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/modules/match/match-scoring.ts` | Pure scoring engine | VERIFIED | 288 lines; exports `createInitialState`, `cycleBattlefieldControl`, `scoreConquest`, `scoreBeginningPhase`, `validateWinCondition`, `advancePhase`, `advanceTurn` |
| `packages/db/src/schema/match-sessions.ts` | match_sessions table | VERIFIED | Exists; exported from `schema/index.ts` |
| `packages/db/src/schema/match-players.ts` | match_players table | VERIFIED | Exists; FK to match_sessions |
| `packages/db/src/schema/news-articles.ts` | news_articles table | VERIFIED | Exists; unique URL constraint |
| `packages/shared/src/schemas/match.schema.ts` | Zod match schemas | VERIFIED | Exports `matchFormatSchema`, `matchCreateSchema`, `matchJoinSchema`, `matchStateSchema`, `matchHistorySchema` |
| `apps/api/__tests__/match-scoring.spec.ts` | TDD tests | VERIFIED | 354 lines, 40 tests |
| `apps/api/src/modules/match/match.service.ts` | Match CRUD + scoring | VERIFIED | 594 lines; 11 methods including `submitBattlefieldSelection`, `revealBattlefields`, `getById`, `history` |
| `apps/api/src/modules/match/match.gateway.ts` | Socket.IO gateway | VERIFIED | 197 lines; 7 event handlers; `this.matchService` injected and used |
| `apps/api/src/modules/match/match.router.ts` | tRPC procedures | VERIFIED | 56 lines; 5 procedures: `create`, `join`, `getState`, `getById`, `history` |
| `apps/api/src/modules/news/news.service.ts` | News scraper + cron | VERIFIED | 852 lines; 3-source scraper (riftbound.gg RSS/Sitemap/HTML, Riftbound Official, riftdecks.com); `onModuleInit` fire-and-forget after 3s; `syncCron` every 4h; `upsertArticles` with dedup; `getLatest`, `getCount`, `getSyncStatus` |
| `apps/api/src/modules/news/news.router.ts` | tRPC news endpoint | VERIFIED | `getLatest` + `getCount` + `getSyncStatus` publicProcedures; `triggerSync` protectedProcedure (fire-and-forget) |
| `apps/web/src/app/(dashboard)/match/new/page.tsx` | Match setup wizard with deck selection | VERIFIED | 969 lines; 9-step wizard; `trpc.deck.list.useQuery` at line 215; `trpc.deck.getById.useQuery` at line 221; `battlefieldCards` state wired to BattlefieldSelection |
| `apps/web/src/app/match/[code]/page.tsx` | Public join page | VERIFIED | Public route outside dashboard group; 28 lines |
| `apps/web/src/app/match/[code]/battlefield-selection.tsx` | Secret BF selection | VERIFIED | 500 lines; emits `battlefield:submit`; listens for `battlefield:reveal`; CSS flip animation |
| `apps/web/src/app/match/[code]/guest-deck-builder.tsx` | Guest deck builder with champion zone | VERIFIED | 808 lines; 2-step flow (legend -> build); `addCard` assigns `zone='champion'` for first Champion Unit; duplicate guard; visible champion slot with card art in deck panel |
| `apps/web/src/lib/match-socket.ts` | Socket.IO client singleton | VERIFIED | Exports `getMatchSocket`, `disconnectMatchSocket` |
| `apps/web/src/components/match-qr-code.tsx` | QR code component | VERIFIED | react-qr-code SVG |
| `apps/web/src/hooks/use-match-socket.ts` | Socket.IO React hook | VERIFIED | Exports `useMatchSocket`; exposes `tapBattlefield` emit helper |
| `apps/web/src/app/match/[code]/match-board.tsx` | Match gameplay view with play mat layout | VERIFIED | 917 lines; `VerticalScoreTracker` component inline (lines 67-95); `OpponentBoard` component (lines 196-318); per-player Legend/Champion zone slots; Row 1/2/3 play mat structure; battlefield DropZones with deployed unit display; gold/navy color scheme |
| `apps/web/src/app/match/[code]/battlefield-zone.tsx` | Tappable BF component | VERIFIED | `onTap(index)` callback |
| `apps/web/src/app/match/[code]/turn-controls.tsx` | ABCD phase + turn controls | VERIFIED | Exists |
| `apps/web/src/app/match/[code]/turn-log.tsx` | Collapsible history panel | VERIFIED | Exists |
| `apps/web/src/app/match/[code]/match-end-overlay.tsx` | Win celebration | VERIFIED | Dynamic `import('canvas-confetti')` |
| `apps/web/src/app/(dashboard)/match/page.tsx` | Match history list | VERIFIED | 193 lines; `trpc.match.history.useInfiniteQuery`; links to `/match/history/${match.id}` |
| `apps/web/src/app/(dashboard)/match/history/[id]/page.tsx` | Match detail view | VERIFIED | 357 lines; `trpc.match.getById.useQuery` |
| `apps/web/src/app/(dashboard)/news-feed.tsx` | News feed component | VERIFIED | `trpc.news.getLatest.useQuery`; expand/collapse per card; 5 source color variants |
| `apps/web/src/app/(dashboard)/page.tsx` | Dashboard home | VERIFIED | Imports and renders `<NewsFeed />` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/shared/src/schemas/match.schema.ts` | `apps/api/src/modules/match/match-scoring.ts` | shared MatchState type | WIRED | `match-scoring.ts` imports `MatchState` from `@la-grieta/shared` |
| `apps/api/src/modules/match/match.gateway.ts` | `apps/api/src/modules/match/match.service.ts` | DI injection | WIRED | `this.matchService` used in all 7 event handlers |
| `apps/api/src/modules/match/match.service.ts` | `apps/api/src/modules/match/match-scoring.ts` | pure function imports | WIRED | Imports and calls all 7 scoring functions |
| `apps/api/src/modules/news/news.service.ts` | `packages/db/src/schema/news-articles.ts` | Drizzle query | WIRED | `newsArticles` used in insert, orderBy, and from clauses |
| `apps/api/src/app.module.ts` | `MatchModule` + `NewsModule` | imports array | WIRED | Both modules in AppModule imports |
| `apps/api/src/trpc/trpc.router.ts` | `MatchRouter` + `NewsRouter` | buildRouter | WIRED | `match: this.matchRouter.buildRouter()`, `news: this.newsRouter.buildRouter()` |
| `apps/web/src/app/(dashboard)/match/new/page.tsx` | `trpc.deck.list` | useQuery step 5 | WIRED | `trpc.deck.list.useQuery({ limit: 50 }, { enabled: step >= 5 })` at line 215 |
| `apps/web/src/app/(dashboard)/match/new/page.tsx` | `trpc.deck.getById` | useQuery after deck select | WIRED | `trpc.deck.getById.useQuery({ id: selectedDeckId! }, { enabled: !!selectedDeckId })` at line 221 |
| `apps/web/src/app/(dashboard)/match/new/page.tsx` | `battlefieldCards` -> BattlefieldSelection | useEffect + prop | WIRED | `useEffect` populates `battlefieldCards` from deck cards filtered by `zone === 'battlefield'`; passed as prop to BattlefieldSelection |
| `apps/web/src/app/(dashboard)/match/new/page.tsx` | `match.create` tRPC | useMutation | WIRED | `trpc.match.create.useMutation` at line 202 |
| `apps/web/src/app/match/[code]/guest-deck-builder.tsx` | champion zone assignment | addCard logic | WIRED | `if (card.cardType === 'Champion Unit') { zone = hasChampion ? 'main' : 'champion'; }` at lines 452-454; duplicate prevented |
| `apps/web/src/app/match/[code]/guest-deck-builder.tsx` | validation.hasChampion | championEntry check | WIRED | `const hasChampion = !!championEntry; const mainOk = mainCount === MAIN_DECK_SIZE && hasChampion;` (lines 436-437) |
| `apps/web/src/app/match/[code]/match-board.tsx` | `VerticalScoreTracker` | inline component | WIRED | Used at lines 607 (opponent) and 621 (me) in stacked left panel |
| `apps/web/src/app/match/[code]/match-board.tsx` | `useMatchSocket` hook | hook consumption | WIRED | `import { useMatchSocket }` at line 19; destructured at line 320 |
| `apps/web/src/app/match/[code]/match-board.tsx` | battlefield DropZones | drag-drop context | WIRED | `battlefield-0/1/2` ZoneIds added to `drag-drop-context.tsx`; `moveToField` called in drop handler |
| `apps/web/src/app/match/[code]/join-form.tsx` | `match.join` tRPC | useMutation | WIRED | `trpc.match.join.useMutation` |
| `apps/web/src/app/match/[code]/battlefield-selection.tsx` | Socket.IO `battlefield:submit` | emit | WIRED | `socket.emit('battlefield:submit', ...)` |
| `apps/web/src/app/match/[code]/battlefield-selection.tsx` | Socket.IO `battlefield:reveal` | on listener | WIRED | `socket.on('battlefield:reveal', onReveal)` |
| `apps/web/src/hooks/use-match-socket.ts` | Socket.IO `battlefield:tap` | emit | WIRED | `socket.emit('battlefield:tap', ...)` in `tapBattlefield` |
| `apps/web/src/app/(dashboard)/match/page.tsx` | `match.history` tRPC | useInfiniteQuery | WIRED | `trpc.match.history.useInfiniteQuery` |
| `apps/web/src/app/(dashboard)/match/history/[id]/page.tsx` | `match.getById` tRPC | useQuery | WIRED | `trpc.match.getById.useQuery` |
| `apps/web/src/app/(dashboard)/news-feed.tsx` | `news.getLatest` tRPC | useQuery | WIRED | `trpc.news.getLatest.useQuery` |
| `apps/web/src/app/(dashboard)/page.tsx` | `news-feed.tsx` | component import | WIRED | `import { NewsFeed } from './news-feed'`; rendered in JSX |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| PTS-01 | 03-01, 03-02, 03-03, 03-07 | Create 1v1 match session (2 BFs, first to 8 pts) | SATISFIED | `createInitialState('1v1')` returns 2 BFs, winTarget=8; wizard creates match; deck selection step provides BF cards |
| PTS-02 | 03-01, 03-02 | Create 2v2 match session (3 BFs, first to 11 pts) | SATISFIED | `WIN_TARGET_2V2=11`, `BATTLEFIELDS_2V2=3`; wizard supports 2v2 format |
| PTS-03 | 03-01, 03-02, 03-03, 03-07 | Create FFA match session (3-4 players, 3 BFs, first to 8 pts) | SATISFIED | `WIN_TARGET_FFA=8`, `BATTLEFIELDS_FFA=3`; wizard supports FFA; guest builder handles champion detection |
| PTS-04 | 03-01, 03-02, 03-04 | Track battlefield control (who controls each BF) | SATISFIED | `cycleBattlefieldControl` in scoring engine; `BattlefieldZone` shows control state; real-time sync via Socket.IO |
| PTS-05 | 03-01, 03-02, 03-04, 03-06 | Auto-score +1 on conquest and +1 per controlled BF at turn start | SATISFIED | `scoreConquest` and `scoreBeginningPhase` called in `match.service.ts`; score flash animation in match-board |
| PTS-06 | 03-02, 03-03 | Opponent can join synced session by QR without an account | SATISFIED | `optionalAuthProcedure` on `match.join`; `match-qr-code.tsx` renders join URL QR; `/match/[code]` public route |
| PTS-07 | 03-02, 03-04 | Both players see real-time score updates | SATISFIED | Socket.IO gateway broadcasts `state:patch` to room; `useMatchSocket` listens and updates React state |
| PTS-08 | 03-05 | Authenticated users can view match history | SATISFIED | `match.history` rateLimitedProtectedProcedure; `(dashboard)/match/page.tsx` uses `useInfiniteQuery`; detail view at `match/history/[id]` |
| PLAT-02 | 03-02, 03-05 | News section displaying Riftbound community updates | SATISFIED | `NewsService` scrapes 3 sources on cron + startup; `news.getLatest` public endpoint; `NewsFeed` on dashboard home; dedicated `/news` page added |

**No orphaned requirements.** All 9 requirements claimed across Phase 03 plans are confirmed implemented.

---

## Anti-Patterns Found

No blockers or stubs found in any Phase 3 files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/match/[code]/match-board.tsx` | 177 | Comment "ZoneSlot — empty placeholder" | Info | Misleading comment — ZoneSlot is a legitimate visual empty-zone component (card-sized outlined slot with label), not a code stub |
| `apps/web/src/app/match/[code]/match-board.tsx` | 877 | Hand height 150px (working tree) vs 160px (HEAD commit aa11ffb) | Info | Unstaged pixel adjustment; non-functional |
| — | — | No TODOs, FIXMEs, empty returns, or placeholder implementations found | — | — |

**News scraper `return []` patterns**: The scraper strategies return empty arrays as legitimate fallthrough signals (RSS fails -> try Sitemap -> try HTML). These are correct control flow, not stubs.

---

## Human Verification Required

### 1. Full end-to-end match flow (two devices/browsers)

**Test:** Open the app. Create a new 1v1 Synced match as an authenticated user. At step 5 (deck selection), select a deck that has battlefield zone cards. Proceed through QR share (step 6). On a second device/browser, navigate to `/match/[code]`. Enter a guest name, select Player. Walk through the guest deck builder: pick a Legend, click "Continue to Build Deck", then on the build step add a Champion Unit from the main tab (verify it appears in the left deck panel with a champion slot showing card art), then add ~40 main cards and 12 runes and 3 battlefield cards, then confirm. Both devices should reach battlefield selection. Secretly pick different battlefield cards on each device. Confirm on both. Verify simultaneous card flip animation. Play the match: tap a battlefield, advance phases (A->B->C->D), advance turn. Verify +1 awarded when advancing to B phase for a controlled battlefield. At 7 points, attempt to win without holding a battlefield — verify 8th point rule toast fires. Win legitimately and verify confetti + victory chime overlay.

**Expected:** All steps flow without errors. Real-time sync works. 8th point rule correctly blocks invalid win. Confetti fires on win overlay.

**Why human:** Multi-device Socket.IO round-trips, CSS flip animation timing, AudioContext chime, haptic vibrate, and toast appearance all require a running browser.

### 2. Dashboard home and /news page news feed

**Test:** Restart the API server. Navigate to the dashboard home page (authenticated). Check if news articles appear. If empty, call the `news.triggerSync` tRPC mutation (protectedProcedure), then refresh. Also navigate to the new `/news` page and verify articles appear there too. Check articles from all three sources: riftbound.gg, Riftbound Official, and riftdecks.com.

**Expected:** News cards appear with thumbnail, title, source badge in the correct color (amber for Riftbound Official, blue for riftbound.gg, purple for riftdecks.com), relative date, and truncated excerpt. Clicking the card header expands it to show full excerpt. Each card has a link button that opens the full article in a new tab.

**Why human:** Requires live network requests to three external URLs. RSS/Sitemap/HTML cascade fallback correctness and Cheerio selector accuracy require a running server with real network access.

### 3. Match history and detail view

**Test:** After completing a match, navigate to the Match tab. Verify the completed match appears in the list with format badge (e.g., "1v1"), opponent names, final score, duration, and win/loss indicator. Click the match row. Verify the detail page at `/match/history/[uuid]` shows: header with format badge and date, all players with final scores and color rings, scoring breakdown table (conquest points vs holding points), battlefield card names, and a turn-by-turn timeline.

**Expected:** History list shows the match. Detail view populates all sections correctly.

**Why human:** Requires completed match data in the database. Correctness of `computeScoringBreakdown` and `groupLogByTurn` display requires visual verification with real data.

### 4. Match tab icon visible in dashboard nav

**Test:** Open the app on a mobile browser or desktop. Look at the bottom navigation. Verify the Match tab shows a visible icon (two crossing lines with a central circle).

**Expected:** The IconMatch SVG icon renders at equal visual weight to the Collection, Decks, and Profile tab icons.

**Why human:** SVG stroke inheritance behavior is browser-dependent. Explicit `stroke="currentColor"` attributes were added to child elements but visual appearance requires a browser.

### 5. Guest deck builder Champion Unit detection and champion slot display

**Test:** Visit `/match/[code]` without logging in. Enter a name and select Player. Pick a Legend and click "Continue to Build Deck". In the build step, add a Champion Unit card. Verify: (a) the card appears in the left deck panel in a dedicated Champion slot with card art and name visible; (b) adding a second Champion Unit adds it to the main deck count instead; (c) removing the champion from the champion slot works via its X button. Build a valid deck and verify "Deck Ready — Continue" button enables.

**Expected:** First Champion Unit goes to champion zone with visible slot. Duplicate guard works. Validation requires and counts it.

**Why human:** Requires browser interaction with real Champion Unit card data. Visual champion slot rendering and button state require runtime observation.

### 6. Deck selection step populates battlefield cards (synced mode)

**Test:** As an authenticated user, start a new synced match. Complete format (1v1), mode (synced), player name, first player. Arrive at step 5. Verify your decks are listed. Select a deck with battlefield zone cards. Verify the match is created (loading spinner, then proceeds to QR step). Proceed to step 7 (battlefield selection). Verify the battlefield selection screen shows actual battlefield cards from your deck rather than an empty grid.

**Expected:** Deck list fetched via `trpc.deck.list`. Selected deck populates battlefield cards via `trpc.deck.getById` useEffect. BF zone cards extracted and passed to `BattlefieldSelection`.

**Why human:** Requires an authenticated user with decks containing battlefield zone cards in the database. The useEffect population of `battlefieldCards` state requires runtime verification.

### 7. Match board play mat layout and drag-drop verification

**Test:** Open an active match board. Verify the layout: (1) left panel with opponent score tracker (circles numbered 8 at top to 0 at bottom) above a gold divider line, my score tracker below; (2) battlefield columns spanning full row height — each with BF card art at top and a "drag unit here" drop area below; (3) Row 2 below — Champion/Legend zone slots at left, wide droppable base zone in center (showing "play cards here, drag to battlefield"), main deck pile at right showing card count; (4) Row 3 — rune deck pile left, channeled runes center, trash drop zone right; (5) hand section (150px) at bottom with draggable cards. Play a card from hand to base zone. Then drag it from base zone to a battlefield column — verify it appears as a deployed unit under that battlefield.

**Expected:** Symmetric play mat structure. Score trackers show correct counts. Drag-drop from base to battlefield-0/1/2 deploys the unit under the battlefield card. All zones visible on 375px-wide screen without horizontal scrolling.

**Why human:** Visual layout, drag-drop behavior for new base -> battlefield-N drop target, and vertical proportions require a running browser. The `moveToField` call and `currentFieldUnits` state need interactive verification.

---

## Verification History

| Verification | Date | Status | Score | Notes |
|---|---|---|---|---|
| Initial | 2026-03-12 | human_needed | 16/16 | All automated checks passed; human tests required |
| Re-verification 1 | 2026-03-13 | human_needed | 21/21 | Plan 07 gap closure: deck selection step, champion unit detection, play mat layout; 5 new truths added |
| Re-verification 2 | 2026-03-14 | human_needed | 21/21 | Regression check after 3 Phase 2 commits; no Phase 3 files touched; no regressions |
| Re-verification 3 | 2026-03-15 | human_needed | 21/21 | Commit aa11ffb: news scraper rewrite (3 sources, RSS/Sitemap/HTML cascade), guest champion slot hardening, match board play mat restructure; description mismatch on Truth 20 (score tracker layout changed from flanking to stacked); no functional regressions |

---

_Verified: 2026-03-15T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Regression check after commit aa11ffb (news feed scraper, guest champion flow, hand section height / match board restructure)_
