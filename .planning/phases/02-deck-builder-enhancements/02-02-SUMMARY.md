---
phase: 02-deck-builder-enhancements
plan: "02"
subsystem: web-ui
tags: [deck-builder, hand-simulator, share-codes, deck-import, ui]
dependency_graph:
  requires: [02-01]
  provides: [hand-simulator-ui, share-button-ui, import-modal-ui]
  affects: [deck-detail-page, deck-list-page]
tech_stack:
  added: []
  patterns: [trpc-query-fetch, sonner-toast, lg-design-system, client-side-shuffle]
key_files:
  created:
    - apps/web/src/app/(dashboard)/decks/[id]/hand-simulator.tsx
    - apps/web/src/app/(dashboard)/decks/import-deck-modal.tsx
    - apps/web/src/app/(dashboard)/decks/import-preview.tsx
  modified:
    - apps/web/src/app/(dashboard)/decks/[id]/deck-detail.tsx
    - apps/web/src/app/(dashboard)/decks/[id]/deck-card-editor.tsx
    - apps/web/src/app/(dashboard)/decks/deck-list.tsx
decisions:
  - "HandSimulator renders below tabs on all deck detail views, not gated by active tab"
  - "ShareButton extracts as named component in deck-detail.tsx for reuse clarity"
  - "DeckCardEditor receives isPublic prop (optional) — share button only renders when true"
  - "ImportDeckModal uses utils.deck.resolveShareCode.fetch() (tRPC query .fetch()) not useMutation"
  - "Import always creates new deck via deck.create — no merge with existing decks"
metrics:
  duration_minutes: 6
  completed_date: "2026-03-12"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
requirements_completed: [DECK-03, DECK-05, DECK-06, DECK-07]
---

# Phase 02 Plan 02: Deck Builder UI — Hand Simulator, Share & Import Summary

**One-liner:** Hand simulator with Fisher-Yates draw/mulligan, share code clipboard button, and 3-tab import modal (share code / text paste / URL) with required preview step before deck creation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Hand simulator component + deck detail integration | eba7f5b | hand-simulator.tsx, deck-detail.tsx |
| 2 | Share button on deck detail header and editor toolbar | c9b6baf | deck-detail.tsx, deck-card-editor.tsx |
| 3 | Import modal with 3 tabs and preview step | aec59cb | import-deck-modal.tsx, import-preview.tsx, deck-list.tsx |

## What Was Built

### HandSimulator (`hand-simulator.tsx`)
- 'use client' component; receives full `cards` array, filters to `zone === 'main'` internally
- "Draw Sample Hand" button uses `drawHand()` from `@la-grieta/shared` (pure client-side, Fisher-Yates)
- Mulligan mode: click up to 2 cards to mark for return, "Confirm Mulligan" draws replacements
- "Draw Again" reshuffles and deals a fresh 4-card hand
- Renders in deck-detail.tsx below the analytics tab whenever main-zone cards exist
- Labeled "Sample Hand" per Riot Digital Tools Policy (preview framing, no win-rate stats)

### Share Button
- `ShareButton` component in deck-detail.tsx: calls `trpc.deck.generateShareCode` mutation, copies code via `navigator.clipboard.writeText`, shows `toast.success('Share code copied: LG-XXXXXX')`
- Only renders when `deck.isPublic === true` AND user is owner
- Same pattern added to `DeckCardEditor` toolbar via new `isPublic?: boolean` prop
- Error case shows server error message via `toast.error()`

### Import Modal (`import-deck-modal.tsx` + `import-preview.tsx`)
- 3-tab layout: Share Code | Text Paste | URL
- **Share Code tab**: calls `utils.deck.resolveShareCode.fetch()` (tRPC QUERY via `.fetch()`, not `.mutate()`), shows full deck preview, imports as "Copy of [name]"
- **Text Paste tab**: `trpc.deck.importFromText.mutate()`, shows `ImportPreview` with unmatched warning banner
- **URL tab**: `trpc.deck.importFromUrl.mutate()` with loading state, same preview flow
- `ImportPreview` component: groups resolved cards by zone (champion / main / runes), displays unmatched names in amber warning banner, requires user to click "Import to My Decks" before deck is created
- After `deck.create` succeeds: shows toast, closes modal, redirects to new deck via `router.push('/decks/:id')`
- Import button on deck-list.tsx header (next to "+ New Deck")

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: `npx tsc --noEmit` passes (one pre-existing error in deck-wizard.tsx unrelated to this plan)
- All new components use `lg-*` design system classes
- resolveShareCode uses `.fetch()` (query), not `.mutate()`
- Hand simulator: main-zone only, no probability stats, no server calls
- Import preview always shown before deck creation

## Self-Check: PASSED

- `apps/web/src/app/(dashboard)/decks/[id]/hand-simulator.tsx` — FOUND
- `apps/web/src/app/(dashboard)/decks/import-deck-modal.tsx` — FOUND
- `apps/web/src/app/(dashboard)/decks/import-preview.tsx` — FOUND
- Commit eba7f5b — FOUND
- Commit c9b6baf — FOUND
- Commit aec59cb — FOUND
