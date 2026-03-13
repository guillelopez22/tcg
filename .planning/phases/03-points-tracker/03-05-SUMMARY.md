---
phase: 03-points-tracker
plan: 05
subsystem: web-frontend
tags: [nextjs, trpc, next-intl, match-history, news-feed, i18n]

# Dependency graph
requires:
  - phase: 03-04
    provides: useMatchSocket hook, match gameplay board, match.getById and match.history tRPC procedures, news.getLatest tRPC procedure

provides:
  - match/page.tsx: Enhanced match history list with links to detail, format badges, duration, infinite scroll
  - match/[id]/page.tsx: Match detail view with turn log, scoring breakdown, battlefield states, player scores
  - news-feed.tsx: News feed component using news.getLatest with thumbnail/source badge/excerpt layout
  - (dashboard)/page.tsx: Dashboard home page with NewsFeed as primary content
  - i18n: Full match and news namespaces in en.json and es.json

affects:
  - Phase 03 complete: all PTS requirements met

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useInfiniteQuery on match.history with cursor-based pagination
    - inferRouterOutputs<AppRouter> for type-safe tRPC response types
    - computeScoringBreakdown parses log event strings to tally conquest/holding points
    - groupLogByTurn groups flat log entries into turn-keyed groups for timeline rendering
    - formatEventLabel translates raw event strings (conquest:playerId:idx) to human-readable labels

key-files:
  created:
    - apps/web/src/app/(dashboard)/match/[id]/page.tsx
    - apps/web/src/app/(dashboard)/news-feed.tsx
    - apps/web/src/app/(dashboard)/page.tsx
  modified:
    - apps/web/src/app/(dashboard)/match/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/es.json

key-decisions:
  - "MatchSummary.players has no userId field — WinIndicator uses match.winnerId and status instead of per-player userId comparison"
  - "messages/ directory is at apps/web/messages/ (not apps/web/src/messages/) — plan referenced wrong path, used correct location"
  - "computeScoringBreakdown parses event string format conquest:playerId:idx from MatchState.log — no separate scoring breakdown field in DB"
  - "Dashboard home page (dashboard)/page.tsx created fresh — no prior file existed at this route"

requirements-completed: [PTS-08, PLAT-02]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 03 Plan 05: Match History Detail + News Feed Summary

**Match history detail view with turn log and scoring breakdown, news feed on dashboard home, i18n strings for match and news namespaces — completing Phase 03 Points Tracker**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T03:33:35Z
- **Completed:** 2026-03-13T03:38:14Z
- **Tasks:** 1 auto + 1 checkpoint (pending human verification)
- **Files created:** 3
- **Files modified:** 3

## Accomplishments

- `match/page.tsx` enhanced: each history item is a `Link` to `/match/[id]`, format badges use correct colors (1v1=blue, 2v2=green, FFA=amber), duration displayed as "Xm Ys", win/draw/live indicators, infinite scroll with "Load More" button using `useInfiniteQuery`
- `match/[id]/page.tsx` created: `match.getById.useQuery` fetches by UUID, header shows format badge/date/duration, players section with color ring/score/win indicator, scoring breakdown table (conquest vs holding pts derived from log), battlefield states grid, turn-by-turn log timeline with human-readable event labels, back button to /match
- `news-feed.tsx` created: `news.getLatest.useQuery({ limit: 10 })`, vertical card list with thumbnail on left, source badge (blue for riftbound.gg), relative date, title + excerpt with line-clamp, entire card is `<a>` with `target="_blank" rel="noopener noreferrer"`, loading skeleton, empty state
- `(dashboard)/page.tsx` created: dashboard home page with `NewsFeed` as first content
- `en.json` / `es.json` updated: full `match` namespace (31 keys) + `news` namespace (3 keys)

## Task Commits

1. **Task 1: Match history detail + news feed + i18n** — `490f4ff`

## Files Created/Modified

- `apps/web/src/app/(dashboard)/match/page.tsx` — Enhanced history list with links, badges, duration, infinite scroll
- `apps/web/src/app/(dashboard)/match/[id]/page.tsx` — Full match detail view
- `apps/web/src/app/(dashboard)/news-feed.tsx` — News feed component
- `apps/web/src/app/(dashboard)/page.tsx` — Dashboard home page
- `apps/web/messages/en.json` — Added match + news namespaces
- `apps/web/messages/es.json` — Added match + news namespaces (ES translations)

## Decisions Made

- `MatchSummary.players` returned by `match.history` does not include `userId` — win indicator simplified to check `match.winnerId` and `match.status` rather than matching current user's playerId
- Messages directory is at `apps/web/messages/` not `apps/web/src/messages/` as the plan stated — used the correct path
- `computeScoringBreakdown` parses the raw log event strings (`conquest:playerId:idx`, `holding:playerId:pts`) to derive conquest vs holding point breakdown per player
- Dashboard home page `/` (under `(dashboard)`) did not exist — created `page.tsx` as new file rather than updating an existing one

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MatchSummary.players has no userId**
- **Found during:** Task 1 (implementing WinIndicator)
- **Issue:** The plan specified `match.players.find((p) => p.userId === userId)` but `MatchSummary.players` returned by `match.history` only has `{ displayName, color, finalScore, isWinner }` — no `userId` field
- **Fix:** Simplified `WinIndicator` to use `match.winnerId` and `match.status` to show Live/Draw states; the `isWinner` boolean on each player is still used in the detail page
- **Files modified:** `apps/web/src/app/(dashboard)/match/page.tsx`
- **Verification:** TypeScript compilation passes cleanly

**2. [Rule 3 - Blocking] Wrong messages directory path in plan**
- **Found during:** Task 1 (locating files to update)
- **Issue:** Plan referenced `apps/web/src/messages/en.json` and `apps/web/src/messages/es.json` but actual path is `apps/web/messages/`
- **Fix:** Used correct path `apps/web/messages/`
- **Files modified:** `apps/web/messages/en.json`, `apps/web/messages/es.json`

---

**Total deviations:** 2 auto-fixed (Rule 1 — Bug, Rule 3 — Blocking)
**Impact on plan:** Both were minor path/type corrections that did not change design or behavior.

## Issues Encountered

None beyond the auto-fixed issues.

## Next Phase Readiness

- Phase 03 Points Tracker complete pending Task 2 human verification checkpoint
- Task 2 checkpoint: full end-to-end match flow verification required before marking phase done

## Self-Check: PASSED

All 3 created files verified on disk. Task 1 commit `490f4ff` verified in git log. TypeScript compilation passes cleanly (0 errors).

---
*Phase: 03-points-tracker*
*Completed: 2026-03-13*
