---
phase: 03-points-tracker
plan: 06
subsystem: ui, api
tags: [svg, deck-import, zone-correction, news, trpc, nestjs]

# Dependency graph
requires:
  - phase: 03-points-tracker
    provides: match system, news module, deck import system

provides:
  - IconMatch SVG with explicit stroke attributes on all child elements
  - importFromText zone correction using getZoneForCardType after DB resolution
  - News module startup sync via OnModuleInit
  - COALESCE ordering in getLatest for null-safe publishedAt
  - triggerSync protectedProcedure mutation on news router

affects: [deck-import, news-feed, dashboard-nav]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zone correction pattern: apply getZoneForCardType post-resolution, use derivedZone !== 'main' ? derivedZone : existing to preserve user zones"
    - "OnModuleInit for eager startup sync without waiting for cron schedule"

key-files:
  created: []
  modified:
    - apps/web/src/components/dashboard-nav.tsx
    - apps/api/src/modules/deck/deck.service.ts
    - apps/api/src/modules/news/news.service.ts
    - apps/api/src/modules/news/news.router.ts
    - apps/api/__tests__/deck.service.spec.ts

key-decisions:
  - "getZoneForCardType returns 'main' for Champion Unit by design — Champion Units can be in main OR champion zone, so zone correction preserves parser zone for Champion Units"
  - "importFromText zone correction runs after all name resolutions (single buildCardTypeMap call) for efficiency"
  - "OnModuleInit syncCron call is wrapped inside the existing isSyncing guard — no double-sync risk"

patterns-established:
  - "Zone correction in importFromText mirrors setCards pattern: derivedZone !== main ? derivedZone : c.zone"

requirements-completed:
  - PTS-05
  - DECK-05

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 03 Plan 06: UAT Gap Closure (Icon, Deck Import, News) Summary

**IconMatch SVG stroke fix, importFromText zone correction for Rune/Legend/Battlefield cards, and news service startup sync with triggerSync mutation**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-13T08:10:00Z
- **Completed:** 2026-03-13T08:25:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Match tab icon now renders visible crossed-sword design on all browsers (explicit stroke/strokeWidth on SVG child elements)
- Deck import no longer inflates main zone count: Legend, Rune, and Battlefield cards are corrected to their canonical zones after DB resolution
- News feed populates on server startup without waiting 4 hours for the cron schedule
- Manual triggerSync mutation available for authenticated users to force a news refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix IconMatch SVG and deck import zone correction** - `ab39bac` (fix)
2. **Task 2: Add news manual sync endpoint and startup trigger** - `9b4b294` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/src/components/dashboard-nav.tsx` - Added explicit stroke/strokeWidth to line and circle in IconMatch
- `apps/api/src/modules/deck/deck.service.ts` - Zone correction block after name resolution in importFromText
- `apps/api/src/modules/news/news.service.ts` - OnModuleInit, sql import, COALESCE ordering in getLatest
- `apps/api/src/modules/news/news.router.ts` - triggerSync protectedProcedure mutation
- `apps/api/__tests__/deck.service.spec.ts` - 5 new importFromText zone correction tests (71 total)

## Decisions Made
- `getZoneForCardType('Champion Unit')` returns `'main'` by design — Champion Units are regular main-deck cards; only one is manually designated as the champion zone entry. Zone correction preserves this: Champion Units stay in whatever zone the parser emits.
- Single `buildCardTypeMap` call after the for-loop (not inside) for efficiency — batch DB lookup instead of per-card lookup.
- `OnModuleInit` wraps the existing `syncCron()` which already handles the `isSyncing` guard, so no double-sync risk on startup.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial test for Champion Unit zone expected `'champion'`, but `getZoneForCardType` returns `'main'` for Champion Units by design. Updated test to reflect the correct behavior (Champion Units stay in main zone from the parser; only Legend/Rune/Battlefield are corrected).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three UAT issues (match icon, deck import zone count, news feed) resolved
- All 71 deck service tests passing
- News service will auto-sync on next API restart

---
*Phase: 03-points-tracker*
*Completed: 2026-03-13*
