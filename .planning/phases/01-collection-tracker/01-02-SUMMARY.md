---
phase: 01-collection-tracker
plan: 02
subsystem: api-services
tags: [collection, wishlist, trpc, tdd, per-copy-model, r2]
dependency_graph:
  requires:
    - 01-01 (per-copy collections schema, wishlists table, Zod schemas)
  provides:
    - collection tRPC router (list, add, addBulk, update, remove, getByCard, getUploadUrl, stats)
    - wishlist tRPC router (toggle, update, list, getForCard)
    - WishlistService (toggle, update, list, getForCard)
    - CollectionService with R2 upload URL support
    - R2_TOKEN injectable in CoreModule
  affects:
    - apps/web collection UI (can now use getByCard and getUploadUrl)
    - apps/web wishlist UI (full toggle/list/status via tRPC)
tech_stack:
  added:
    - "@la-grieta/r2" workspace dependency in apps/api
    - webpack extensionAlias: .js → [.ts, .js] (enables ESM-style r2 imports)
  patterns:
    - R2Service interface injected via R2_TOKEN (CoreModule) — decoupled from S3Client in tests
    - WishlistService: toggle uses check-then-insert/delete pattern (no upsert conflict — unique index on userId+cardId+type)
    - TDD: RED failing tests written first, GREEN implementation after, all tests pass
key_files:
  created:
    - apps/api/src/modules/wishlist/wishlist.service.ts
    - apps/api/src/modules/wishlist/wishlist.router.ts
    - apps/api/src/modules/wishlist/wishlist.module.ts
    - apps/api/__tests__/wishlist.service.spec.ts
    - packages/db/src/schema/card-prices.js
    - apps/api/webpack.config.js
  modified:
    - apps/api/src/modules/collection/collection.service.ts (added getByCard, getUploadUrl, R2Service interface)
    - apps/api/src/modules/collection/collection.router.ts (added getByCard, getUploadUrl procedures)
    - apps/api/src/modules/collection/collection.module.ts (inject R2_TOKEN)
    - apps/api/src/core/core.module.ts (added R2_TOKEN provider via @la-grieta/r2)
    - apps/api/src/trpc/trpc.module.ts (added WishlistModule)
    - apps/api/src/trpc/trpc.router.ts (added wishlist namespace)
    - apps/api/__tests__/collection.service.spec.ts (full rewrite for per-copy model)
    - apps/api/package.json (added @la-grieta/r2 workspace dep)
decisions:
  - "R2Service injected as interface (not direct S3Client) — keeps CollectionService testable without S3 credentials; CoreModule creates the concrete wrapper"
  - "WishlistRouter added as tRPC namespace in root router — consistent with auth, card, collection pattern"
  - "card-prices.js compiled stub created manually — same stale-JS pattern as Plan 01-01 (webpack resolves .js before .ts)"
metrics:
  duration_minutes: 14
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 8
  deviations: 3
  completed_date: "2026-03-12"
---

# Phase 1 Plan 2: Collection Service Rework and Wishlist Module Summary

Per-copy collection service rework with getByCard/getUploadUrl, full wishlist module (toggle/update/list/getForCard), R2 integration via injectable interface, and 61 passing unit tests (41 collection + 20 wishlist).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Rework collection service + router for per-copy model | `5e57feb` |
| 2 | Create wishlist module (service + router + tests) | `695cd80` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing card-prices.js compiled stub**
- **Found during:** Task 1 (test runner startup)
- **Issue:** `packages/db/src/schema/index.js` required `./card-prices` but no `.js` compiled file existed. This blocked the entire test suite from loading.
- **Fix:** Created `packages/db/src/schema/card-prices.js` mirroring the TypeScript source.
- **Files modified:** `packages/db/src/schema/card-prices.js`
- **Commit:** `5e57feb`

**2. [Rule 2 - Missing critical functionality] Added R2Service interface injection**
- **Found during:** Task 1 (implementation)
- **Issue:** `@la-grieta/r2` uses ESM-style `.js` extension imports (`./presign.js`, `./config.js`). Direct imports would require adding the package and fixing webpack. Instead, an `R2Service` interface was used so the service stays testable without S3 credentials.
- **Fix:** Defined `R2Service` interface in `collection.service.ts`, created `R2_TOKEN` in `CoreModule` using a factory wrapper. Tests use a simple mock object.
- **Files modified:** `core.module.ts`, `collection.module.ts`, `collection.service.ts`
- **Commit:** `5e57feb`

**3. [Rule 3 - Blocking] Added webpack extensionAlias for .js → .ts resolution**
- **Found during:** API build verification
- **Issue:** NestJS webpack build failed with "Can't resolve './presign.js'" when bundling `@la-grieta/r2`. The R2 package uses explicit `.js` extensions in TypeScript source (ESM convention).
- **Fix:** Added `resolve.extensionAlias: { '.js': ['.ts', '.js'] }` to `webpack.config.js`.
- **Files modified:** `apps/api/webpack.config.js`
- **Commit:** `e8ded67`

## Success Criteria Verified

- [x] Collection service uses pure insert (no upsert) — add() always creates a new row
- [x] addBulk() creates one row per entry, throws BAD_REQUEST for > 50 entries
- [x] update() modifies variant/condition/purchasePrice/photoUrl/notes on a specific copy with ownership check
- [x] remove() deletes exactly one copy row with ownership check
- [x] list() returns paginated entries with card data, supports all filters and sort options
- [x] getByCard() returns all copies of a specific card for a user
- [x] getUploadUrl() returns R2 presigned URL with 'collection' purpose
- [x] Wishlist toggle creates/removes entries for want and trade types independently
- [x] Same card can be on both wantlist and tradelist simultaneously
- [x] Wishlist update modifies preferredVariant, maxPrice, askingPrice, isPublic
- [x] Wishlist list returns paginated entries with card data, filtered by type
- [x] getForCard returns {onWantlist, onTradelist, wantEntry?, tradeEntry?}
- [x] WishlistModule registered in TrpcModule, wishlist namespace in trpc.router.ts
- [x] `pnpm --filter @la-grieta/api test -- collection.service` — 41 tests pass
- [x] `pnpm --filter @la-grieta/api test -- wishlist.service` — 20 tests pass
- [x] `pnpm --filter @la-grieta/api type-check` passes
- [x] `pnpm --filter @la-grieta/api build` succeeds
- [x] No `quantity` references in collection service code (only a comment)

## Self-Check: PASSED
