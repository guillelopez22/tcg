---
phase: 01-collection-tracker
verified: 2026-03-11T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
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

**Phase Goal:** Per-copy collection tracker with add/edit/delete, condition tracking, wishlist, tradelist, card scanner, collection stats — ready for marketplace listing
**Verified:** 2026-03-11
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Collections table uses per-copy model (variant/condition/purchasePrice/photoUrl/photoKey; no quantity; no unique(userId+cardId) constraint) | VERIFIED | `packages/db/src/schema/collections.ts` — `variant` col present, no quantity col, only non-unique composite `index('idx_collections_user_card')` |
| 2 | Wishlists table exists with want/trade type discriminator | VERIFIED | `packages/db/src/schema/wishlists.ts` — `type: wishlistTypeEnum('type').notNull()`, `uniqueIndex('idx_wishlists_user_card_type')` |
| 3 | cardVariantEnum and wishlistTypeEnum exist in database enums | VERIFIED | `packages/db/src/schema/enums.ts` lines 12-19 |
| 4 | Zod schemas validate per-copy model (add/update/bulk/list/getByCard; no quantity field; wishlist toggle/update/list) | VERIFIED | `packages/shared/src/schemas/collection.schema.ts` and `wishlist.schema.ts` — no quantity, variant present, all schemas exported |
| 5 | R2 upload accepts 'collection' purpose | VERIFIED | `collection.service.ts` calls `r2.generateUploadUrl({ purpose: 'collection', ... })` with validation |
| 6 | next-intl configured; t() works in server and client components | VERIFIED | `apps/web/src/i18n/request.ts` cookie-based config; `apps/web/messages/en.json` and `es.json` exist with all namespaces |
| 7 | Collection service uses pure insert (no upsert); supports per-copy CRUD with variant/condition/purchasePrice/photo | VERIFIED | `collection.service.ts` — `add()` always inserts new row (comment: "Per-copy model: always insert a new row"); full CRUD methods present |
| 8 | Wishlist module fully functional (toggle, update, list, getForCard) | VERIFIED | `wishlist.service.ts` — all four methods substantively implemented with DB queries |
| 9 | Collection UI: four-tab page, card grid with copy count badges, add-cards modal with fuse.js, card detail page with per-copy editing and wishlist toggles | VERIFIED | `page.tsx`, `collection-grid.tsx`, `add-cards-modal.tsx` (Fuse.js imported line 8), `[cardId]/page.tsx`, `copy-list.tsx`, `copy-edit-form.tsx` all exist and are wired |
| 10 | Scanner enhanced: continuous auto-detect, confirmation overlay with explicit add required, configurable cooldown, session summary with wishlist toggles | VERIFIED | `card-scanner.tsx` (getUserMedia, addBulkMutation), `scan-confirmation.tsx` (confidence displayPct), `scanner-settings.tsx` (localStorage cooldown), `scan-session-summary.tsx` (wishlist.toggle mutation line 62) |
| 11 | Stats tab: total cards/copies/value, set completion bars, recharts charts, deck recommendations with synergy reasoning | VERIFIED | `stats-tab.tsx` (trpc.collection.stats.useQuery line 18), `stats-charts.tsx` (recharts imported), `deck-recommendations.tsx` (deckRecommendations.getRecommendations.useQuery line 19) |
| 12 | Spanish translations complete; language toggle in dashboard nav switches EN/ES | VERIFIED | `es.json` (complete Spanish, "Mi Coleccion" etc.); `language-toggle.tsx` wired into `dashboard-nav.tsx` (LanguageToggle imported line 7, rendered line 57) |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/enums.ts` | cardVariantEnum, wishlistTypeEnum | VERIFIED | Both enums present at lines 12 and 19 |
| `packages/db/src/schema/collections.ts` | Per-copy schema with variant, no quantity | VERIFIED | variant col, no quantity, non-unique index |
| `packages/db/src/schema/wishlists.ts` | Want/trade type discriminator | VERIFIED | wishlistTypeEnum col, isPublic, maxPrice, askingPrice |
| `packages/shared/src/schemas/collection.schema.ts` | Per-copy Zod schemas | VERIFIED | collectionAddSchema has variant, no quantity |
| `packages/shared/src/schemas/wishlist.schema.ts` | wishlistToggleSchema exported | VERIFIED | toggle/update/list schemas all present |
| `packages/shared/src/constants/card.constants.ts` | CARD_VARIANTS exported | VERIFIED | CARD_VARIANTS and WISHLIST_TYPES at lines 28-31 |
| `apps/web/messages/en.json` | English translations with 'collection' namespace | VERIFIED | All namespaces present |
| `apps/web/messages/es.json` | Complete Spanish translations | VERIFIED | Full Spanish translations ("Mi Coleccion", "Cargando...", etc.) |
| `apps/web/src/i18n/request.ts` | Cookie-based locale detection | VERIFIED | Cookie-based getRequestConfig present |
| `apps/api/src/modules/collection/collection.service.ts` | Per-copy CRUD, stats with market value | VERIFIED | add/addBulk/update/remove/getByCard/getUploadUrl/stats all substantive (670 lines) |
| `apps/api/src/modules/wishlist/wishlist.service.ts` | toggle/update/list/getForCard | VERIFIED | All four methods with real DB queries |
| `apps/api/src/modules/wishlist/wishlist.router.ts` | tRPC procedures | VERIFIED | Registered in trpc.router.ts line 40 |
| `apps/web/src/app/(dashboard)/collection/page.tsx` | Four-tab layout with CollectionTabs | VERIFIED | StatsTab, WantlistTab, TradelistTab, CollectionGrid all rendered |
| `apps/web/src/app/(dashboard)/collection/collection-grid.tsx` | Card grid with copyCount badges | VERIFIED | trpc.collection.list.useInfiniteQuery, copy count grouping logic |
| `apps/web/src/app/(dashboard)/collection/add-cards-modal.tsx` | Fuse.js multi-select search | VERIFIED | Fuse imported line 8, addBulk mutation wired |
| `apps/web/src/app/(dashboard)/collection/[cardId]/page.tsx` | getByCard + wishlist.getForCard | VERIFIED | Both queries at lines 48 and 57 |
| `apps/web/src/app/(dashboard)/collection/[cardId]/copy-list.tsx` | Per-copy accordion | VERIFIED | CopyEditForm integration |
| `apps/web/src/app/(dashboard)/collection/[cardId]/copy-edit-form.tsx` | purchasePrice field | VERIFIED | purchasePrice field at line 54/92/144 |
| `apps/web/src/app/(dashboard)/collection/wantlist-tab.tsx` | Wishlist list + visibility toggle | VERIFIED | trpc.wishlist.list.useQuery, isPublic state, bulk update mutation |
| `apps/web/src/app/(dashboard)/collection/tradelist-tab.tsx` | Tradelist display | VERIFIED | Same pattern as wantlist |
| `apps/web/src/app/(dashboard)/collection/stats-tab.tsx` | totalValue stat card | VERIFIED | trpc.collection.stats.useQuery, totalMarketValue rendered |
| `apps/web/src/app/(dashboard)/collection/stats-charts.tsx` | recharts visualizations | VERIFIED | recharts ResponsiveContainer, BarChart, PieChart all imported |
| `apps/web/src/app/(dashboard)/collection/deck-recommendations.tsx` | ownership % and synergy reasoning | VERIFIED | deckRecommendations.getRecommendations.useQuery wired |
| `apps/api/src/modules/deck-recommendations/deck-recommendations.service.ts` | Synergy engine | VERIFIED | getRecommendations method with composite scoring |
| `apps/api/__tests__/scanner.service.spec.ts` | NCC threshold tests | VERIFIED | 12 tests, NCC_IDENTIFY_THRESHOLD imported and tested |
| `apps/web/src/app/(dashboard)/scanner/card-scanner.tsx` | getUserMedia | VERIFIED | getUserMedia at lines 106/111 |
| `apps/web/src/app/(dashboard)/scanner/scan-confirmation.tsx` | confidence displayPct | VERIFIED | ScanMatch interface includes displayPct field |
| `apps/web/src/app/(dashboard)/scanner/scan-session-summary.tsx` | sessionSummary prop | VERIFIED | sessionSummary prop at line 39, wishlist.toggle at line 62 |
| `apps/web/src/app/(dashboard)/scanner/scanner-settings.tsx` | cooldown localStorage | VERIFIED | STORAGE_KEY 'scanner:cooldown', loadCooldown/saveCooldown |
| `apps/web/src/components/language-toggle.tsx` | locale cookie switch | VERIFIED | useLocale(), cookie set, window.location.reload() |
| `apps/web/src/components/dashboard-nav.tsx` | LanguageToggle wired in | VERIFIED | Imported line 7, rendered line 57 |
| `apps/api/src/modules/deck-sync/deck-sync.service.ts` | Cron at 6AM/6PM | VERIFIED | @Cron('0 6,18 * * *') at line 23 |
| `tools/seed/src/scrape-riftdecks.ts` | cheerio scraper | VERIFIED | cheerio imported, BASE_URL riftdecks.com |
| `tools/seed/tournament-decks.json` | Seed data for decks | VERIFIED | File exists |
| `apps/web/src/app/(dashboard)/decks/trending-decks.tsx` | Trending decks tab | VERIFIED | trpc.deck queries, wishlist actions |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/db/src/schema/collections.ts` | `packages/db/src/schema/enums.ts` | cardVariantEnum import | WIRED | Import at line 4 |
| `packages/db/src/schema/wishlists.ts` | `packages/db/src/schema/enums.ts` | wishlistTypeEnum import | WIRED | Import at line 4 |
| `packages/shared/src/schemas/collection.schema.ts` | `packages/shared/src/constants/card.constants.ts` | CARD_VARIANTS | WIRED | Import at line 2 |
| `apps/api/src/modules/collection/collection.service.ts` | DB collections table | db.insert/select/update/delete | WIRED | Drizzle queries throughout; insert at line 252, select at 319, update at 336, delete at 360 |
| `apps/api/src/modules/wishlist/wishlist.service.ts` | DB wishlists table | db.insert/select/delete | WIRED | insert at line 73, select at line 54, delete at line 68 |
| `apps/api/src/trpc/trpc.router.ts` | wishlist router | wishlist namespace | WIRED | `wishlist: this.wishlistRouter.buildRouter()` at line 40 |
| `apps/api/src/trpc/trpc.router.ts` | deckRecommendations router | deckRecommendations namespace | WIRED | Line 44 |
| `apps/web/collection/collection-grid.tsx` | API via tRPC | trpc.collection.list | WIRED | useInfiniteQuery at line 59 |
| `apps/web/collection/add-cards-modal.tsx` | API via tRPC | trpc.collection.addBulk | WIRED | useMutation wired; addBulk called on confirm |
| `apps/web/collection/[cardId]/page.tsx` | API via tRPC | collection.getByCard + wishlist.getForCard | WIRED | Both queries at lines 48 and 57 |
| `apps/web/scanner/card-scanner.tsx` | scanner API | trpc.scanner.identify | WIRED | identifyMutation at line 65 |
| `apps/web/scanner/card-scanner.tsx` | collection API | trpc.collection.addBulk | WIRED | addBulkMutation at line 70; mutate called at line 351 |
| `apps/web/scanner/scan-session-summary.tsx` | wishlist API | trpc.wishlist.toggle | WIRED | wishlistToggleMutation at line 62 |
| `apps/web/collection/stats-tab.tsx` | collection API | trpc.collection.stats | WIRED | useQuery at line 18 |
| `apps/web/collection/deck-recommendations.tsx` | deckRecommendations API | deckRecommendations.getRecommendations | WIRED | useQuery at line 19 |
| `apps/web/components/language-toggle.tsx` | dashboard-nav.tsx | LanguageToggle rendered | WIRED | Imported and rendered in DashboardNav |

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
| COLL-08 | 01-01, 01-02, 01-03 | Manage tradelist | SATISFIED | Same infrastructure; 'trade' type discriminator; TradelistTab |
| COLL-09 | 01-05 | View collection stats | SATISFIED | stats-tab.tsx with totalValue, setCompletion bars, recharts charts |
| COLL-10 | 01-05 | Deck recommendations based on owned cards | SATISFIED | DeckRecommendationsService with ownership % scoring; deck-recommendations.tsx UI |
| PLAT-01 | 01-01, 01-05 | EN/ES with language toggle | SATISFIED | next-intl with cookie-based locale; complete es.json; LanguageToggle in DashboardNav |
| PLAT-03 | 01-04 | Camera scanning on desktop and mobile | SATISFIED | getUserMedia with facingMode: 'environment' for mobile; falls back to webcam on desktop |

All 12 requirements satisfied.

**Orphaned requirements check:** No requirements mapped to Phase 1 in REQUIREMENTS.md that do not appear in plan frontmatter.

---

### Anti-Patterns Found

No blockers detected. Notable observations:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scan-session-summary.tsx` | 47-57 | Market price placeholder — "—" shown for all cards | Info | Session market prices rely on card_prices data; if card_prices table is empty (no price sync run), all prices show as placeholder. Not a code bug — a data dependency. |
| `add-cards-modal.tsx` | implicit | Set name excluded from fuse.js search (set?.name replaced with '') | Info | Card search cannot filter by set name. Per SUMMARY.md this was intentional — the list endpoint doesn't include nested set object. Behavior is explicit. |
| `collection.service.ts` | 495-669 | stats() runs up to 6 DB queries per call | Info | Partially mitigated by Redis caching. Not a blocking issue but worth noting for Phase 2 scale. |

No TODO/FIXME/PLACEHOLDER blocking patterns found in key files.

---

### Human Verification Required

#### 1. Language Toggle End-to-End

**Test:** Click the globe icon in the dashboard navigation to switch to Spanish.
**Expected:** All visible UI text switches to Spanish — "Mi Coleccion", "Estadisticas", "Escaner", "Cargando...", etc. Clicking again switches back to English.
**Why human:** Cookie-based locale switching requires a browser reload; cannot be verified by static analysis.

#### 2. Stats Tab with Live Data

**Test:** After adding at least 5 cards to the collection, navigate to /collection and click the Stats tab.
**Expected:** Total Unique Cards, Total Copies, Total Market Value stat boxes are populated. Set completion bars show progress for Origins/Spiritforged. Recharts bar chart and rarity donut chart render without errors.
**Why human:** Requires live DB data and rendered React components with recharts.

#### 3. Deck Recommendations with Seeded Data

**Test:** Run `pnpm tsx tools/seed/src/seed-tournament-decks.ts` (requires DATABASE_URL). Then navigate to Stats tab Deck Recommendations section.
**Expected:** At least one recommendation appears with champion art, ownership %, synergy reasoning text (e.g., "This deck shares X domain cards with your collection"), expandable missing cards, and "Add all missing to wantlist" button.
**Why human:** Depends on live DB + user collection data + seeded decks.

#### 4. Mobile Camera Scanner

**Test:** Open /scanner on a mobile device (or using Chrome DevTools device simulation with camera).
**Expected:** Rear-facing camera activates. Pointing at a Riftbound card image eventually triggers the confirmation overlay with card art, confidence percentage, and add controls. Cooldown resumes scanning after 3 seconds.
**Why human:** getUserMedia behavior and camera detection require physical interaction.

---

### Summary

All 12 observable truths are verified in the codebase. Every artifact exists with substantive implementation (no stubs). All key links between components and API endpoints are wired. All 12 Phase 1 requirements (COLL-01 through COLL-10, PLAT-01, PLAT-03) have implementation evidence in the codebase.

The implementation correctly handles all core design decisions: per-copy model with one DB row per physical card copy, wishlist as a separate table with type discriminator, next-intl cookie-based locale detection (no URL prefix), and scanner requiring explicit user confirmation before adding cards.

Four items are flagged for human verification but are matters of runtime/visual behavior rather than missing implementation — the code structures supporting all four are fully present.

**Phase 01 goal is achieved.** The collection tracker is functional and ready to serve as the data foundation for Phase 02 (Marketplace).

---

_Verified: 2026-03-11_
_Verifier: Claude (gsd-verifier)_
