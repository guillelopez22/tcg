---
phase: 02-deck-builder-enhancements
plan: "01"
subsystem: deck
tags: [deck, share-codes, import, drizzle, tRPC, nanoid, vitest]
dependency_graph:
  requires: []
  provides:
    - deck_share_codes DB table schema
    - drawHand pure utility (@la-grieta/shared)
    - autoDetectAndParse deck import parser (@la-grieta/shared)
    - shareCodeGenerateSchema, shareCodeResolveSchema, deckImportTextSchema, deckImportUrlSchema Zod schemas
    - generateShareCode, resolveShareCode, importFromText, importFromUrl DeckService methods
    - 4 new tRPC endpoints in DeckRouter
    - championName filter on browse()
  affects:
    - apps/api/src/modules/deck/deck.service.ts
    - apps/api/src/modules/deck/deck.router.ts
    - packages/shared (new utils, extended schemas)
    - packages/db (new schema, updated relations)
tech_stack:
  added:
    - nanoid (customAlphabet, LG-prefixed share codes)
  patterns:
    - TDD red/green cycle for pure utilities
    - Fisher-Yates shuffle for drawHand
    - Heuristic format detection in deck import parser
    - Retry-on-collision for share code generation
    - ILIKE subquery for championName browse filter
key_files:
  created:
    - packages/db/src/schema/deck-share-codes.ts
    - packages/db/src/schema/deck-share-codes.js
    - packages/db/src/schema/deck-share-codes.d.ts
    - packages/shared/src/utils/draw-hand.ts
    - packages/shared/src/utils/draw-hand.js
    - packages/shared/src/utils/draw-hand.d.ts
    - packages/shared/src/utils/deck-import-parser.ts
    - packages/shared/src/utils/deck-import-parser.js
    - packages/shared/src/utils/deck-import-parser.d.ts
    - tools/seed/src/migrate-02-01.cjs
    - apps/api/__tests__/draw-hand.spec.ts
    - apps/api/__tests__/deck-import-parser.spec.ts
  modified:
    - packages/db/src/schema/index.ts (.js, .d.ts)
    - packages/db/src/relations.ts (.js, .d.ts)
    - packages/shared/src/schemas/deck.schema.ts (.js, .d.ts)
    - packages/shared/src/index.ts (.js, .d.ts)
    - apps/api/src/modules/deck/deck.service.ts
    - apps/api/src/modules/deck/deck.router.ts
    - apps/api/package.json (nanoid dependency)
decisions:
  - "drawHand uses Fisher-Yates shuffle (Math.random) — adequate for preview hands, not cryptographic"
  - "autoDetectAndParse handles plural zone headers (Runes:, Champions:) via regex normalization"
  - "resolveShareCode registered as tRPC QUERY (read-only) not mutation — callers use .useQuery()"
  - "importFromText does NOT create deck — returns resolved+unmatched for client preview first"
  - "importFromUrl strips HTML tags with simple regex — sufficient for deck list text extraction"
  - "championName filter uses SQL subquery on deck_cards JOIN cards — avoids extra application-level query"
metrics:
  duration: "8 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_created: 13
  files_modified: 11
---

# Phase 02 Plan 01: Backend Foundation for Deck Phase 2 Summary

Deck share codes, hand simulation, text/URL import, and community browse with champion filter — complete API surface for the Phase 2 deck builder UX plans.

## What Was Built

All backend infrastructure for Phase 2 deck builder features, with no frontend work in this plan:

1. **deck_share_codes DB table** — `deckShareCodes` Drizzle schema with `code VARCHAR(12)` primary key, FK to `decks.id` (cascade delete), and index on `deck_id`. Migration script at `tools/seed/src/migrate-02-01.cjs`.

2. **drawHand pure utility** — Fisher-Yates shuffle on quantity-expanded pool, returns `HandCard[]` (cardId, name, imageSmall). Exported from `@la-grieta/shared`. Caller responsible for passing only main-deck cards.

3. **autoDetectAndParse deck import parser** — Heuristic format detection (riftbound-gg, piltover-archive, unknown), zone header parsing (Champion/Runes/Main Deck with plural support), quantity prefix/suffix patterns. Never silently drops lines — unmatched lines collected in `unmatched[]`.

4. **4 new Zod schemas** — `shareCodeGenerateSchema`, `shareCodeResolveSchema`, `deckImportTextSchema`, `deckImportUrlSchema`. `deckBrowseSchema` extended with optional `championName` field.

5. **DeckService new methods** — `generateShareCode` (LG-XXXXXX nanoid, 3 retry attempts), `resolveShareCode` (NOT_FOUND on missing code), `importFromText` (ILIKE card name resolution), `importFromUrl` (10s AbortController timeout, HTML text extraction).

6. **DeckRouter 4 new endpoints** — `generateShareCode` (mutation), `resolveShareCode` (query — read-only), `importFromText` (mutation), `importFromUrl` (mutation).

7. **browse() championName filter** — SQL subquery on deck_cards+cards for champion zone filtering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zone header plural support (Runes:, Champions:, Main Deck:)**
- **Found during:** Task 1 TDD green phase
- **Issue:** ZONE_HEADER_RE only matched singular forms; test input used "Runes:" which failed to match
- **Fix:** Updated regex to `(champions?|legends?|runes?|mains?...)` with plural normalization via `.replace(/s$/, '')`
- **Files modified:** `packages/shared/src/utils/deck-import-parser.ts`, `.js`
- **Commit:** 703b3ac

## Test Results

- **draw-hand.spec.ts:** 4/4 passing
- **deck-import-parser.spec.ts:** 4/4 passing
- **deck.service.spec.ts:** 59/66 passing (7 pre-existing failures unrelated to this plan — copy validation tests that failed before this plan started)

## Self-Check: PASSED

- deck-share-codes.ts: FOUND
- draw-hand.ts: FOUND
- deck-import-parser.ts: FOUND
- migrate-02-01.cjs: FOUND
- draw-hand.spec.ts: FOUND
- deck-import-parser.spec.ts: FOUND
- Task 1 commit 703b3ac: FOUND
- Task 2 commit 128e44d: FOUND
