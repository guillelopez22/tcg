---
phase: 01-collection-tracker
plan: 01
subsystem: database-schema
tags: [schema, drizzle, zod, i18n, per-copy-model, wishlists]
dependency_graph:
  requires: []
  provides:
    - per-copy collections schema (variant, condition, purchasePrice, photoUrl, photoKey)
    - wishlists table (want/trade type discriminator)
    - cardVariantEnum and wishlistTypeEnum database enums
    - CARD_VARIANTS and WISHLIST_TYPES shared constants
    - updated Zod schemas for per-copy model (collectionAddSchema, collectionUpdateSchema, collectionAddBulkSchema, collectionListSchema)
    - wishlist Zod schemas (toggle, update, list)
    - next-intl i18n plumbing with EN/ES message scaffolds
    - R2 'collection' upload purpose
  affects:
    - apps/api collection service (rewritten for per-copy model)
    - apps/web collection UI (quantity controls removed, variant/condition badges added)
    - apps/web scanner and card-detail (quantity removed from add calls)
tech_stack:
  added:
    - next-intl 4.8.3 (cookie-based locale detection, no URL prefix routing)
  patterns:
    - Per-copy model: one DB row per physical card copy, no quantity column, no unique(userId, cardId) constraint
    - Stale compiled JS files (enums.js, collections.js, card.constants.js) updated manually alongside TS source — required because drizzle-kit and webpack both resolve .js before .ts
key_files:
  created:
    - packages/db/src/schema/wishlists.ts
    - packages/db/src/schema/wishlists.js
    - packages/shared/src/schemas/wishlist.schema.ts
    - apps/web/messages/en.json
    - apps/web/messages/es.json
    - apps/web/src/i18n/request.ts
    - packages/db/scripts/migrate-01-01.cjs
    - packages/db/drizzle/0000_spicy_vertigo.sql
  modified:
    - packages/db/src/schema/enums.ts (added cardVariantEnum, wishlistTypeEnum)
    - packages/db/src/schema/collections.ts (dropped quantity + unique constraint, added variant/purchasePrice/photoUrl/photoKey)
    - packages/db/src/schema/index.ts (added wishlists export)
    - packages/db/src/relations.ts (added wishlistsRelations)
    - packages/r2/src/constants.ts (added 'collection' purpose with 5MB limit)
    - packages/shared/src/constants/card.constants.ts (added CARD_VARIANTS, WISHLIST_TYPES)
    - packages/shared/src/schemas/collection.schema.ts (full rewrite for per-copy model)
    - packages/shared/src/index.ts (added wishlist schema exports)
    - apps/web/next.config.mjs (wrapped with createNextIntlPlugin)
    - apps/web/src/app/layout.tsx (added NextIntlClientProvider with locale)
    - apps/api/src/modules/collection/collection.service.ts (rewritten: no upsert, no quantity)
    - apps/web/src/app/(dashboard)/collection/collection-manager.tsx (per-copy UI)
    - apps/web/src/app/(dashboard)/scanner/card-scanner.tsx (removed quantity from add)
    - apps/web/src/app/cards/[id]/card-detail.tsx (removed quantity from add)
decisions:
  - "Per-copy model is irreversible: each collection row is one physical card copy. quantity column dropped, unique(userId, cardId, condition) constraint dropped. addWithTx no longer does upsert."
  - "next-intl uses cookie-based locale detection (no URL prefix /en/ /es/) — simpler for a two-language app with community users who may prefer Spanish"
  - "i18n ES file uses EN strings as placeholders — real Spanish translation pass deferred to end of phase"
  - "Migration applied via direct SQL script (migrate-01-01.cjs) rather than drizzle-kit migrate — drizzle-kit migrate failed because DB already had schema from previous session; drizzle-kit push is interactive and can't be automated"
metrics:
  duration_minutes: 12
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 14
  deviations: 4
  completed_date: "2026-03-12"
---

# Phase 1 Plan 1: Schema Migration, Wishlists, and i18n Plumbing Summary

Per-copy collection schema with variant/condition/photo/price tracking, wishlists table with want/trade type discriminator, updated Zod validation for all collection operations, and next-intl i18n configured for cookie-based EN/ES locale switching.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Migrate DB schema: per-copy collections + wishlists + enums | `4667114` |
| 2 | Update Zod schemas and shared constants | `1e8cb8a` |
| 3 | Configure next-intl i18n with EN/ES scaffolds | `ee0a9b3` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated stale compiled JS files alongside TS schema changes**
- **Found during:** Task 1 (drizzle-kit generate) and Task 3 (next build)
- **Issue:** The monorepo has pre-compiled `.js` files colocated with `.ts` source files. drizzle-kit and webpack/SWC resolve `.js` before `.ts`, causing them to pick up the old schema that doesn't have `cardVariantEnum`, `wishlistTypeEnum`, or `CARD_VARIANTS`/`WISHLIST_TYPES` exports.
- **Fix:** Manually updated `enums.js`, `collections.js`, `wishlists.js`, `index.js` in db schema dir, and `card.constants.js` in shared constants dir to match the new TS source.
- **Files modified:** `packages/db/src/schema/enums.js`, `collections.js`, `wishlists.js`, `index.js`, `packages/shared/src/constants/card.constants.js`
- **Commits:** `4667114`, `ee0a9b3`

**2. [Rule 1 - Bug] Used direct SQL migration instead of drizzle-kit migrate**
- **Found during:** Task 1 migration step
- **Issue:** `drizzle-kit migrate` failed with "type card_condition already exists" because the database already had schema from a previous development session. `drizzle-kit push` is interactive and cannot be piped.
- **Fix:** Created `packages/db/scripts/migrate-01-01.cjs` — a direct `pg` client script that applies each change idempotently with IF NOT EXISTS / IF EXISTS guards.
- **Files modified:** Created `packages/db/scripts/migrate-01-01.cjs`
- **Commit:** `4667114`

**3. [Rule 1 - Bug] Rewrote collection.service.ts for per-copy model**
- **Found during:** Task 3 (web build type-checking)
- **Issue:** `apps/api/src/modules/collection/collection.service.ts` referenced `collections.quantity` in 6+ places and had upsert logic that conflicts with the per-copy model.
- **Fix:** Rewrote the service: `add` now always inserts a new row, `addWithTx` simplified, `update` handles variant/purchasePrice/photoUrl/photoKey, `stats` counts rows instead of summing quantity, `list` supports new filter and sort fields.
- **Files modified:** `apps/api/src/modules/collection/collection.service.ts`
- **Commit:** `ee0a9b3`

**4. [Rule 1 - Bug] Fixed UI components referencing removed quantity field**
- **Found during:** Task 3 (web build type-checking)
- **Issue:** Three web components used `quantity: 1` in collection add calls and `collection-manager.tsx` displayed quantity controls.
- **Fix:** Removed `quantity` from all add mutations; replaced quantity +/- buttons with a single "remove copy" button; added variant badge to the collection entry row.
- **Files modified:** `apps/web/src/app/(dashboard)/collection/collection-manager.tsx`, `apps/web/src/app/(dashboard)/scanner/card-scanner.tsx`, `apps/web/src/app/cards/[id]/card-detail.tsx`
- **Commit:** `ee0a9b3`

## Success Criteria Verified

- [x] Collections table: `variant` column present, `quantity` column absent, no UNIQUE(userId, cardId, condition) constraint
- [x] Wishlists table: exists with `type` (want/trade), `preferredVariant`, `maxPrice`, `askingPrice`, `isPublic`
- [x] `cardVariantEnum` and `wishlistTypeEnum` in enums.ts
- [x] `collectionAddSchema` has `variant`, no `quantity`
- [x] `wishlistToggleSchema`, `wishlistUpdateSchema`, `wishlistListSchema` all exported from shared
- [x] `CARD_VARIANTS` exported from shared package
- [x] R2 `UPLOAD_PURPOSES` includes `'collection'` with 5MB limit
- [x] EN/ES message files exist with all collection-related namespaces
- [x] `next-intl` configured with cookie-based locale detection
- [x] `NextIntlClientProvider` wraps the app in root layout
- [x] `pnpm --filter @la-grieta/db type-check` passes
- [x] `pnpm --filter @la-grieta/shared type-check` passes
- [x] `pnpm --filter @la-grieta/web build` passes
