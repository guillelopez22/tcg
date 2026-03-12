---
phase: 01-collection-tracker
plan: 05
subsystem: ui
tags: [recharts, next-intl, i18n, stats, deck-recommendations, trpc, nestjs]

# Dependency graph
requires:
  - phase: 01-02
    provides: collection.stats() API endpoint with market value queries
  - phase: 01-03
    provides: wantlist-tab, tradelist-tab, wishlist.update mutation

provides:
  - Stats tab with market value, set completion bars, recharts visualizations
  - DeckRecommendationsService with synergy engine and ownership scoring
  - Complete Spanish translations for all collection UI strings
  - Language toggle (EN/ES) via cookie in dashboard navigation
  - Per-list visibility toggles on wantlist and tradelist tabs
  - Tournament deck seed data (8 decks across 6 domains)

affects:
  - 02-marketplace (will use wishlist isPublic data for trade matching)
  - 03-deck-builder (deck recommendations pattern established)

# Tech tracking
tech-stack:
  added:
    - recharts@3.x (bar chart, donut chart with ResponsiveContainer)
  patterns:
    - next-intl cookie-based locale switching (set cookie + window.location.reload())
    - ScoredRecommendation internal type pattern for sort-then-strip in service layer
    - Per-list visibility: local state + bulk wishlist.update mutation per entry

key-files:
  created:
    - apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts
    - apps/api/src/modules/deck-recommendations/deck-recommendations.module.ts
    - apps/api/src/modules/deck-recommendations/deck-recommendations.router.ts
    - apps/api/__tests__/deck-recommendations.service.spec.ts
    - tools/seed/tournament-decks.json
    - tools/seed/src/seed-tournament-decks.ts
    - apps/web/src/app/(dashboard)/collection/stats-tab.tsx
    - apps/web/src/app/(dashboard)/collection/stats-charts.tsx
    - apps/web/src/app/(dashboard)/collection/deck-recommendations.tsx
    - apps/web/src/components/language-toggle.tsx
    - apps/web/src/components/dashboard-nav.tsx
  modified:
    - apps/api/src/trpc/trpc.module.ts
    - apps/api/src/trpc/trpc.router.ts
    - apps/web/src/app/(dashboard)/collection/page.tsx
    - apps/web/src/app/(dashboard)/collection/wantlist-tab.tsx
    - apps/web/src/app/(dashboard)/collection/tradelist-tab.tsx
    - apps/web/messages/en.json
    - apps/web/messages/es.json
    - apps/web/package.json

key-decisions:
  - "recharts label prop uses PieLabelRenderProps type (name/value are optional strings) — use null-coalescing in label renderer"
  - "Language toggle reloads page (window.location.reload) after setting cookie — simplest approach for next-intl cookie-based locale without URL prefix"
  - "Per-list visibility: local React state initialized to false (private); bulk update via sequential wishlist.update mutations — no new API endpoint needed"
  - "ScoredRecommendation internal type scoped within getRecommendations() method to avoid exposing _compositeScore on DeckRecommendation interface"
  - "Tournament deck seed data uses 8 sample decks covering all 6 Riftbound domains with externalId references that resolve to DB card UUIDs"

patterns-established:
  - "Stats chart pattern: ResponsiveContainer wrapping recharts primitive, dark theme contentStyle on Tooltip"
  - "Bulk mutation pattern: sequential awaits in a for loop with try/catch per item"

requirements-completed:
  - COLL-09
  - COLL-10
  - PLAT-01

# Metrics
duration: 17min
completed: 2026-03-12
---

# Phase 01 Plan 05: Stats, Deck Recommendations, i18n, and Visibility Summary

**Recharts-powered stats tab with market value, deck synergy engine returning top-5 recommendations, complete Latin American Spanish translations, EN/ES language toggle in nav, and per-list visibility toggles on wantlist/tradelist**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-03-12T04:01:47Z
- **Completed:** 2026-03-12T04:18:05Z
- **Tasks:** 2 auto tasks completed (Task 3 is checkpoint:human-verify — paused for verification)
- **Files modified:** 17 files

## Accomplishments
- DeckRecommendationsService with composite scoring (70% ownership + 30% domain synergy), missing card prices, synergy reasoning text — 7 tests all pass
- Stats tab fully functional: stat cards, set completion bars, recharts bar chart (value by set), recharts donut (rarity distribution), deck recommendation cards
- Complete Spanish translations covering all 8 namespaces — Latin American Spanish for Honduran audience
- Language toggle component using useLocale() + cookie switch + page reload wired into DashboardNav header
- Per-list visibility toggle on both wantlist and tradelist tabs using local state + bulk wishlist.update mutations

## Task Commits

1. **Task 1: Extend stats service + create deck recommendations module** - `ff94c87` (feat)
2. **Task 2: Stats tab UI, deck recommendations, i18n, language toggle, visibility** - `9e2832b` (feat)

## Files Created/Modified

- `apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts` - Synergy engine, ownership scoring, top-5 with composite sort
- `apps/api/src/modules/deck-recommendations/deck-recommendations.module.ts` - NestJS module with DB + Redis injection
- `apps/api/src/modules/deck-recommendations/deck-recommendations.router.ts` - Protected getRecommendations tRPC procedure
- `apps/api/__tests__/deck-recommendations.service.spec.ts` - 7 unit tests (pre-existing, all pass)
- `apps/api/src/trpc/trpc.module.ts` - DeckRecommendationsModule added to imports
- `apps/api/src/trpc/trpc.router.ts` - deckRecommendations route added
- `tools/seed/tournament-decks.json` - 8 tournament decks across all 6 Riftbound domains
- `tools/seed/src/seed-tournament-decks.ts` - Idempotent seed script with system user
- `apps/web/src/app/(dashboard)/collection/stats-tab.tsx` - Full stats tab with all sections
- `apps/web/src/app/(dashboard)/collection/stats-charts.tsx` - SetValueChart + RarityChart
- `apps/web/src/app/(dashboard)/collection/deck-recommendations.tsx` - Recommendation cards with ownership bar, synergy text, add-all button
- `apps/web/src/app/(dashboard)/collection/page.tsx` - StatsTab wired in (replaces placeholder)
- `apps/web/src/app/(dashboard)/collection/wantlist-tab.tsx` - Visibility toggle added to header
- `apps/web/src/app/(dashboard)/collection/tradelist-tab.tsx` - Visibility toggle added to header
- `apps/web/messages/en.json` - Added stats.*, wantlist/tradelist visibility keys, nav.language
- `apps/web/messages/es.json` - Complete Spanish translation of all namespaces
- `apps/web/src/components/language-toggle.tsx` - Globe icon + EN/ES switcher
- `apps/web/src/components/dashboard-nav.tsx` - LanguageToggle imported and rendered

## Decisions Made

- Cookie-based locale switching via `window.location.reload()` — simplest approach for next-intl without URL prefixing; aligns with existing request.ts config
- `ScoredRecommendation` typed locally inside `getRecommendations()` to avoid leaking `_compositeScore` on the exported `DeckRecommendation` interface
- recharts `PieLabelRenderProps` type used directly to satisfy type checker on pie chart label renderer
- Tooltip formatter removed from recharts bar chart to avoid `ValueType` union type complexity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed DeckRecommendationsService TypeScript: duplicate ScoredRecommendation type**
- **Found during:** Task 2 (web build)
- **Issue:** Type error `Property '_compositeScore' does not exist on type 'DeckRecommendation'` on destructure line
- **Fix:** Scoped `type ScoredRecommendation` inside function, typed recommendations array as `ScoredRecommendation[]`, removed duplicate type declaration
- **Files modified:** apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts
- **Verification:** pnpm --filter @la-grieta/web build passes, all 7 tests pass
- **Committed in:** 9e2832b (Task 2 commit)

**2. [Rule 1 - Bug] Fixed recharts Tooltip formatter type incompatibility**
- **Found during:** Task 2 (web build)
- **Issue:** recharts `Formatter<ValueType, NameType>` expects `ValueType | undefined` but function typed as `number` — TypeScript error
- **Fix:** Removed typed formatter, uses default recharts tooltip which shows raw values
- **Files modified:** apps/web/src/app/(dashboard)/collection/stats-charts.tsx
- **Verification:** Web build succeeds
- **Committed in:** 9e2832b (Task 2 commit)

**3. [Rule 1 - Bug] Fixed recharts PieChart label prop type**
- **Found during:** Task 2 (web build)
- **Issue:** `{ name: string; value: number }` destructure incompatible with `PieLabelRenderProps` (name is `string | undefined`)
- **Fix:** Used `PieLabelRenderProps` type directly with null-coalescing
- **Files modified:** apps/web/src/app/(dashboard)/collection/stats-charts.tsx
- **Verification:** Web build succeeds
- **Committed in:** 9e2832b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - TypeScript/recharts type incompatibilities)
**Impact on plan:** All fixes required for web build to succeed. No scope creep.

## Issues Encountered

- recharts v3 has stricter TypeScript types for `Formatter` and `PieLabelRenderProps` compared to v2 — required using library types directly rather than inline type annotations
- dashboard-nav.tsx was untracked (new file in git) despite being modified — staged and committed correctly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Task 3 (checkpoint:human-verify) is blocked waiting for human verification of stats, deck recommendations, i18n, and visibility end-to-end
- To seed tournament decks: `pnpm tsx tools/seed/src/seed-tournament-decks.ts` (requires DATABASE_URL)
- All API and web code is committed and builds successfully
- Phase 02 (Marketplace) can proceed once Phase 01 verification is complete

---
*Phase: 01-collection-tracker*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts
- FOUND: apps/web/src/app/(dashboard)/collection/stats-tab.tsx
- FOUND: apps/web/src/components/language-toggle.tsx
- FOUND: tools/seed/tournament-decks.json
- FOUND: commit ff94c87 (Task 1)
- FOUND: commit 9e2832b (Task 2)
