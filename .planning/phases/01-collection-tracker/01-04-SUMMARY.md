---
phase: 01-collection-tracker
plan: 04
subsystem: scanner
tags: [scanner, camera, confirmation, session, tdd, ncc, fingerprint]
dependency_graph:
  requires: ["01-01", "01-02"]
  provides: ["scanner-flow", "scan-session"]
  affects: ["collection"]
tech_stack:
  added: []
  patterns: ["TDD (RED/GREEN)", "bottom-sheet overlay", "session state", "localStorage settings"]
key_files:
  created:
    - apps/api/__tests__/scanner.service.spec.ts
    - apps/web/src/app/(dashboard)/scanner/scan-confirmation.tsx
    - apps/web/src/app/(dashboard)/scanner/scan-session-summary.tsx
    - apps/web/src/app/(dashboard)/scanner/scanner-settings.tsx
    - apps/web/src/app/(dashboard)/scanner/scanner-orchestrator.tsx
  modified:
    - apps/api/src/modules/scanner/scanner.service.ts
    - apps/api/src/modules/scanner/scanner.router.ts
    - apps/web/src/app/(dashboard)/scanner/card-scanner.tsx
    - apps/web/src/app/(dashboard)/scanner/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/es.json
decisions:
  - "NCC_IDENTIFY_THRESHOLD = 0.93 exported as named constant — testable without hardcoding in tests"
  - "displayPct formula: Math.round(((score - 0.3) / 0.7) * 100), clamped to [0, 100]"
  - "identify() filters at 0.93 server-side (was 0.3) — client no longer needs to re-filter"
  - "ScannerOrchestrator manages view state (scanning vs summary); CardScanner receives session via props"
  - "addBulk used for multi-copy adds: quantity copies = array of N identical entries"
  - "Cooldown stored in localStorage key scanner:cooldown — survives page reload"
  - "Session counter badge shows total copy count (not unique card count)"
  - "Session summary deduplications: want/trade toggles shown once per unique cardId across multi-quantity entries"
metrics:
  duration_minutes: 25
  completed_date: "2026-03-12"
  tasks_completed: 3
  files_modified: 13
---

# Phase 1 Plan 4: Scanner Enhanced Flow Summary

Scanner flow enhanced with NCC threshold constant, server-side confidence filtering, explicit confirmation overlay with variant/quantity/condition selection, configurable cooldown auto-resume, session counter, and full pack-opening session summary with per-card want/trade toggles.

## What Was Built

### Task 1: Scanner Service TDD (RED → GREEN)

Added `NCC_IDENTIFY_THRESHOLD = 0.93` as an exported constant to `scanner.service.ts`. Extended `ScannerMatch` interface with `displayPct` field. Updated `identify()` to filter at 0.93 (replacing the old 0.3 lower bound) and compute `displayPct = Math.round(((score - 0.3) / 0.7) * 100)` for each match. Updated `scanner.router.ts` output schema to include `displayPct`.

Created `scanner.service.spec.ts` with 12 tests covering:
- NCC_IDENTIFY_THRESHOLD constant value (0.93)
- PRECONDITION_FAILED when service not ready
- BAD_REQUEST when sharp pipeline fails
- Identical image returns match with score >= 0.93
- Both `score` and `displayPct` present in results
- displayPct formula verified at score ~1.0
- displayPct = 100 at score = 1.0
- Uniform blank image returns no matches (zero-vector → NCC = 0)
- All returned matches have score >= NCC_IDENTIFY_THRESHOLD
- Best match is first (descending by score)

### Task 2: Confirmation Flow, Settings, Session State

**`scan-confirmation.tsx`** — Bottom-sheet overlay with slide-up animation. Shows card art (w-16 aspect-ratio thumbnail), card name, set, confidence percentage with rift-colored badge. Variant toggle (4 buttons: Normal/Alt-Art/Overnumbered/Signature). Condition picker (5 options: NM/LP/MP/HP/DMG). Quantity +/- stepper (range 1-20). Add button calls `trpc.collection.addBulk` with quantity entries. Skip closes without adding and resumes scan.

**`scanner-settings.tsx`** — Settings gear dropdown. Cooldown options: [1s, 2s, 3s, 5s, 10s]. Persisted to `localStorage` key `scanner:cooldown`. Default: 3s. Auto-closes on outside click.

**`card-scanner.tsx`** — Reworked to accept `session` and `cooldown` props. Session state lifted to `ScannerOrchestrator`. Uses `addBulk` mutation. After add: enters cooldown state, shows "Resuming..." status, then resumes scanning. Session counter badge shows total copy count overlaid on camera feed. Consecutive hit detection unchanged (3 scans required for confidence).

**`scanner-orchestrator.tsx`** — New client component managing view (`scanning` | `summary`) and session array. Holds cooldown state loaded from localStorage on mount. Passes session and cooldown down to CardScanner. Contains "End Session" button in header when session > 0.

**`page.tsx`** — Updated to lazy-load `ScannerOrchestrator` instead of `CardScanner` directly.

### Task 3: Scan Session Summary

**`scan-session-summary.tsx`** — Full-page summary. Header with total copy count badge. Scrollable card list with per-entry: card art thumbnail (w-12), card name + set, variant badge, condition badge, quantity badge (if >1), market price placeholder (—), purchase price input (calls `trpc.collection.update` on blur), want/trade toggle buttons (shown once per unique cardId). Footer shows total session value (— pending price data) and total copies count. Fixed bottom bar with "Scan More" (returns to camera, keeps session) and "Done" (navigates to /collection).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing type error in add-cards-modal.tsx**
- **Found during:** Task 2 web build verification
- **Issue:** `c.set?.name` referenced on card list items but `trpc.card.list` does not include a `set` nested object — only `setId`. TypeScript correctly errored.
- **Fix:** Changed `c.set?.name ?? ''` to `''` since set name data is unavailable from the list endpoint. Set-name search in Fuse.js was already broken silently (the property was undefined at runtime), so this makes the behavior explicit.
- **Files modified:** `apps/web/src/app/(dashboard)/collection/add-cards-modal.tsx`
- **Commit:** c0dcb6e

**2. [Rule 3 - Blocking] Next.js 14.2.x Windows build file system race condition**
- **Found during:** Task 2/3 build verification
- **Issue:** `pnpm --filter @la-grieta/web build` fails with ENOENT during `Finalizing page optimization` on Windows. This is a known Next.js 14.2.x platform bug (noted in CLAUDE.md Known Issues).
- **Fix:** TypeScript compilation (`tsc --noEmit`) confirmed zero errors. `✓ Compiled successfully` and `✓ Generating static pages (11/11)` both pass. The ENOENT failure is in Next.js post-build file operations unrelated to code correctness.
- **Impact:** Dev server works normally. Production deploy on Railway/Linux is unaffected (Linux doesn't have this Windows path handling issue).

## Self-Check

Files verified present:
- [x] `apps/api/__tests__/scanner.service.spec.ts` — 12 tests, all passing
- [x] `apps/web/src/app/(dashboard)/scanner/scan-confirmation.tsx` — contains `confidence`
- [x] `apps/web/src/app/(dashboard)/scanner/scan-session-summary.tsx` — contains `sessionSummary`
- [x] `apps/web/src/app/(dashboard)/scanner/scanner-settings.tsx` — contains `cooldown`
- [x] `apps/web/src/app/(dashboard)/scanner/card-scanner.tsx` — contains `getUserMedia`
- [x] `apps/web/src/app/(dashboard)/scanner/scanner-orchestrator.tsx`

Commits verified:
- 7b705c0 — scanner service + router + tests
- c0dcb6e — scanner UI components

## Self-Check: PASSED
