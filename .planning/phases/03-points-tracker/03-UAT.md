---
status: diagnosed
phase: 03-points-tracker
source: 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md
started: 2026-03-12T22:00:00Z
updated: 2026-03-13T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running API server. Start fresh. Server boots without errors, DB migration applies, homepage loads with data.
result: pass

### 2. Dashboard Match Tab
expected: Dashboard bottom nav shows a "Match" tab with sword icon. Tapping it navigates to /match.
result: issue
reported: "it does navigate, but there is no sword icon"
severity: cosmetic

### 3. Match Landing Page
expected: /match page shows a "New Match" button and a match history list (empty if no matches yet). Format badges, dates visible on any existing entries.
result: pass

### 4. Match Setup Wizard — Create Match
expected: Clicking "New Match" opens a 6-step wizard: format selection (1v1/2v2/FFA), mode (local/synced), player names, first player, QR share, battlefield selection. Completing all steps creates a match.
result: issue
reported: "i cant select battlefields"
severity: blocker

### 5. QR Code and Join Link
expected: During match setup, a QR code and copyable join link are displayed. Copying the link works (clipboard toast appears).
result: skipped
reason: App not accessible on network, can't test QR/join link externally

### 6. Public Join Page
expected: Opening the join link (/match/[code]) in a new browser tab shows a join form with name input and role selector. No login required.
result: issue
reported: "the deck builder needs to be updated because it is not detecting champions"
severity: major

### 7. Guest Deck Builder
expected: After joining, guest sees a deck builder with champion-first workflow (must pick Legend before other zones unlock). Zone tabs (main/rune/champion/battlefield) work, card search filters cards, format validation shows errors for invalid decks.
result: issue
reported: "it does work but validation does not count champion units"
severity: major

### 8. Battlefield Selection + Reveal
expected: Both players select 3 battlefields secretly. After both submit, cards flip with animation to reveal selections simultaneously.
result: issue
reported: "they cant select battlefields"
severity: blocker

### 9. Match Board Layout
expected: Match board is full-screen, hides dashboard nav. Shows opponent scores at top, your score at bottom, battlefield zones in the middle, turn controls strip.
result: pass

### 10. Battlefield Tap to Score
expected: Tapping a battlefield zone changes its control state (color ring changes). Haptic feedback on tap. Score updates immediately.
result: skipped
reason: Can't test — no player can join, only spectators

### 11. Turn Controls and Phase Tracker
expected: ABCD phase badges show current phase highlighted. "Advance Phase" button moves to next phase. "End Turn" button ends the turn. Undo, pause, and concede buttons available.
result: skipped
reason: Blocked by other issues

### 12. Win Celebration
expected: When a player reaches the target score, a win overlay appears with confetti animation, victory sound, final scores, and an "End Session" button.
result: skipped
reason: Blocked by other issues

### 13. Match History Detail
expected: From /match, clicking a completed match opens /match/[id] with: players and scores, scoring breakdown (conquest vs holding points), battlefield states, turn-by-turn log timeline.
result: skipped
reason: Blocked by other issues

### 14. News Feed on Dashboard Home
expected: Dashboard home (/) shows a news feed with articles from riftbound.gg. Each article shows thumbnail, source badge, title, excerpt, and relative date. Clicking opens the article in a new tab.
result: issue
reported: "i dont see news"
severity: major

### 15. Deck Validation — Tournament Deck Valid
expected: Import or build a valid tournament deck (40 main + 12 runes + 1 legend + 1 champion + 3 battlefields). No format errors shown. Previously showed "Main deck: 41/40" — should now show clean validation.
result: issue
reported: "it does show Format issues: Main deck: 41/40 (or 48 with sideboard) on correct imported decks"
severity: major

### 16. Card Browser — Overnumbered Rarity
expected: In the Card Browser, select "Overnumbered" rarity filter. Cards should appear (12 Origins overnumbered cards). Previously showed no results.
result: pass

### 17. Deck Editor — No Tokens in Search
expected: In the deck editor, search for cards in the Main zone. No Token cards (Buff, Mech // Buff, Sand Soldier // Buff, Gold // Buff) should appear in search results.
result: pass

## Summary

total: 17
passed: 5
issues: 7
pending: 0
skipped: 5

## Gaps

- truth: "Dashboard Match tab shows sword icon"
  status: failed
  reason: "User reported: it does navigate, but there is no sword icon"
  severity: cosmetic
  test: 2
  root_cause: "IconMatch SVG <line> elements lack explicit stroke attributes — rely on parent SVG inheritance which fails in some renderers"
  artifacts:
    - path: "apps/web/src/components/dashboard-nav.tsx"
      issue: "IconMatch lines 155-156: <line> elements missing stroke='currentColor'"
  missing:
    - "Add explicit stroke='currentColor' strokeWidth='1.5' to each <line> element"
  debug_session: ""

- truth: "Battlefield selection works during match setup wizard"
  status: failed
  reason: "User reported: i cant select battlefields"
  severity: blocker
  test: 4
  root_cause: "Match setup wizard passes empty battlefieldCards array — no deck selection step exists for authenticated users"
  artifacts:
    - path: "apps/web/src/app/(dashboard)/match/new/page.tsx"
      issue: "Lines 159-162: hardcoded empty battlefieldCards array, no deck selection step"
  missing:
    - "Add deck selection step to wizard before battlefield selection"
    - "Query user's decks via trpc.deck.list and extract battlefield cards from selected deck"
  debug_session: ""

- truth: "Public join page deck builder detects champions"
  status: failed
  reason: "User reported: the deck builder needs to be updated because it is not detecting champions"
  severity: major
  test: 6
  root_cause: "Guest deck builder 'champion' step only searches for Legend cards — no step to select a Champion Unit for the champion zone"
  artifacts:
    - path: "apps/web/src/app/match/[code]/guest-deck-builder.tsx"
      issue: "Line 184: step === 'champion' filters for 'Legend' only, no Champion Unit selection"
  missing:
    - "Add a second selection step after Legend pick to choose a Champion Unit for the champion zone"
    - "Filter Champion Units that match the chosen Legend's base name"
  debug_session: ""

- truth: "Guest deck builder validation counts champion units"
  status: failed
  reason: "User reported: it does work but validation does not count champion units"
  severity: major
  test: 7
  root_cause: "Same as test 6 — no mechanism to place a Champion Unit in the champion zone, so validation always fails 'Need 1 champion'"
  artifacts:
    - path: "apps/web/src/app/match/[code]/guest-deck-builder.tsx"
      issue: "No champion zone assignment for Champion Unit cards"
    - path: "packages/shared/src/utils/validate-deck-format.ts"
      issue: "Lines 76-78: validation correct but unreachable — champion zone never populated"
  missing:
    - "Champion Unit designation flow in guest deck builder"
  debug_session: ""

- truth: "Both players can select battlefields secretly with reveal animation"
  status: failed
  reason: "User reported: they cant select battlefields"
  severity: blocker
  test: 8
  root_cause: "Same root cause as test 4 — no battlefield cards available because wizard passes empty array"
  artifacts:
    - path: "apps/web/src/app/(dashboard)/match/new/page.tsx"
      issue: "Lines 159-162: empty battlefieldCards array"
  missing:
    - "Same fix as test 4 — deck selection step provides battlefield cards"
  debug_session: ""

- truth: "Dashboard home shows news feed with articles from riftbound.gg"
  status: failed
  reason: "User reported: i dont see news"
  severity: major
  test: 14
  root_cause: "news_articles table is empty — cron job runs every 4 hours, no seed data, no manual sync endpoint"
  artifacts:
    - path: "apps/api/src/modules/news/news.service.ts"
      issue: "Lines 28-48: syncCron only runs on @Cron('0 */4 * * *'), no manual trigger"
    - path: "packages/db/src/schema/news-articles.ts"
      issue: "Line 10: nullable publishedAt causes ordering issues"
  missing:
    - "Add manual sync tRPC endpoint to trigger news scrape on demand"
    - "Add seed data or run sync on app startup for dev"
    - "Fix query ordering to handle NULL publishedAt"
  debug_session: ""

- truth: "Valid tournament deck passes validation without false errors"
  status: failed
  reason: "User reported: it does show Format issues: Main deck: 41/40 (or 48 with sideboard) on correct imported decks"
  severity: major
  test: 15
  root_cause: "importFromText() in deck.service.ts doesn't apply zone correction via getZoneForCardType() — Champion Units default to main zone, inflating count"
  artifacts:
    - path: "apps/api/src/modules/deck/deck.service.ts"
      issue: "Lines 880-906: importFromText missing zone correction (compare to create() lines 263-270)"
  missing:
    - "Apply getZoneForCardType() after card name resolution in importFromText(), same pattern as create() and setCards()"
  debug_session: ""
