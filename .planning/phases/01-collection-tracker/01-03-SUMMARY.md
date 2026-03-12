---
phase: 01-collection-tracker
plan: 03
subsystem: ui
tags: [next.js, trpc, fuse.js, next-intl, r2, photo-upload, collection, wantlist, tradelist]

dependency_graph:
  requires:
    - 01-01 (per-copy collections schema, wishlists table, i18n scaffolds, next-intl)
    - 01-02 (collection tRPC router with getByCard/getUploadUrl, wishlist tRPC router)
  provides:
    - Four-tab collection page (Collection | Wantlist | Tradelist | Stats placeholder)
    - CollectionGrid with copy count badges, full filter/sort bar, infinite scroll, FAB
    - AddCardsModal with fuse.js fuzzy search, multi-select, addBulk mutation
    - WantlistTab and TradelistTab with card grids and empty states
    - Card detail page at /collection/[cardId] with large art, wishlist toggles, copy accordion
    - CopyList accordion with inline CopyEditForm (variant/condition/price/notes/photo)
    - PhotoUpload reusable component (R2 presigned URL flow, XMLHttpRequest progress)
    - lg-tab-active, lg-tab-inactive, lg-badge-count, lg-fab, lg-modal-backdrop, lg-modal-sheet CSS classes
  affects:
    - Plan 04 (camera scanner — links to /collection/[cardId])
    - Plan 05 (stats tab — placeholder built here, filled in Plan 05)

tech_stack:
  added: []
  patterns:
    - Copy count badges via cardId-keyed Map grouping of flat collection.list entries
    - Fuse.js client-side fuzzy search loaded once via parallel page-based useQuery fetches
    - R2 upload via XMLHttpRequest for real progress events (fetch API has no progress)
    - Accordion pattern for copy editing — single expanded ID in useState, collapse on save/remove
    - Wishlist toggles show filled/unfilled icon state from getForCard query cache

key_files:
  created:
    - apps/web/src/app/(dashboard)/collection/page.tsx
    - apps/web/src/app/(dashboard)/collection/collection-tabs.tsx
    - apps/web/src/app/(dashboard)/collection/collection-grid.tsx
    - apps/web/src/app/(dashboard)/collection/add-cards-modal.tsx
    - apps/web/src/app/(dashboard)/collection/wantlist-tab.tsx
    - apps/web/src/app/(dashboard)/collection/tradelist-tab.tsx
    - apps/web/src/app/(dashboard)/collection/[cardId]/page.tsx
    - apps/web/src/app/(dashboard)/collection/[cardId]/copy-list.tsx
    - apps/web/src/app/(dashboard)/collection/[cardId]/copy-edit-form.tsx
    - apps/web/src/components/ui/photo-upload.tsx
  modified:
    - apps/web/src/app/globals.css (new lg-tab-*, lg-badge-count, lg-fab, lg-modal-* classes)

key-decisions:
  - "addBulk returns Collection[] array (not { count }) — success toast uses data.length"
  - "Copy count badges computed client-side by grouping flat collection.list entries by cardId — no dedicated count endpoint needed"
  - "All 4 card variants shown in CopyEditForm for all cards — per-card variant filtering deferred per RESEARCH.md open question (comment added in code)"
  - "PhotoUpload uses XMLHttpRequest instead of fetch for real upload progress events"
  - "createdAt arrives as string from tRPC JSON serialization — CopyList Copy interface uses Date | string"

requirements-completed:
  - COLL-01
  - COLL-03
  - COLL-04
  - COLL-05
  - COLL-06
  - COLL-07
  - COLL-08

duration: 10min
completed: "2026-03-12"
---

# Phase 1 Plan 3: Collection UI Summary

**Four-tab collection management UI (grid with copy badges, add modal with fuse.js search, card detail with per-copy inline editing, wantlist/tradelist grids, R2 photo upload) built on Plan 02's tRPC API.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-12T04:08:13Z
- **Completed:** 2026-03-12T04:18:13Z
- **Tasks:** 2 completed, 1 awaiting human verification
- **Files created:** 10, modified: 1

## Accomplishments
- Four-tab collection page replacing the old list-based collection-manager with proper card image grid
- AddCardsModal with fuse.js client-side fuzzy search, multi-select tap-to-increment, addBulk on confirm
- Card detail page at `/collection/[cardId]` with large card art, wantlist/tradelist toggle buttons, copy accordion
- Per-copy inline editing (variant/condition/price/notes/photo) with red delete button and confirmation dialog
- PhotoUpload reusable component handling R2 presigned URL flow with real progress via XMLHttpRequest

## Task Commits

1. **Task 1: Collection page with tabs, card grid, filters, and add modal** - `9f236f6` (feat)
2. **Task 2: Card detail page with copy list, edit form, and wishlist toggles** - `a2f5368` (feat)
3. **Task 3: Verify collection UI end-to-end** — awaiting human verification

## Files Created/Modified
- `apps/web/src/app/(dashboard)/collection/page.tsx` — Four-tab collection page (replaces old server component)
- `apps/web/src/app/(dashboard)/collection/collection-tabs.tsx` — Tab bar with aria roles
- `apps/web/src/app/(dashboard)/collection/collection-grid.tsx` — Image grid with copy badges, filters, sort, FAB
- `apps/web/src/app/(dashboard)/collection/add-cards-modal.tsx` — Bottom sheet modal with fuse.js multi-select search
- `apps/web/src/app/(dashboard)/collection/wantlist-tab.tsx` — Wantlist grid with empty state
- `apps/web/src/app/(dashboard)/collection/tradelist-tab.tsx` — Tradelist grid with asking price badge
- `apps/web/src/app/(dashboard)/collection/[cardId]/page.tsx` — Card detail page with wishlist toggles
- `apps/web/src/app/(dashboard)/collection/[cardId]/copy-list.tsx` — Accordion of copies
- `apps/web/src/app/(dashboard)/collection/[cardId]/copy-edit-form.tsx` — Inline per-copy edit form
- `apps/web/src/components/ui/photo-upload.tsx` — Reusable R2 presigned URL upload component
- `apps/web/src/app/globals.css` — Added lg-tab-active, lg-tab-inactive, lg-badge-count, lg-fab, lg-modal-backdrop, lg-modal-sheet

## Decisions Made
- addBulk returns `Collection[]` not `{ count }` — success toast uses `data.length`
- Copy count badges computed client-side by grouping flat `collection.list` entries by cardId
- All 4 variants shown in CopyEditForm for all cards — per-card variant filtering deferred (comment in code)
- PhotoUpload uses XMLHttpRequest for real upload progress (fetch API has no progress events)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed addBulk return type assumption**
- **Found during:** Task 1 (build verification)
- **Issue:** Plan said show `{count} cards added` in success toast, but `trpc.collection.addBulk` returns `Collection[]` array, not `{ count }`. TypeScript caught the error during type-check.
- **Fix:** Changed toast to use `data.length` instead of `data.count`
- **Files modified:** `apps/web/src/app/(dashboard)/collection/add-cards-modal.tsx`
- **Committed in:** `9f236f6` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed createdAt type mismatch in CopyList**
- **Found during:** Task 2 (build verification)
- **Issue:** tRPC serializes `Date` fields as `string` in JSON. The `Copy` interface in `copy-list.tsx` declared `createdAt: Date` but the API returns `string`. TypeScript error on the `copies` prop.
- **Fix:** Changed `createdAt: Date` to `createdAt: Date | string` and used `new Date(copy.createdAt as string)` for formatting
- **Files modified:** `apps/web/src/app/(dashboard)/collection/[cardId]/copy-list.tsx`
- **Committed in:** `a2f5368` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — type bugs caught by TypeScript)
**Impact on plan:** Both auto-fixes were type correctness — no behavior change. No scope creep.

## Issues Encountered
- Next.js 14.2.x Windows build trace ENOENT error (`_error.js.nft.json`) occurs after successful compilation — known issue from MEMORY.md, does not affect compiled output. Type-check and static page generation both pass successfully.

## Next Phase Readiness
- Collection UI is complete — all CRUD operations from Plan 02 have a UI surface
- Card detail page at `/collection/[cardId]` is ready for scanner links (Plan 04)
- Stats tab renders placeholder — ready to be filled in Plan 05

## Self-Check: PASSED

All 10 created files exist on disk. Commits `9f236f6` and `a2f5368` confirmed in git log.
