---
phase: 03-points-tracker
plan: 04
subsystem: web-frontend
tags: [nextjs, socket.io-client, react-hooks, canvas-confetti, match-board, battlefield-zones]

# Dependency graph
requires:
  - phase: 03-03
    provides: match-socket.ts singleton, JoinForm with Socket.IO connection, battlefield-selection.tsx, guest-deck-builder.tsx

provides:
  - useMatchSocket hook: typed Socket.IO state management (state:full/state:patch/match:ended events + all emit helpers)
  - MatchBoard: full-screen match gameplay view (fixed-position, hides dashboard nav)
  - BattlefieldZone: tappable card-art-backed battlefield with control color ring and haptic feedback
  - ScoreDisplay: N/target score format with player color accent and active-turn glow
  - TurnControls: ABCD phase tracker, End Turn / Advance Phase button, undo/pause/concede
  - TurnLog: collapsible turn history with auto-scroll
  - MatchEndOverlay: win celebration with canvas-confetti, AudioContext victory chime, haptic feedback
  - Updated match-socket.ts: extended ServerToClientEvents + ClientToServerEvents with all gameplay events

affects:
  - 03-05 (match history detail): MatchBoard transitions to /match on exit

# Tech tracking
tech-stack:
  added:
    - "canvas-confetti (already in package.json from Plan 03)"
  patterns:
    - useMatchSocket hook: listens to state:full (MatchWithPlayers) and state:patch (MatchState) separately — full state sets session metadata, patch updates live scores
    - MatchBoard hides .lg-mobile-nav via DOM manipulation on mount/unmount
    - Phase advance done via TurnControls (cleaner control strip) — phase badges are display-only in MatchBoard, advance via button
    - +1 score flash: detects A→B phase transition in useEffect, sets flashingBattlefields for 1.2s
    - 8th point rule toast: scans last log entry for '8th point rule' substring
    - Victory chime: programmatic AudioContext oscillators at C5/E5/G5/C6 frequencies, no audio file dependency

key-files:
  created:
    - apps/web/src/hooks/use-match-socket.ts
    - apps/web/src/app/match/[code]/match-board.tsx
    - apps/web/src/app/match/[code]/battlefield-zone.tsx
    - apps/web/src/app/match/[code]/score-display.tsx
    - apps/web/src/app/match/[code]/turn-controls.tsx
    - apps/web/src/app/match/[code]/turn-log.tsx
    - apps/web/src/app/match/[code]/match-end-overlay.tsx
  modified:
    - apps/web/src/lib/match-socket.ts (extended event types for gameplay)
    - apps/web/src/app/match/[code]/join-form.tsx (renders MatchBoard at active step)
    - apps/web/src/app/match/[code]/page.tsx (minor — comment update)
    - apps/web/src/app/globals.css (animate-pulse-slow, animate-score-flash keyframes)

key-decisions:
  - "match-socket.ts extended with state:full/state:patch/player:disconnected server events and all client gameplay events — useMatchSocket can now use fully typed socket.emit() without casts"
  - "useMatchSocket separates fullState (MatchWithPlayers session metadata) from matchState (MatchState scoring engine) — state:full sets both, state:patch only updates matchState"
  - "TurnControls owns phase advance and turn advance buttons — MatchBoard phase badges are display-only to avoid duplicate controls"
  - "MatchEndOverlay imports canvas-confetti dynamically (import()) — avoids SSR bundle bloat, non-blocking if confetti fails"
  - "Victory chime is generated programmatically via AudioContext oscillators — no audio file dependency, works offline"
  - "isPaused detection reads last log entry event field — MatchState has no explicit isPaused boolean, pause just appends 'paused' to log"

requirements-completed: [PTS-04, PTS-05, PTS-07]

# Metrics
duration: 15min
completed: 2026-03-13
---

# Phase 03 Plan 04: Match Gameplay Board Summary

**Full match gameplay board with tappable battlefield zones, real-time Socket.IO score sync, ABCD phase tracker, turn controls, win celebration with confetti + chime, and 8th point rule enforcement**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-13T03:22:38Z
- **Completed:** 2026-03-13T03:37:38Z
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 4

## Accomplishments

- `useMatchSocket` hook: typed Socket.IO consumer with `state:full`/`state:patch` separation, all emit helpers fully typed
- `MatchBoard`: fixed-position full-screen layout, hides dashboard nav, opponent scores at top, my score at bottom, pause/reconnect overlays
- `BattlefieldZone`: tappable card-art-backed zones, `navigator.vibrate(50)` haptic, color ring for control state (blue/red/green/yellow), contested dashed overlay, +1 score flash animation
- `ScoreDisplay`: "N/8" format, player name, active-turn glow animation, color accent border
- `TurnControls`: ABCD phase badges, "Advance Phase" / "End Turn" button (phase-aware), undo/pause/concede with confirmation modal, first-turn rune banner, opponent-turn indicator
- `TurnLog`: collapsible panel with auto-scroll-to-bottom, T{N}/{phase} entry prefix
- `MatchEndOverlay`: canvas-confetti fire, programmatic AudioContext victory chime (C5/E5/G5/C6), haptic `[100,50,100,50,200]`, winner title + final scores, End Session button
- `match-socket.ts` extended with all gameplay event types — fully typed `socket.emit()` calls throughout
- TypeScript compilation passes cleanly

## Task Commits

1. **Task 1: useMatchSocket hook + match board layout + battlefield zones** — `091132c`
2. **Task 2: Turn controls, phase tracker, undo, pause, concession, turn log, win celebration** — `2a074d2`

## Files Created/Modified

- `apps/web/src/hooks/use-match-socket.ts` — Socket.IO hook with typed events and emit helpers
- `apps/web/src/app/match/[code]/match-board.tsx` — Full-screen match gameplay view
- `apps/web/src/app/match/[code]/battlefield-zone.tsx` — Tappable battlefield with card art background
- `apps/web/src/app/match/[code]/score-display.tsx` — N/target score with color accent
- `apps/web/src/app/match/[code]/turn-controls.tsx` — ABCD phase + turn controls strip
- `apps/web/src/app/match/[code]/turn-log.tsx` — Collapsible history panel
- `apps/web/src/app/match/[code]/match-end-overlay.tsx` — Win celebration with confetti/chime/haptic
- `apps/web/src/lib/match-socket.ts` — Extended with state:full, state:patch, all client gameplay events
- `apps/web/src/app/match/[code]/join-form.tsx` — Renders MatchBoard at active step
- `apps/web/src/app/globals.css` — Added animate-pulse-slow, animate-score-flash

## Decisions Made

- Extended `match-socket.ts` with full gameplay event types so `useMatchSocket` can use `socket.emit()` directly without type casts — Plan 03's socket only had setup-phase events
- `useMatchSocket` keeps `fullState` (session metadata from `state:full`) separate from `matchState` (live scores from `state:patch`) — callers access `fullState.status`, `fullState.players` for session context and `matchState.battlefields` for live game
- Phase advance button in `TurnControls` replaces the tappable phase badge approach in MatchBoard — cleaner UX, badges are now display-only indicators
- `MatchEndOverlay` uses dynamic `import('canvas-confetti')` — prevents SSR bundle inclusion, gracefully skips if import fails
- `isPaused` inferred from last log entry because `MatchState` schema has no `isPaused` boolean field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] match-socket.ts lacked gameplay event types**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `ServerToClientEvents` only had setup-phase events (battlefield:submit, battlefield:reveal), not the gameplay events the gateway actually emits (state:full, state:patch, player:disconnected). `ClientToServerEvents` also lacked all gameplay emits.
- **Fix:** Extended both interfaces with the full event set matching match.gateway.ts
- **Files modified:** `apps/web/src/lib/match-socket.ts`
- **Verification:** TypeScript compilation passes cleanly — no type casts needed in useMatchSocket
- **Committed in:** `091132c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Essential for type safety. The plan said extend the hook, but the socket type file needed updating first to allow fully typed event handlers.

## Issues Encountered

None beyond the auto-fixed socket type extension.

## Next Phase Readiness

- Match gameplay board fully wired to Socket.IO — ready for integration testing
- Phase 03 Plan 05 (match history detail view) can use `match.getById` tRPC procedure
- `useMatchSocket` can be reused by any future match view component

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits verified in git log (091132c, 2a074d2). TypeScript compilation passes cleanly.

---
*Phase: 03-points-tracker*
*Completed: 2026-03-13*
