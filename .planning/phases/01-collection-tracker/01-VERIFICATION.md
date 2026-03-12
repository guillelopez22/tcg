---
phase: 01-collection-tracker
verified: 2026-03-11T12:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 12/12
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: "Switch language to Spanish via dashboard nav toggle"
    expected: "All visible text changes to Spanish (Mi Coleccion, Estadisticas, etc.)"
    why_human: "Cookie-based locale switching requires browser interaction to verify full translation coverage"
  - test: "Navigate to /collection Stats tab after adding cards with known prices"
    expected: "Total market value shows correct dollar amount, set completion bars reflect owned vs. total, recharts charts render"
    why_human: "Chart rendering and numeric accuracy require real DB data"
  - test: "Navigate to /scanner on mobile device"
    expected: "Rear-facing camera activates (facingMode: environment), detection flow works"
    why_human: "getUserMedia facingMode cannot be verified programmatically"
  - test: "Open deck recommendations tab in Stats after seeding tournament decks"
    expected: "At least one recommendation shows with ownership %, synergy reasoning text, and missing card list"
    why_human: "Depends on live DB with seeded decks and user collection data"
---

# Phase 01: Collection Tracker Verification Report

**Phase Goal:** Players can digitize their entire card collection with multi-copy, variant, and condition tracking, manage wantlists and tradelists, and view meaningful stats about their holdings
**Verified:** 2026-03-11
**Status:** PASSED
**Re-verification:** Yes — regression check after git-modified files (collection.service.ts, copy-list.tsx, [cardId]/page.tsx, card.constants.ts, seed-tournament-decks.ts, pnpm-lock.yaml)

## Re-verification Summary

Previous verification: PASSED (12/12), 2026-03-11.

Five source files were modified since the initial verification (per git status). All modified files were re-read and verified against their original evidence claims:

| Modified File | Previous Claim | Regression Found? |
|---|---|---|
| `apps/api/src/modules/collection/collection.service.ts` | Per-copy CRUD, stats with isFoilVariant market value, 670 lines | No — file remains 670 lines; `isFoilVariant` now imported from `@la-grieta/shared` and used correctly at line 615 for foil-vs-normal price selection; all CRUD methods intact |
| `apps/web/src/app/(dashboard)/collection/[cardId]/copy-list.tsx` | Per-copy accordion with CopyEditForm | No — full accordion implementation intact; CopyEditForm imported at line 9, rendered at line 137 |
| `apps/web/src/app/(dashboard)/collection/[cardId]/page.tsx` | getByCard + wishlist.getForCard queries | No — both tRPC queries at lines 48 and 57; wishlist toggle, addCopy mutation, CopyList all wired |
| `packages/shared/src/constants/card.constants.ts` | CARD_VARIANTS and WISHLIST_TYPES exported | No — CARD_VARIANTS at line 28, WISHLIST_TYPES at line 31; new `FOIL_VARIANTS` set and `isFoilVariant()` helper added and exported via `packages/shared/src/index.ts` (additive, not breaking) |
| `tools/seed/src/seed-tournament-decks.ts` | Seed script for tournament decks | No — substantive implementation; reads tournament-decks.json, upserts via Drizzle, creates system user if absent |

No regressions detected. All 12 truths remain verified.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Collections table uses per-copy model (variant/condition/purchasePrice/photoUrl/photoKey; no quantity; no unique(userId+cardId) constraint) | VERIFIED | `packages/db/src/schema/collections.ts` — variant col present, no quantity col, only non-unique composite index |
| 2 | Wishlists table exists with want/trade type discriminator | VERIFIED | `packages/db/src/schema/wishlists.ts` — `type: wishlistTypeEnum('type').notNull()`, unique index on user+card+type |
| 3 | cardVariantEnum and wishlistTypeEnum exist in database enums | VERIFIED | `packages/db/src/schema/enums.ts` — both enums present |
| 4 | Zod schemas validate per-copy model (add/update/bulk/list/getByCard; no quantity field; wishlist toggle/update/list) | VERIFIED | `packages/shared/src/schemas/collection.schema.ts` and `wishlist.schema.ts` — no quantity, variant present, all schemas exported |
| 5 | R2 upload accepts 'collection' purpose | VERIFIED | `collection.service.ts` calls `r2.generateUploadUrl({ purpose: 'collection', ... })` |
| 6 | next-intl configured; t() works in server and client components | VERIFIED | `apps/web/src/i18n/request.ts` cookie-based config; `en.json` and `es.json` exist with all namespaces |
| 7 | Collection service uses pure insert (no upsert); supports per-copy CRUD with variant/condition/purchasePrice/photo | VERIFIED | `collection.service.ts` — `add()` always inserts (line 248 comment: "Per-copy model: always insert a new row"); full CRUD; stats uses `isFoilVariant` for accurate market value |
| 8 | Wishlist module fully functional (toggle, update, list, getForCard) | VERIFIED | `wishlist.service.ts` — all four methods with real DB queries |
| 9 | Collection UI: four-tab page, card grid with copy count badges, add-cards modal with fuse.js, card detail page with per-copy editing and wishlist toggles | VERIFIED | `page.tsx`, `collection-grid.tsx`, `add-cards-modal.tsx`, `[cardId]/page.tsx`, `copy-list.tsx`, `copy-edit-form.tsx` all exist and are wired |
| 10 | Scanner enhanced: continuous auto-detect, confirmation overlay with explicit add required, configurable cooldown, session summary with wishlist toggles | VERIFIED | `card-scanner.tsx`, `scan-confirmation.tsx`, `scanner-settings.tsx`, `scan-session-summary.tsx` all present and wired |
| 11 | Stats tab: total cards/copies/value, set completion bars, recharts charts, deck recommendations with synergy reasoning | VERIFIED | `stats-tab.tsx`, `stats-charts.tsx`, `deck-recommendations.tsx` all wired to tRPC endpoints |
| 12 | Spanish translations complete; language toggle in dashboard nav switches EN/ES | VERIFIED | `es.json` complete; `LanguageToggle` imported at line 7 and rendered at line 57 of `dashboard-nav.tsx` |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/enums.ts` | cardVariantEnum, wishlistTypeEnum | VERIFIED | Both enums present |
| `packages/db/src/schema/collections.ts` | Per-copy schema with variant, no quantity | VERIFIED | variant col, no quantity, non-unique index |
| `packages/db/src/schema/wishlists.ts` | Want/trade type discriminator | VERIFIED | wishlistTypeEnum col, isPublic, maxPrice, askingPrice |
| `packages/shared/src/schemas/collection.schema.ts` | Per-copy Zod schemas | VERIFIED | collectionAddSchema has variant, no quantity |
| `packages/shared/src/schemas/wishlist.schema.ts` | wishlistToggleSchema exported | VERIFIED | toggle/update/list schemas present |
| `packages/shared/src/constants/card.constants.ts` | CARD_VARIANTS, WISHLIST_TYPES, isFoilVariant exported | VERIFIED | CARD_VARIANTS line 28, WISHLIST_TYPES line 31, isFoilVariant line 41 — re-verified post-modification |
| `apps/web/messages/en.json` | English translations with 'collection' namespace | VERIFIED | All namespaces present |
| `apps/web/messages/es.json` | Complete Spanish translations | VERIFIED | Full Spanish translations present |
| `apps/web/src/i18n/request.ts` | Cookie-based locale detection | VERIFIED | Cookie-based getRequestConfig present |
| `apps/api/src/modules/collection/collection.service.ts` | Per-copy CRUD, stats with market value, 670 lines | VERIFIED | All methods intact; isFoilVariant used in stats — re-verified post-modification |
| `apps/api/src/modules/wishlist/wishlist.service.ts` | toggle/update/list/getForCard | VERIFIED | All four methods with real DB queries |
| `apps/api/src/modules/wishlist/wishlist.router.ts` | tRPC procedures | VERIFIED | Registered in trpc.router.ts line 40 |
| `apps/web/src/app/(dashboard)/collection/page.tsx` | Four-tab layout with CollectionTabs | VERIFIED | StatsTab, WantlistTab, TradelistTab, CollectionGrid all rendered |
| `apps/web/src/app/(dashboard)/collection/collection-grid.tsx` | Card grid with copyCount badges | VERIFIED | trpc.collection.list.useInfiniteQuery, copy count grouping logic |
| `apps/web/src/app/(dashboard)/collection/add-cards-modal.tsx` | Fuse.js multi-select search | VERIFIED | Fuse imported, addBulk mutation wired |
| `apps/web/src/app/(dashboard)/collection/[cardId]/page.tsx` | getByCard + wishlist.getForCard | VERIFIED | Both queries at lines 48 and 57 — re-verified post-modification |
| `apps/web/src/app/(dashboard)/collection/[cardId]/copy-list.tsx` | Per-copy accordion | VERIFIED | CopyEditForm rendered at line 137 — re-verified post-modification |
| `apps/web/src/app/(dashboard)/collection/[cardId]/copy-edit-form.tsx` | purchasePrice field | VERIFIED | purchasePrice field present |
| `apps/web/src/app/(dashboard)/collection/wantlist-tab.tsx` | Wishlist list + visibility toggle | VERIFIED | trpc.wishlist.list.useQuery, isPublic state, bulk update mutation |
| `apps/web/src/app/(dashboard)/collection/tradelist-tab.tsx` | Tradelist display | VERIFIED | Same pattern as wantlist |
| `apps/web/src/app/(dashboard)/collection/stats-tab.tsx` | totalValue stat card | VERIFIED | trpc.collection.stats.useQuery, totalMarketValue rendered |
| `apps/web/src/app/(dashboard)/collection/stats-charts.tsx` | recharts visualizations | VERIFIED | recharts ResponsiveContainer, BarChart, PieChart all imported |
| `apps/web/src/app/(dashboard)/collection/deck-recommendations.tsx` | ownership % and synergy reasoning | VERIFIED | deckRecommendations.getRecommendations.useQuery wired |
| `apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts` | Synergy engine | VERIFIED | getRecommendations method with composite scoring |
| `apps/web/src/app/(dashboard)/scanner/card-scanner.tsx` | getUserMedia | VERIFIED | getUserMedia present |
| `apps/web/src/app/(dashboard)/scanner/scan-confirmation.tsx` | confidence displayPct | VERIFIED | ScanMatch interface includes displayPct |
| `apps/web/src/app/(dashboard)/scanner/scan-session-summary.tsx` | sessionSummary prop + wishlist.toggle | VERIFIED | sessionSummary prop present, wishlist.toggle mutation wired |
| `apps/web/src/app/(dashboard)/scanner/scanner-settings.tsx` | cooldown localStorage | VERIFIED | STORAGE_KEY 'scanner:cooldown', loadCooldown/saveCooldown |
| `apps/web/src/components/language-toggle.tsx` | locale cookie switch | VERIFIED | useLocale(), cookie set, window.location.reload() |
| `apps/web/src/components/dashboard-nav.tsx` | LanguageToggle wired in | VERIFIED | Imported line 7, rendered line 57 — re-verified |
| `apps/api/src/modules/deck-sync/deck-sync.service.ts` | Cron at 6AM/6PM | VERIFIED | @Cron('0 6,18 * * *') present |
| `tools/seed/src/scrape-riftdecks.ts` | cheerio scraper | VERIFIED | cheerio imported, BASE_URL riftdecks.com |
| `tools/seed/tournament-decks.json` | Seed data for decks | VERIFIED | File exists |
| `apps/web/src/app/(dashboard)/decks/trending-decks.tsx` | Trending decks tab | VERIFIED | trpc.deck queries, wishlist actions |
| `tools/seed/src/seed-tournament-decks.ts` | Idempotent upsert seed script | VERIFIED | Reads tournament-decks.json, Drizzle upsert, system user creation — re-verified post-modification |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/src/schema/collections.ts` | `packages/db/src/schema/enums.ts` | cardVariantEnum import | WIRED | Import present |
| `packages/db/src/schema/wishlists.ts` | `packages/db/src/schema/enums.ts` | wishlistTypeEnum import | WIRED | Import present |
| `packages/shared/src/schemas/collection.schema.ts` | `packages/shared/src/constants/card.constants.ts` | CARD_VARIANTS | WIRED | Import present |
| `packages/shared/src/constants/card.constants.ts` | `packages/shared/src/index.ts` | export * re-export | WIRED | `export * from './constants/card.constants'` in index.ts |
| `apps/api/src/modules/collection/collection.service.ts` | `@la-grieta/shared` | isFoilVariant | WIRED | Imported at line 15, used at line 615 in stats() — new link added in current modification |
| `apps/api/src/modules/collection/collection.service.ts` | DB collections table | db.insert/select/update/delete | WIRED | insert line 249, select line 319, update line 336, delete line 360 |
| `apps/api/src/modules/wishlist/wishlist.service.ts` | DB wishlists table | db.insert/select/delete | WIRED | All three present |
| `apps/api/src/trpc/trpc.router.ts` | wishlist router | wishlist namespace | WIRED | Line 40 |
| `apps/api/src/trpc/trpc.router.ts` | deckRecommendations router | deckRecommendations namespace | WIRED | Line 44 |
| `apps/web/collection/collection-grid.tsx` | API via tRPC | trpc.collection.list | WIRED | useInfiniteQuery present |
| `apps/web/collection/add-cards-modal.tsx` | API via tRPC | trpc.collection.addBulk | WIRED | useMutation wired |
| `apps/web/collection/[cardId]/page.tsx` | API via tRPC | collection.getByCard + wishlist.getForCard | WIRED | Both queries at lines 48 and 57 |
| `apps/web/scanner/card-scanner.tsx` | scanner API | trpc.scanner.identify | WIRED | identifyMutation present |
| `apps/web/scanner/card-scanner.tsx` | collection API | trpc.collection.addBulk | WIRED | addBulkMutation present |
| `apps/web/scanner/scan-session-summary.tsx` | wishlist API | trpc.wishlist.toggle | WIRED | wishlistToggleMutation present |
| `apps/web/collection/stats-tab.tsx` | collection API | trpc.collection.stats | WIRED | useQuery present |
| `apps/web/collection/deck-recommendations.tsx` | deckRecommendations API | deckRecommendations.getRecommendations | WIRED | useQuery present |
| `apps/web/components/language-toggle.tsx` | dashboard-nav.tsx | LanguageToggle rendered | WIRED | Imported line 7, rendered line 57 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLL-01 | 01-02, 01-03 | Add cards to collection via search | SATISFIED | AddCardsModal with fuse.js search + addBulk mutation |
| COLL-02 | 01-04 | Add cards via camera scanning | SATISFIED | card-scanner.tsx with getUserMedia + scanner.identify + addBulk |
| COLL-03 | 01-01, 01-02, 01-03 | Set variant per copy | SATISFIED | cardVariantEnum in schema; variant in Zod schemas; dropdown in copy-edit-form.tsx |
| COLL-04 | 01-01, 01-02, 01-03 | Set condition per copy | SATISFIED | cardConditionEnum in schema; condition in all schemas; dropdown in copy-edit-form.tsx |
| COLL-05 | 01-01, 01-02, 01-03 | Record purchase price per copy | SATISFIED | purchasePrice column in schema; collectionUpdateSchema; price input in copy-edit-form.tsx |
| COLL-06 | 01-01, 01-02, 01-03 | Attach photos via R2 upload | SATISFIED | photoUrl/photoKey columns; getUploadUrl service method; PhotoUpload component |
| COLL-07 | 01-01, 01-02, 01-03 | Manage wantlist | SATISFIED | wishlists table; wishlist toggle/list; WantlistTab with cards and visibility toggle |
| COLL-08 | 01-01, 01-02, 01-03 | Manage tradelist | SATISFIED | 'trade' type discriminator; TradelistTab |
| COLL-09 | 01-05 | View collection stats | SATISFIED | stats-tab.tsx with totalValue (foil-aware), setCompletion bars, recharts charts |
| COLL-10 | 01-05 | Deck recommendations based on owned cards | SATISFIED | DeckRecommendationsService with ownership % scoring; deck-recommendations.tsx UI |
| PLAT-01 | 01-01, 01-05 | EN/ES with language toggle | SATISFIED | next-intl with cookie-based locale; complete es.json; LanguageToggle in DashboardNav |
| PLAT-03 | 01-04 | Camera scanning on desktop and mobile | SATISFIED | getUserMedia with facingMode: 'environment' for mobile; falls back to webcam on desktop |

All 12 requirements satisfied. No orphaned requirements — REQUIREMENTS.md traceability table maps exactly COLL-01 through COLL-10, PLAT-01, and PLAT-03 to Phase 1, and all are accounted for in plan frontmatter.

---

### Anti-Patterns Found

No regressions or new blockers detected in modified files. Previously noted observations remain:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scan-session-summary.tsx` | 47-57 | Market price placeholder ("—") for all cards | Info | Data dependency on card_prices table; not a code bug |
| `add-cards-modal.tsx` | implicit | Set name excluded from fuse.js search | Info | Intentional — list endpoint does not include nested set object |
| `collection.service.ts` | 495-669 | stats() runs up to 6 DB queries per call | Info | Mitigated by 5-minute Redis cache; not a blocking issue |

No TODO/FIXME/PLACEHOLDER blocking patterns found in any key file. The only `return null` in modified files is in `seed-tournament-decks.ts` inside a `.map()` lambda for missing card lookups — expected behavior, not a stub.

---

### Human Verification Required

#### 1. Language Toggle End-to-End

**Test:** Click the globe icon in the dashboard navigation to switch to Spanish.
**Expected:** All visible UI text switches to Spanish — "Mi Coleccion", "Estadisticas", "Escaner", "Cargando...", etc. Clicking again switches back to English.
**Why human:** Cookie-based locale switching requires a browser reload; cannot be verified by static analysis.

#### 2. Stats Tab with Live Data

**Test:** After adding at least 5 cards to the collection, navigate to /collection and click the Stats tab.
**Expected:** Total Unique Cards, Total Copies, Total Market Value stat boxes are populated. Set completion bars show progress for Origins/Spiritforged. Recharts bar chart and rarity donut chart render without errors. Market value correctly uses foil prices for alt_art, overnumbered, and signature variants.
**Why human:** Requires live DB data and rendered React components with recharts.

#### 3. Deck Recommendations with Seeded Data

**Test:** Run `pnpm tsx tools/seed/src/seed-tournament-decks.ts` (requires DATABASE_URL). Then navigate to Stats tab Deck Recommendations section.
**Expected:** At least one recommendation appears with champion art, ownership %, synergy reasoning text, expandable missing cards, and "Add all missing to wantlist" button.
**Why human:** Depends on live DB + user collection data + seeded decks.

#### 4. Mobile Camera Scanner

**Test:** Open /scanner on a mobile device (or using Chrome DevTools device simulation with camera).
**Expected:** Rear-facing camera activates. Pointing at a Riftbound card image eventually triggers the confirmation overlay with card art, confidence percentage, and add controls. Cooldown resumes scanning after 3 seconds.
**Why human:** getUserMedia behavior and camera detection require physical interaction.

---

### Summary

All 12 observable truths remain verified. The re-verification focused on five git-modified files — none introduced regressions. The most notable change in the current modification set is the addition of `isFoilVariant()` to `card.constants.ts` (exported through the shared package index) and its use in `collection.service.ts` stats to select foil vs. normal market prices for alt_art, overnumbered, and signature variants. This is an additive improvement to COLL-09 accuracy, not a breaking change.

All 12 Phase 1 requirements (COLL-01 through COLL-10, PLAT-01, PLAT-03) have implementation evidence in the codebase. No gaps. No regressions.

**Phase 01 goal is achieved.** The collection tracker is functional and ready to serve as the data foundation for Phase 02 (Deck Builder Enhancements).

---

_Verified: 2026-03-11_
_Re-verified: 2026-03-11 (post-modification regression check)_
_Verifier: Claude (gsd-verifier)_
