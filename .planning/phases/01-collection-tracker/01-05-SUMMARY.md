---
phase: 01-collection-tracker
plan: 05
subsystem: ui
tags: [recharts, next-intl, i18n, stats, deck-recommendations, trpc, nestjs, cheerio, cron, riftdecks]

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
  - Riftdecks.com scraper library with cheerio (tier list, champion decks, tournament decks)
  - Standalone sync-riftdecks.ts script for manual upsert
  - Deck-sync cron module (6AM/6PM twice-daily) — keeps trending decks fresh
  - Trending Decks tab on /decks page with import and wishlist-missing actions

affects:
  - 02-marketplace (will use wishlist isPublic data for trade matching)
  - 03-deck-builder (deck recommendations pattern established)

# Tech tracking
tech-stack:
  added:
    - recharts@3.x (bar chart, donut chart with ResponsiveContainer)
    - cheerio (HTML parsing for riftdecks.com scraper)
    - @nestjs/schedule (cron scheduling for deck-sync module)
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
    - apps/api/src/modules/deck-sync/deck-sync.module.ts
    - apps/api/src/modules/deck-sync/deck-sync.service.ts
    - apps/api/src/modules/deck-sync/deck-sync.router.ts
    - tools/seed/tournament-decks.json
    - tools/seed/src/seed-tournament-decks.ts
    - tools/seed/src/scrape-riftdecks.ts
    - tools/seed/src/sync-riftdecks.ts
    - apps/web/src/app/(dashboard)/collection/stats-tab.tsx
    - apps/web/src/app/(dashboard)/collection/stats-charts.tsx
    - apps/web/src/app/(dashboard)/collection/deck-recommendations.tsx
    - apps/web/src/app/(dashboard)/decks/trending-decks.tsx
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
  - "Riftdecks.com scraper reads tier badge CSS classes (not text content) to determine tier letter — text was empty, classes encode S/A/B/C"
  - "Deck-sync cron module uses @nestjs/schedule with two cron expressions: 0 6 * * * and 0 18 * * *"
  - "Trending Decks tab added to /decks page; deck-list.tsx refactored to tabbed layout (My Decks | Trending)"

patterns-established:
  - "Stats chart pattern: ResponsiveContainer wrapping recharts primitive, dark theme contentStyle on Tooltip"
  - "Bulk mutation pattern: sequential awaits in a for loop with try/catch per item"

requirements-completed:
  - COLL-09
  - COLL-10
  - PLAT-01

# Metrics
duration: 90min
completed: 2026-03-12
---

# Phase 01 Plan 05: Stats, Deck Recommendations, i18n, and Visibility Summary

**Recharts stats tab with market value + synergy-scored deck recommendations, complete ES translations, EN/ES language toggle, per-list visibility toggles, and twice-daily riftdecks.com cron sync feeding a Trending Decks tab**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-03-12T02:30:00Z
- **Completed:** 2026-03-12T04:19:54Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint approved)
- **Files modified:** 28 files

## Accomplishments
- DeckRecommendationsService with composite scoring (70% ownership + 30% domain synergy), missing card prices, synergy reasoning text — 7 tests all pass
- Stats tab fully functional: stat cards, set completion bars, recharts bar chart (value by set), recharts donut (rarity distribution), deck recommendation cards
- Complete Spanish translations covering all 8 namespaces — Latin American Spanish for Honduran audience
- Language toggle component using useLocale() + cookie switch + page reload wired into DashboardNav header
- Per-list visibility toggle on both wantlist and tradelist tabs using local state + bulk wishlist.update mutations
- Riftdecks.com scraper built with cheerio; tier list badge CSS class parsing, champion deck extraction, tournament deck list
- Standalone sync-riftdecks.ts script for manual upsert runs; idempotent upsert on deck name
- Deck-sync cron module in NestJS with @nestjs/schedule running at 6AM and 6PM daily
- Trending Decks tab added to /decks page; deck-list.tsx refactored to tabbed layout (My Decks | Trending)

## Task Commits

1. **Task 1: Extend stats service + create deck recommendations module** - `ff94c87` (feat)
2. **Task 2: Stats tab UI, deck recommendations, i18n, language toggle, visibility** - `9e2832b` (feat)
3. **Task 3: Human verification checkpoint** - approved
4. **Post-checkpoint: Riftdecks scraper library** - `c4aad70` (feat)
5. **Post-checkpoint: sync-riftdecks standalone script** - `e3dc392` (feat)
6. **Post-checkpoint: deck-sync cron module** - `5923e2c` (feat)
7. **Post-checkpoint: tier list parsing fix** - `b889281` (fix)
8. **Post-checkpoint: trending decks tab** - `aba9d2a` (feat)
9. **Plan metadata update** - `d620519` (docs)

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
- `apps/api/src/modules/deck-sync/deck-sync.module.ts` - NestJS module with @nestjs/schedule
- `apps/api/src/modules/deck-sync/deck-sync.service.ts` - Cron job at 0 6 * * * and 0 18 * * * scraping riftdecks.com
- `apps/api/src/modules/deck-sync/deck-sync.router.ts` - Manual sync trigger endpoint
- `tools/seed/src/scrape-riftdecks.ts` - Cheerio-based scraper for tier list, champion decks, tournament decks
- `tools/seed/src/sync-riftdecks.ts` - Standalone upsert script
- `apps/web/src/app/(dashboard)/decks/trending-decks.tsx` - Trending Decks tab with import and wishlist-missing buttons
- `apps/web/src/app/(dashboard)/decks/deck-list.tsx` - Refactored to tabbed layout: My Decks | Trending

## Decisions Made

- Cookie-based locale switching via `window.location.reload()` — simplest approach for next-intl without URL prefixing; aligns with existing request.ts config
- `ScoredRecommendation` typed locally inside `getRecommendations()` to avoid leaking `_compositeScore` on the exported `DeckRecommendation` interface
- recharts `PieLabelRenderProps` type used directly to satisfy type checker on pie chart label renderer
- Tooltip formatter removed from recharts bar chart to avoid `ValueType` union type complexity
- Riftdecks.com tier list badge CSS class parsing (not text content) required to extract tier letters — text was empty, CSS class encodes S/A/B/C
- deck-sync cron added after checkpoint per user request to keep trending decks fresh automatically

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

**4. [Rule 1 - Bug] Fixed riftdecks.com tier list badge class parsing**
- **Found during:** Post-checkpoint scraper work
- **Issue:** Initial cheerio selector read inner text of tier badge elements, which was empty — tier letter is encoded in CSS class names (e.g., `.badge-s`, `.badge-a`)
- **Fix:** Updated selector to extract tier letter from CSS class attribute instead of text content
- **Files modified:** tools/seed/src/scrape-riftdecks.ts
- **Verification:** Scraper returns correct tier labels (S/A/B/C) from riftdecks.com table rows
- **Committed in:** b889281 (fix)

---

**Total deviations:** 4 auto-fixed (3 Rule 1 TypeScript/recharts type incompatibilities + 1 Rule 1 scraper bug)
**Impact on plan:** All fixes required for correctness. No scope creep.

## Issues Encountered

- recharts v3 has stricter TypeScript types for `Formatter` and `PieLabelRenderProps` compared to v2 — required using library types directly rather than inline type annotations
- dashboard-nav.tsx was untracked (new file in git) despite being modified — staged and committed correctly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 01 (Collection Tracker) is fully complete — all 5 plans delivered and verified
- Deck-sync cron runs automatically at 6AM/6PM; no manual seeding required going forward
- To seed tournament decks one-time: `pnpm tsx tools/seed/src/seed-tournament-decks.ts` (requires DATABASE_URL)
- All API and web code committed and builds successfully
- Phase 02 (Marketplace) can begin — collection schema, wishlist, user identity, and deck patterns are all in place

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
