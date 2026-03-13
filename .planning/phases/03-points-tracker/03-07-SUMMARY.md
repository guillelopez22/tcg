---
phase: 03-points-tracker
plan: "07"
subsystem: match-setup-flow
tags: [match, deck-selection, guest-deck-builder, play-mat, battlefield]
dependency_graph:
  requires: [deck.list, deck.getById, card.list, match-socket]
  provides: [deck-selection-step, champion-unit-step, play-mat-layout]
  affects: [match-wizard, guest-deck-builder, match-board]
tech_stack:
  added: []
  patterns: [wizard-step-expansion, auto-advance-useEffect, symmetric-play-mat]
key_files:
  created: []
  modified:
    - apps/web/src/app/(dashboard)/match/new/page.tsx
    - apps/web/src/app/match/[code]/guest-deck-builder.tsx
    - apps/web/src/app/match/[code]/match-board.tsx
    - apps/api/src/modules/deck/deck.service.ts
decisions:
  - "Deck selection step triggers handleCreateMatch (not goNext) — createMatch.onSuccess sets correct step for local vs synced"
  - "Guest deck builder uses auto-advance useEffect to transition steps rather than inline navigation after addCard"
  - "VerticalScoreTracker renders circles from high to low (top=8, bottom=0) matching physical mat orientation"
  - "PlayerZoneRows mirrors layout for opponent (Main Deck on left, Champion on right)"
metrics:
  duration: "~25 min"
  completed_date: "2026-03-13"
  tasks_completed: 3
  files_modified: 4
requirements: [PTS-01, PTS-03]
---

# Phase 03 Plan 07: Match Setup & Guest Builder UAT Gap Closure Summary

Deck selection step in match wizard, Champion Unit picker in guest deck builder, and play mat layout for match board — three highest-severity UAT gaps blocking the core match gameplay loop.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add deck selection step to match setup wizard | d5b702b | match/new/page.tsx, deck.service.ts |
| 2 | Add Champion Unit selection to guest deck builder | 4fcfbe8 | guest-deck-builder.tsx |
| 3 | Redesign match board to match physical play mat layout | a160901 | match-board.tsx |

## What Was Built

**Task 1 — Deck selection step in match wizard**

The match wizard expanded from 6 to 7 steps. Step 5 (new) shows the user's decks fetched via `trpc.deck.list.useQuery`. Selecting a deck triggers `handleCreateMatch` immediately (not `goNext`), since `createMatch.onSuccess` handles navigation to the correct next step (step 6 for synced, step 7 for local). A `trpc.deck.getById.useQuery` call extracts battlefield zone cards from the selected deck; a `useEffect` populates `battlefieldCards` state which flows into `BattlefieldSelection` at step 7. Skip option provided for users without decks.

**Task 2 — Champion Unit selection in guest deck builder**

Step type changed from `'champion' | 'cards'` to `'legend' | 'champion' | 'cards'`. The `card.list` query now filters by `cardType` based on current step: `'Legend'` at legend step, `'Champion Unit'` at champion step, and no filter at cards step. Auto-advance uses a `useEffect` on `entries` + `step` — when a legend is added while on legend step, automatically transitions to champion step; when a champion unit is added on champion step, transitions to cards step. Back navigation added to champion step. Session storage restore handles all three steps. A shared `renderPickerStep()` helper eliminates duplication between legend and champion pickers.

**Task 3 — Physical play mat layout for match board**

Complete layout redesign:
- Top bar: compact (exit + ABCD inline circles + match code/turn)
- Opponent zones: `PlayerZoneRows` with `isOpponent=true` (mirrored layout)
- Center: left `VerticalScoreTracker` (opponent) + battlefield zones + right `VerticalScoreTracker` (me)
- My zones: `PlayerZoneRows` with `isOpponent=false`
- Controls bar: turn controls + turn log

`VerticalScoreTracker` renders 9 circles (0 to winTarget) stacked vertically from high (top) to low (bottom). Current score circle is full-color + scaled; filled-below circles are dimmed; empty circles use gold border on navy background. `PlayerZoneRows` renders Base row (Champion | Legend | space | Main Deck) and Runes row (Runes Deck | space | Trash) with opponent mirroring. Gold/navy color scheme (`bg-[#0a1628]`, `border-[#c5a84a]/30`). All existing functionality (overlays, tap handlers, turn controls, turn log) preserved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ResolvedDeckCardEntry.zone missing sideboard**
- **Found during:** Task 1 TypeScript check
- **Issue:** `getZoneForCardType` returns `DeckZone` which includes `'sideboard'`, but `ResolvedDeckCardEntry.zone` type was `'main' | 'rune' | 'legend' | 'champion' | 'battlefield'` — missing `'sideboard'`
- **Fix:** Added `'sideboard'` to the union type in `deck.service.ts`
- **Files modified:** `apps/api/src/modules/deck/deck.service.ts`
- **Commit:** d5b702b

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/web/src/app/(dashboard)/match/new/page.tsx | FOUND |
| apps/web/src/app/match/[code]/guest-deck-builder.tsx | FOUND |
| apps/web/src/app/match/[code]/match-board.tsx | FOUND |
| .planning/phases/03-points-tracker/03-07-SUMMARY.md | FOUND |
| Commit d5b702b (deck selection step) | VERIFIED |
| Commit 4fcfbe8 (champion unit step) | VERIFIED |
| Commit a160901 (play mat layout) | VERIFIED |
| Artifact: deck.list in match/new/page.tsx | FOUND |
| Artifact: Champion Unit in guest-deck-builder.tsx | FOUND |
| Artifact: player-base-row in match-board.tsx | FOUND |
