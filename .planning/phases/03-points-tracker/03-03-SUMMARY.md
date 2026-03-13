---
phase: 03-points-tracker
plan: 03
subsystem: web-frontend
tags: [nextjs, socket.io-client, react-qr-code, match-ui, deck-builder, battlefield-selection]

# Dependency graph
requires:
  - phase: 03-02
    provides: match.create/join/getState/history tRPC procedures, Socket.IO /match namespace, battlefield:submit/reveal events

provides:
  - Match tab in dashboard bottom nav (href /match)
  - Match landing page with history list (trpc.match.history)
  - Match setup wizard: 6-step flow (format, mode, names, first player, QR share, battlefield)
  - MatchQRCode component: SVG QR + copy-to-clipboard
  - match-socket.ts: typed Socket.IO singleton (getMatchSocket / disconnectMatchSocket)
  - GuestDeckBuilder: champion-first, zone tabs, card search, format validation, sessionStorage
  - BattlefieldSelection: secret pick + CSS rotateY flip reveal animation + haptic vibrate
  - Public join page /match/[code]: JoinForm with role selector, guest deck builder, Socket.IO connection

affects:
  - 03-04 (match board): consumes socket and match state from this plan's components
  - 03-05 (history detail): linked from history list via match.getById

# Tech tracking
tech-stack:
  added:
    - "socket.io-client"
    - "react-qr-code"
    - "canvas-confetti"
    - "@types/canvas-confetti"
  patterns:
    - Socket.IO singleton pattern: getMatchSocket() creates or returns existing socket per match code
    - CSS perspective/transformStyle/rotateY(180deg) card flip animation without external library
    - sessionStorage persistence for guest temp deck (key lagrieta_temp_deck_{code})
    - Public route outside (dashboard) layout group — no auth guard on /match/[code]
    - Champion-first wizard step: Legend card required before zone tabs unlock

key-files:
  created:
    - apps/web/src/lib/match-socket.ts
    - apps/web/src/components/match-qr-code.tsx
    - apps/web/src/app/(dashboard)/match/page.tsx
    - apps/web/src/app/(dashboard)/match/new/page.tsx
    - apps/web/src/app/match/[code]/page.tsx
    - apps/web/src/app/match/[code]/join-form.tsx
    - apps/web/src/app/match/[code]/battlefield-selection.tsx
    - apps/web/src/app/match/[code]/guest-deck-builder.tsx
  modified:
    - apps/web/src/components/dashboard-nav.tsx (added Match tab + IconMatch SVG)
    - apps/web/package.json (added socket.io-client, react-qr-code, canvas-confetti)
    - pnpm-lock.yaml (updated lockfile)
    - apps/web/src/app/(dashboard)/decks/deck-wizard.tsx (pre-existing TS2322 bug fix)

key-decisions:
  - "Socket.IO singleton in match-socket.ts: getMatchSocket(code) reconnects/reuses instead of creating multiple sockets — prevents duplicate connections on React re-renders"
  - "Card flip reveal uses CSS rotateY(180deg) with transformStyle preserve-3d — no external animation library, consistent with CLAUDE.md constraint on avoiding unnecessary deps"
  - "Public /match/[code] route lives outside (dashboard) route group — shares no layout with dashboard, accessible without login"
  - "GuestDeckBuilder stores temp deck in sessionStorage under lagrieta_temp_deck_{code} — persists through refresh, auto-cleared on match end via clearTempDeck()"
  - "BattlefieldSelection handles both synced and local modes: synced emits via Socket.IO; local mode stores submissions client-side and self-triggers reveal animation"

# Metrics
duration: 10min
completed: 2026-03-13
---

# Phase 03 Plan 03: Match Setup Flow UI Summary

**Match setup wizard with QR join, guest deck builder (champion-first workflow + sessionStorage persistence), and battlefield selection with CSS card-flip reveal animation — full web UI for match creation and joining**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-13T21:09:41Z
- **Completed:** 2026-03-13T21:19:41Z
- **Tasks:** 2
- **Files created:** 8
- **Files modified:** 4

## Accomplishments

- `match-socket.ts` singleton: typed events (BattlefieldSubmitPayload, BattlefieldRevealPayload, MatchEndedPayload), transports: ['websocket'], auto-reconnect
- `MatchQRCode` component: react-qr-code SVG, join URL builder, copy-to-clipboard with sonner toast
- Dashboard nav updated with Match tab (sword icon) linking to /match
- Match landing page: New Match button + `trpc.match.history.useQuery()` list with format badges, win/loss indicators, relative dates
- 6-step setup wizard: format (1v1/2v2/FFA cards), mode (local/synced), player names, first player, QR share, battlefield selection
- `GuestDeckBuilder`: champion-first step, zone-tabbed card browser (main/rune/champion/sideboard), `validateDeckFormat()` with cardTypeMap, sessionStorage under `lagrieta_temp_deck_{code}`, `clearTempDeck()` export
- `BattlefieldSelection`: secret pick grid, CSS `perspective/rotateY(180deg)` flip animation, staggered per-card reveal, `navigator.vibrate(100)`, local match sequential mode
- Public `/match/[code]` page: no auth guard, JoinForm with name + role selector, GuestDeckBuilder integration, Socket.IO connect on join, reconnecting banner
- All TypeScript compiles cleanly

## Task Commits

1. **Task 1: Install web deps + socket client + QR + nav tab + match page + guest deck builder** — `cc33c50`
2. **Task 2: Setup wizard + public join page + battlefield selection** — `0348c96`

## Files Created/Modified

- `apps/web/src/lib/match-socket.ts` — Socket.IO singleton with typed events
- `apps/web/src/components/match-qr-code.tsx` — QR display with copy button
- `apps/web/src/components/dashboard-nav.tsx` — Added Match tab
- `apps/web/src/app/(dashboard)/match/page.tsx` — Match landing page
- `apps/web/src/app/(dashboard)/match/new/page.tsx` — 6-step setup wizard
- `apps/web/src/app/match/[code]/page.tsx` — Public join page
- `apps/web/src/app/match/[code]/join-form.tsx` — Join form + deck builder integration
- `apps/web/src/app/match/[code]/battlefield-selection.tsx` — Secret pick + reveal animation
- `apps/web/src/app/match/[code]/guest-deck-builder.tsx` — Full deck editor for guests
- `apps/web/package.json` — Added socket.io-client, react-qr-code, canvas-confetti
- `pnpm-lock.yaml` — Updated lockfile

## Decisions Made

- Socket.IO singleton avoids duplicate connections across React re-renders
- CSS rotateY flip animation: no external library, CSS only with `perspective: 600px` and `transform: rotateY(180deg)` transition over 600ms
- `/match/[code]` placed outside `(dashboard)` route group — no auth guard, pure public route
- `GuestDeckBuilder` validates via `validateDeckFormat(entries, cardTypeMap)` — identical to server validation, eliminates divergence risk
- `BattlefieldSelection` local mode: all selections stored client-side, local reveal triggered without server round-trip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error in deck-wizard.tsx**
- **Found during:** TypeScript compilation verification
- **Issue:** `c.zone ?? 'main'` returned `string` but mutation input required `'main' | 'rune' | 'champion' | 'sideboard'`
- **Fix:** Added explicit `as 'main' | 'rune' | 'champion' | 'sideboard'` cast
- **Files modified:** `apps/web/src/app/(dashboard)/decks/deck-wizard.tsx`
- **Commit:** `0348c96`

## Self-Check: PASSED
