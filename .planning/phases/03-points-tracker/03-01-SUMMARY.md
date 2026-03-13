---
phase: 03-points-tracker
plan: 01
subsystem: database
tags: [drizzle, postgresql, zod, tdd, vitest, match-scoring, riftbound-rules]

# Dependency graph
requires:
  - phase: 01-collection-tracker
    provides: Drizzle schema patterns, pgEnum usage, relations.ts pattern
  - phase: 01.2-smart-deck-builder
    provides: shared package compiled artifact update pattern, Zod schema conventions

provides:
  - Drizzle tables: match_sessions, match_players, news_articles
  - Migration SQL: 0002_match_and_news.sql
  - Shared Zod schemas: matchFormatSchema, matchCreateSchema, matchJoinSchema, matchStateSchema, matchHistorySchema
  - Shared constants: WIN_TARGET_*, BATTLEFIELDS_*, MATCH_PHASES, PLAYER_COLORS
  - Pure scoring engine: createInitialState, cycleBattlefieldControl, scoreConquest, scoreBeginningPhase, validateWinCondition, advancePhase, advanceTurn
  - 40 passing TDD tests covering all scoring rules

affects:
  - 03-02 (match service): imports MatchState, matchCreateSchema, scoring functions
  - 03-03 (WebSocket sync): imports matchStateSchema for validation
  - 03-04 (news module): imports newsArticles schema
  - 03-05 (UI): imports MATCH_PHASES, PLAYER_COLORS from @la-grieta/shared

# Tech tracking
tech-stack:
  added: []
  patterns:
    - pgEnum defined in dedicated schema file and imported via enums.ts or co-located
    - matchFormatEnum/matchStatusEnum/playerRoleEnum co-located with their tables (not in enums.ts) to keep match schemas self-contained
    - Pure scoring functions exported from match-scoring.ts (no class, no DI, no I/O)
    - TDD RED/GREEN cycle: test file committed first (FAIL), then implementation committed (PASS)

key-files:
  created:
    - packages/db/src/schema/match-sessions.ts
    - packages/db/src/schema/match-players.ts
    - packages/db/src/schema/news-articles.ts
    - packages/db/drizzle/0002_match_and_news.sql
    - packages/db/drizzle/meta/0002_snapshot.json
    - packages/shared/src/constants/match.constants.ts
    - packages/shared/src/schemas/match.schema.ts
    - packages/shared/src/schemas/news.schema.ts
    - apps/api/src/modules/match/match-scoring.ts
    - apps/api/__tests__/match-scoring.spec.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/relations.ts
    - packages/db/drizzle/meta/_journal.json
    - packages/shared/src/index.ts
    - packages/shared/src/index.js
    - packages/shared/src/index.d.ts

key-decisions:
  - "match_sessions.code is varchar(12) NOT unique key — 6-char display code (ABC-123) is derived from this; unique constraint on code column enforces join code uniqueness"
  - "matchFormatEnum/matchStatusEnum/playerRoleEnum co-located with their tables (not in global enums.ts) — keeps match module self-contained, easier to locate"
  - "BattlefieldControl type is union of 'uncontrolled' | 'contested' | string (playerId UUID) — avoids a dedicated contested enum, matches Zod discriminated union approach"
  - "validateWinCondition takes conqueredAllThisTurn bool parameter (caller-provided) rather than re-deriving from state — simplifies function contract and reduces coupling"
  - "createInitialState accepts optional overrides: Partial<MatchState> to support test setup without brittle fixture builders"
  - "Stale .js/.d.ts artifacts in packages/shared/src updated manually (not via tsc build) — consistent with Phase 01.2 decision"

patterns-established:
  - "Pure scoring engine pattern: all match logic in match-scoring.ts with no I/O, enables isomorphic use on server and future client"
  - "TDD flow: spec file committed first (RED), implementation committed second (GREEN), no separate REFACTOR needed"

requirements-completed: [PTS-01, PTS-02, PTS-03, PTS-04, PTS-05]

# Metrics
duration: 18min
completed: 2026-03-13
---

# Phase 03 Plan 01: Match Foundation Summary

**Drizzle DB schema (match_sessions/match_players/news_articles), shared Zod schemas, match constants, and pure TDD scoring engine implementing Riftbound battlefield-control rules with 40 passing tests**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-13T02:45:09Z
- **Completed:** 2026-03-13T03:03:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Three new Drizzle tables with proper indexes, FK cascade, and migration SQL
- Shared Zod schemas covering match create/join/state/history with inferred TypeScript types
- Match constants exported from @la-grieta/shared (WIN_TARGET, BATTLEFIELDS, MATCH_PHASES, PLAYER_COLORS)
- Pure scoring engine with 7 exported functions, all immutable, no I/O
- Full TDD cycle: 40 tests written first (RED), all 40 pass after implementation (GREEN)
- 8th point rule enforced: validateWinCondition blocks win if player holds no BF and did not conquer all

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema + shared schemas + constants** — `33b9597` (feat)
2. **Task 2 RED: failing tests for scoring engine** — `68d3df3` (test)
3. **Task 2 GREEN: implement scoring engine** — `7a2fa57` (feat)

**Plan metadata:** (docs commit follows this SUMMARY creation)

_Note: TDD tasks have multiple commits (test -> feat)_

## Files Created/Modified

- `packages/db/src/schema/match-sessions.ts` — matchSessions table, matchFormatEnum, matchStatusEnum
- `packages/db/src/schema/match-players.ts` — matchPlayers table, playerRoleEnum, FK to match_sessions
- `packages/db/src/schema/news-articles.ts` — newsArticles table with unique URL constraint
- `packages/db/drizzle/0002_match_and_news.sql` — Migration SQL with CREATE TYPE + CREATE TABLE + indexes
- `packages/db/drizzle/meta/0002_snapshot.json` — Drizzle snapshot for new tables
- `packages/db/drizzle/meta/_journal.json` — Updated with 0002 entry
- `packages/db/src/schema/index.ts` — Added exports for 3 new schema files
- `packages/db/src/relations.ts` — Added matchSessions <-> matchPlayers one-to-many
- `packages/shared/src/constants/match.constants.ts` — WIN_TARGET_*, BATTLEFIELDS_*, MATCH_PHASES, PLAYER_COLORS, UNCONTROLLED, CONTESTED
- `packages/shared/src/schemas/match.schema.ts` — matchFormatSchema, matchCreateSchema, matchJoinSchema, matchStateSchema, matchHistorySchema, BattlefieldControl, MatchState
- `packages/shared/src/schemas/news.schema.ts` — newsArticleSchema, newsListSchema
- `packages/shared/src/index.ts` — Added match.constants, match.schema, news.schema exports
- `packages/shared/src/index.js` — Updated stale CJS artifact
- `packages/shared/src/index.d.ts` — Updated stale type declaration artifact
- `apps/api/src/modules/match/match-scoring.ts` — Pure scoring engine (7 exported functions)
- `apps/api/__tests__/match-scoring.spec.ts` — 40 TDD tests (10 per major function group)

## Decisions Made

- `matchFormatEnum`, `matchStatusEnum`, `playerRoleEnum` co-located with their tables (not in global `enums.ts`) — keeps match module self-contained
- `BattlefieldControl` is a Zod union of `'uncontrolled' | 'contested' | string(UUID)` — avoids a dedicated enum, matches runtime flexibility for multi-player FFA
- `validateWinCondition` takes `conqueredAllThisTurn: boolean` from caller rather than re-deriving — simpler contract, avoids coupling to state history
- `createInitialState` accepts optional `overrides: Partial<MatchState>` — makes test setup readable without brittle fixture builders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — both TypeScript compilations passed cleanly, all 40 tests passed on first run after implementation.

## User Setup Required

None - no external service configuration required. Migration SQL exists at `packages/db/drizzle/0002_match_and_news.sql` and must be applied to the database when ready (using the existing `migrate.ts` pattern).

## Next Phase Readiness

- Plan 03-02 (match service + tRPC router) can import all types from `@la-grieta/shared` and use `match-scoring.ts` functions
- Migration SQL ready to apply: `packages/db/drizzle/0002_match_and_news.sql`
- `matchSessions` and `matchPlayers` tables ready for Drizzle queries in the match service

## Self-Check: PASSED

All 10 required files exist. All 3 task commits verified in git log (33b9597, 68d3df3, 7a2fa57).

---
*Phase: 03-points-tracker*
*Completed: 2026-03-13*
