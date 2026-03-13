---
phase: 03-points-tracker
plan: 02
subsystem: api-backend
tags: [nestjs, trpc, socket.io, websockets, cheerio, axios, match-service, news-service, cron]

# Dependency graph
requires:
  - phase: 03-01
    provides: matchSessions/matchPlayers/newsArticles DB schema, shared Zod schemas, match-scoring.ts pure engine, match constants

provides:
  - MatchService: create, join, getById, getFullState, applyBattlefieldTap, advancePhase, advanceTurn, pauseMatch, endMatch, submitBattlefieldSelection, revealBattlefields, history
  - MatchRouter: tRPC procedures (match.create, match.join, match.getState, match.getById, match.history)
  - MatchGateway: Socket.IO /match namespace with full event handling
  - NewsService: scrapeRiftboundGg, upsertArticles, getLatest, syncCron
  - NewsRouter: tRPC procedure news.getLatest
  - IoAdapter configured in main.ts for WebSocket support

affects:
  - 03-03 (mobile UI): consumes Socket.IO /match namespace events
  - 03-04 (web UI): consumes tRPC match.* and news.getLatest procedures
  - 03-05 (history detail view): uses match.getById

# Tech tracking
tech-stack:
  added:
    - "@nestjs/websockets@^10.0.0"
    - "@nestjs/platform-socket.io@^10.0.0"
    - "socket.io"
    - "axios"
    - "cheerio"
  patterns:
    - Socket.IO gateway on /match namespace with room-based broadcasting (room key = 6-char match code)
    - Secret pick + simultaneous reveal: pendingBattlefieldSelections stored server-side, revealed via battlefield:reveal broadcast when all players submit
    - 15-second heartbeat (pingInterval/pingTimeout) for iOS mobile browser stability
    - Module factory pattern: useFactory injects DB_TOKEN/REDIS_TOKEN via NestJS DI
    - vi.mock('@la-grieta/db') in tests to provide column stubs that satisfy drizzle eq()/inArray()

key-files:
  created:
    - apps/api/src/modules/match/match.service.ts
    - apps/api/src/modules/match/match.router.ts
    - apps/api/src/modules/match/match.gateway.ts
    - apps/api/src/modules/match/match.module.ts
    - apps/api/src/modules/news/news.service.ts
    - apps/api/src/modules/news/news.router.ts
    - apps/api/src/modules/news/news.module.ts
    - apps/api/__tests__/match.service.spec.ts
    - apps/api/__tests__/news.service.spec.ts
  modified:
    - apps/api/src/app.module.ts
    - apps/api/src/main.ts
    - apps/api/src/trpc/trpc.module.ts
    - apps/api/src/trpc/trpc.router.ts
    - apps/api/src/modules/match/match-scoring.ts
    - apps/api/package.json
    - pnpm-lock.yaml

key-decisions:
  - "MatchSummary type includes both id and sessionId fields — buildPaginatedResult requires T extends { id: string } for cursor pagination"
  - "vi.mock('@la-grieta/db') required in tests to provide column stubs — drizzle table column objects (e.g. matchSessions.code) are not accessible in vitest unless mocked, even though import resolves correctly"
  - "revealBattlefields uses inArray imported at top level (not dynamic require) — consistent with project no-any rule"
  - "Socket.IO adapter @nestjs/platform-socket.io pinned to ^10.0.0 matching @nestjs/common version — v11 peer dependency would misalign"

# Metrics
duration: 13min
completed: 2026-03-13
---

# Phase 03 Plan 02: Match Service + News Module Summary

**NestJS match service with full session lifecycle (create/join/score/reveal/history), Socket.IO gateway with secret battlefield selection and simultaneous reveal, news scraper with cheerio, and all tRPC endpoints registered**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-13T21:00:00Z
- **Completed:** 2026-03-13T21:13:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- MatchService with 11 methods covering full match lifecycle
- Socket.IO gateway on /match namespace: 7 event handlers, room-based broadcasting
- Secret pick + simultaneous reveal: submitBattlefieldSelection stores per-player selection server-side; revealBattlefields broadcasts revealed state only when all players submit
- 15-second heartbeat configured for iOS mobile browser WebSocket stability
- match.getById returns full match data by UUID for history detail view
- MatchRouter with 5 tRPC procedures including optionalAuthProcedure (guests can create/join)
- NewsService with scrapeRiftboundGg (cheerio HTML parsing), upsertArticles (onConflictDoUpdate dedup), syncCron (every 4h with isSyncing guard)
- NewsRouter with news.getLatest publicProcedure
- IoAdapter wired in main.ts
- 35 tests total: 20 match.service + 15 news.service, all passing
- TypeScript compilation passes cleanly

## Task Commits

1. **Task 1: Match module (service + router + gateway)** — `cb22f1a` (feat)
2. **Task 2: News module (scraper + cron + router)** — `be23c9e` (feat)

## Files Created/Modified

- `apps/api/src/modules/match/match.service.ts` — MatchService with 11 methods
- `apps/api/src/modules/match/match.router.ts` — tRPC match procedures
- `apps/api/src/modules/match/match.gateway.ts` — Socket.IO /match gateway
- `apps/api/src/modules/match/match.module.ts` — NestJS module wiring
- `apps/api/src/modules/news/news.service.ts` — NewsService with scraper + cron
- `apps/api/src/modules/news/news.router.ts` — tRPC news.getLatest
- `apps/api/src/modules/news/news.module.ts` — NestJS module wiring
- `apps/api/__tests__/match.service.spec.ts` — 20 tests
- `apps/api/__tests__/news.service.spec.ts` — 15 tests
- `apps/api/src/app.module.ts` — Added MatchModule, NewsModule
- `apps/api/src/main.ts` — Added IoAdapter for WebSocket support
- `apps/api/src/trpc/trpc.module.ts` — Added MatchModule, NewsModule
- `apps/api/src/trpc/trpc.router.ts` — Added match/news routers to buildRouter()
- `apps/api/src/modules/match/match-scoring.ts` — Fixed pre-existing TS errors (advancePhase/advanceTurn)
- `apps/api/package.json` — Added @nestjs/websockets, @nestjs/platform-socket.io, socket.io, axios, cheerio
- `pnpm-lock.yaml` — Updated lockfile

## Decisions Made

- `MatchSummary` type includes both `id` and `sessionId` for `buildPaginatedResult` compatibility
- `vi.mock('@la-grieta/db')` pattern: drizzle table column objects require mocking in vitest context — even with TypeScript alias resolution, `matchSessions.code` etc. needed stable column stubs to satisfy `eq()` calls
- `@nestjs/websockets` and `@nestjs/platform-socket.io` pinned to `^10.0.0` to match `@nestjs/common` version (v11 would cause peer dependency mismatch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript errors in match-scoring.ts**
- **Found during:** TypeScript compilation verification
- **Issue:** `advancePhase` returned `MatchPhaseInput | undefined` (index signature); `advanceTurn` assigned `string | undefined` to `activePlayerId`
- **Fix:** Added `?? 'A'` fallback to advancePhase; used `as string` assertion in advanceTurn (index is modulo-bounded so always valid)
- **Files modified:** `apps/api/src/modules/match/match-scoring.ts`
- **Commit:** cb22f1a (included in Task 1 commit)

**2. [Rule 3 - Blocking] vi.mock pattern required for drizzle table stubs in tests**
- **Found during:** Task 1 test execution
- **Issue:** `matchSessions.code`, `matchPlayers.userId`, `newsArticles.publishedAt` etc. were undefined when accessed via `eq()` in vitest — drizzle column objects aren't available without a real DB connection in test context
- **Fix:** Added `vi.mock('@la-grieta/db')` with stable column stubs in both spec files
- **Files modified:** `apps/api/__tests__/match.service.spec.ts`, `apps/api/__tests__/news.service.spec.ts`

## Self-Check: PASSED

All 9 new files exist. Both task commits verified in git log (cb22f1a, be23c9e). TypeScript compilation passes. 35 tests pass.

---
*Phase: 03-points-tracker*
*Completed: 2026-03-13*
