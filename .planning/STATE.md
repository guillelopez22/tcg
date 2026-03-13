---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 03-03-PLAN.md — Phase 03 Plan 03 match setup flow UI complete
last_updated: "2026-03-13T03:20:56.130Z"
last_activity: 2026-03-11 — Roadmap created, 42 requirements mapped across 5 phases
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 20
  completed_plans: 18
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 01.1-03-PLAN.md — Phase 01.1 Collection UX Polish complete
last_updated: "2026-03-12T18:01:17.417Z"
last_activity: 2026-03-11 — Roadmap created, 42 requirements mapped across 5 phases
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 01-05-PLAN.md — Phase 01 Collection Tracker complete
last_updated: "2026-03-12T05:26:26.256Z"
last_activity: 2026-03-11 — Roadmap created, 42 requirements mapped across 5 phases
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Players can digitize their entire Riftbound card collection and use that data to build decks, find trades, and track what they're hunting
**Current focus:** Phase 1 — Collection Tracker

## Current Position

Phase: 1 of 5 (Collection Tracker)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-11 — Roadmap created, 42 requirements mapped across 5 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 12 | 3 tasks | 23 files |
| Phase 01 P02 | 14 | 2 tasks | 14 files |
| Phase 01 P03 | 10 | 2 tasks | 11 files |
| Phase 01 P04 | 25 | 3 tasks | 13 files |
| Phase 01 P05 | 17 | 2 tasks | 17 files |
| Phase 01.1 P01 | 8 | 2 tasks | 8 files |
| Phase 01.1 P02 | 4 | 2 tasks | 1 files |
| Phase 01.1 P03 | 7 | 2 tasks | 5 files |
| Phase 01.2-smart-deck-builder P01 | 4 | 2 tasks | 9 files |
| Phase 01.2 P02 | 17 | 3 tasks | 17 files |
| Phase 01.2 P04 | 6 | 2 tasks | 7 files |
| Phase 01.2-smart-deck-builder P03 | 15 | 2 tasks | 2 files |
| Phase 02 P01 | 8 | 2 tasks | 24 files |
| Phase 02 P02 | 6 | 3 tasks | 6 files |
| Phase 02 P03 | 2 | 2 tasks | 2 files |
| Phase 03 P01 | 18 | 2 tasks | 16 files |
| Phase 03 P02 | 13 | 2 tasks | 16 files |
| Phase 03 P03 | 10 | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Collection Tracker ships first — everything downstream (marketplace, want-match, deck buildability) depends on correct multi-copy schema from migration zero. UNIQUE(user_id, card_id) constraint must NOT be used.
- [Init]: Camera scanning uses perceptual hashing (blockhash-js client + sharp-phash server) — always requires confirmation step, never auto-adds. Manual search is co-equal entry point.
- [Init]: WhatsApp template approval must be submitted during Phase 4 — 2-4 week phone warming period is critical path for Phase 5.
- [Phase 01]: Per-copy model: each collection row is one physical copy, no quantity column, upsert logic removed from service
- [Phase 01]: next-intl uses cookie-based locale (no URL prefix), ES file uses EN placeholders for now
- [Phase 01]: Migration applied via direct SQL script (migrate-01-01.cjs) due to drizzle-kit interactive push limitation
- [Phase 01]: R2Service injected as interface via R2_TOKEN — keeps CollectionService testable without S3 credentials; CoreModule creates the concrete wrapper
- [Phase 01]: Wishlist toggle uses check-then-insert/delete pattern; unique index on (userId, cardId, type) in DB enforces data integrity
- [Phase 01]: addBulk returns Collection[] array (not { count }) — success toast uses data.length
- [Phase 01]: PhotoUpload uses XMLHttpRequest instead of fetch for real upload progress events
- [Phase 01]: NCC_IDENTIFY_THRESHOLD = 0.93 exported as named constant in scanner.service.ts for testability
- [Phase 01]: identify() filters at 0.93 server-side; displayPct = Math.round(((score-0.3)/0.7)*100) computed per match
- [Phase 01]: ScannerOrchestrator lifts session state; CardScanner receives props (no auto-add enforced at component boundary)
- [Phase 01]: recharts label prop uses PieLabelRenderProps type — use null-coalescing in label renderer for v3 compatibility
- [Phase 01]: Language toggle reloads page after setting locale cookie — simplest approach for next-intl cookie-based locale without URL prefix
- [Phase 01]: Per-list visibility uses local React state + bulk wishlist.update sequential mutations — no new bulk API endpoint needed
- [Phase 01]: Riftdecks.com scraper reads tier badge CSS classes (not text content) to determine tier letter — text was empty, classes encode S/A/B/C
- [Phase 01]: Deck-sync cron module added with @nestjs/schedule running at 0 6 * * * and 0 18 * * * — keeps trending decks fresh without manual intervention
- [Phase 01]: Trending Decks tab added to /decks page; deck-list.tsx refactored to tabbed layout: My Decks | Trending
- [Phase 01.1]: LEFT JOIN (not INNER JOIN) for card_prices in list queries — not all cards have price data
- [Phase 01.1]: getLegends() caches in Redis at cache:card_legends with 1h TTL — legends only change on card sync
- [Phase 01.1]: DeckWithCreator type does not need explicit tier field — Deck already includes it via schema inference
- [Phase 01.1]: Optimistic delta map (Map<cardId,number>) tracks count changes separately from tRPC cache — avoids setData complexity on infinite queries
- [Phase 01.1]: Inline absolute popovers for variant/copy pickers — no portal, card tile is positioning context
- [Phase 01.1]: Hover reveal uses md:opacity-0 md:group-hover:opacity-100 (md breakpoint) — always visible on mobile
- [Phase 01.1]: undo toast dismisses itself when undo is clicked via toast.dismiss(toastId)
- [Phase 01.2-smart-deck-builder]: Zone as third component of deck_cards unique index: (deck_id, card_id, zone) allows same card in both main and sideboard
- [Phase 01.2-smart-deck-builder]: validateDeckFormat is pure (no Node/browser APIs) enabling isomorphic use on server and client
- [Phase 01.2-smart-deck-builder]: MAX_COPIES_PER_CARD=3 imported from @la-grieta/shared in deck.service.ts — single source of truth for Riftbound copy limits
- [Phase 01.2-smart-deck-builder]: validateCardEntriesBasic (sync, no DB) runs before validateCardIdsExist — BAD_REQUEST thrown without DB query
- [Phase 01.2-smart-deck-builder]: computeAnalytics lives in packages/shared so Plan 04 UI can import it without server dependencies
- [Phase 01.2-smart-deck-builder]: Stale compiled .js artifacts in packages/shared shadow new TS exports — all stale files must be updated after adding new exports to .ts source
- [Phase 01.2]: computeAnalytics exported from @la-grieta/shared — was missing from index despite .ts file existing since Plan 02
- [Phase 01.2]: energyCost added to DeckCardWithCard type and getById DB select — required by computeAnalytics for energy curve charts
- [Phase 01.2]: BuildabilitySection uses sequential wishlist.toggle mutations for add-missing — no bulk endpoint needed, matches existing API surface
- [Phase 01.2-smart-deck-builder]: validateDeckFormat called client-side on every deck state change — identical to server, eliminates divergence risk
- [Phase 01.2-smart-deck-builder]: choose-build-mode wizard step: owned_first sorts card pool by ownershipSet before rarity; best_fit uses pure rarity order
- [Phase 02-01]: drawHand uses Fisher-Yates shuffle (Math.random) adequate for preview hands
- [Phase 02-01]: resolveShareCode registered as tRPC QUERY (read-only) not mutation — callers use .useQuery()
- [Phase 02-01]: importFromText does NOT create deck — returns resolved+unmatched for client preview first
- [Phase 02]: HandSimulator renders below tabs on all deck detail views; uses drawHand() from @la-grieta/shared, main-zone only, no probability stats
- [Phase 02]: resolveShareCode called via utils.deck.resolveShareCode.fetch() (tRPC query .fetch()) in import modal — not useMutation
- [Phase 02]: Import modal always shows preview before deck.create — no direct import, no merge with existing decks
- [Phase 02-03]: Community tab renders CommunityDecks component; browse endpoint filters by isPublic=true (all public decks shown in community tab); trending tab still filters by [RD] prefix
- [Phase 02-03]: useDebounce hook implemented inline in community-decks.tsx (300ms) — no shared utility file needed at this stage
- [Phase 03]: matchFormatEnum/matchStatusEnum/playerRoleEnum co-located with their tables (not in global enums.ts) — keeps match module self-contained
- [Phase 03]: validateWinCondition takes conqueredAllThisTurn bool from caller rather than re-deriving — simpler contract, avoids coupling to state history
- [Phase 03]: Pure scoring engine in match-scoring.ts with no I/O — enables isomorphic use and straightforward TDD
- [Phase 03]: MatchSummary type includes both id and sessionId — buildPaginatedResult requires T extends { id: string } for cursor pagination
- [Phase 03]: vi.mock('@la-grieta/db') required in tests for drizzle column stubs — column objects not available without real DB in vitest context
- [Phase 03]: @nestjs/websockets pinned to ^10.0.0 matching @nestjs/common version — v11 would cause peer dependency mismatch
- [Phase 03]: Socket.IO singleton in match-socket.ts: getMatchSocket(code) reconnects/reuses to prevent duplicate connections on React re-renders
- [Phase 03]: Card flip reveal uses CSS rotateY(180deg) with transformStyle preserve-3d — no external animation library
- [Phase 03]: Public /match/[code] route outside (dashboard) group — no auth guard, accessible without login

### Roadmap Evolution

- Phase 01.1 inserted after Phase 1: Collection UX Polish (URGENT) — deck wizard, +/- steppers on collection grid, tradelist asking price editor, wantlist/tradelist remove buttons
- Phase 01.2 inserted after Phase 1: Smart Deck Builder (URGENT)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5 prerequisite]: Meta Business Account registration for Honduras must be verified early — country restrictions are unknown. Start this before Phase 4 ends.
- [Phase 5 prerequisite]: WhatsApp Cloud API pricing beyond 1,000 conversations/month must be validated against projected usage before committing to the marketplace approach.
- [Phase 1 risk]: Camera scanning accuracy on Riftbound-specific card art (especially Alt-Art variants) has not been empirically tested. Measure hash accuracy on 20-30 sample cards during Phase 1 before committing to hash-only matching.
- [Phase 3 risk]: WebSocket state loss on iOS mobile browsers requires 15-second heartbeat + full-state reconnect — must be implemented, not deferred.

## Session Continuity

Last session: 2026-03-13T03:20:56.126Z
Stopped at: Completed 03-03-PLAN.md — Phase 03 Plan 03 match setup flow UI complete
Resume file: None
