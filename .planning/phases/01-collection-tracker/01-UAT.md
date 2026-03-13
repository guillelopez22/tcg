---
status: testing
phase: 01-collection-tracker
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md
started: 2026-03-12T05:00:00Z
updated: 2026-03-12T05:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch. Server boots without errors, any seed/migration completes, and a primary query (health check, homepage load, or basic API call) returns live data.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Clear ephemeral state (.next cache). Start the API and web app from scratch. Both boot without errors. Navigating to the homepage loads successfully and the API health check responds.
result: [pending]

### 2. Add Card to Collection
expected: Navigate to /collection. Click the "+" FAB button. A modal appears with a search bar. Type a card name — fuzzy search results appear. Tap a card to increment its count. Confirm to add. The card appears in the collection grid with a copy count badge.
result: [pending]

### 3. Collection Grid Filters and Sort
expected: With cards in collection, the filter/sort bar is visible. Filtering by set, rarity, or domain narrows the displayed cards. Sorting by name, date added, or value changes the order. Cards display as image tiles with copy count badges.
result: [pending]

### 4. Card Detail Page with Copy Accordion
expected: Click a card in the collection grid. Navigates to /collection/[cardId]. Shows large card art, card name/set info, wantlist/tradelist toggle buttons. Below, an accordion lists each copy with variant badge and condition. Expanding a copy shows the inline edit form.
result: [pending]

### 5. Per-Copy Inline Editing
expected: On the card detail page, expand a copy in the accordion. The edit form shows variant selector (Normal/Alt-Art/Overnumbered/Signature), condition picker (NM/LP/MP/HP/DMG), purchase price input, notes field, and photo upload. Changing values and saving updates the copy. The red delete button removes the copy after confirmation.
result: [pending]

### 6. Wantlist Tab
expected: On /collection, click the "Wantlist" tab. Shows cards you've added to your wantlist as a grid. If empty, shows an empty state message. Cards can be added to wantlist from the card detail page toggle button.
result: [pending]

### 7. Tradelist Tab
expected: On /collection, click the "Tradelist" tab. Shows cards you've marked for trade. Cards display with asking price badge if set. Can add cards to tradelist from card detail page toggle.
result: [pending]

### 8. Photo Upload on Copy
expected: On copy edit form, click the photo upload area. Select an image file. A progress bar appears during upload. After upload completes, the photo thumbnail displays on the copy entry.
result: [pending]

### 9. Scanner Camera Activation
expected: Navigate to /scanner. The rear-facing camera activates and shows a live video feed. A settings gear icon is visible for cooldown configuration.
result: [pending]

### 10. Scanner Confirmation Flow
expected: Hold a Riftbound card in front of the camera. After 3 consecutive confident scans, a confirmation overlay slides up showing: card art thumbnail, card name, set, confidence percentage, variant toggle, condition picker, quantity stepper. Clicking "Add" adds the card(s) to collection. Clicking "Skip" closes and resumes scanning.
result: [pending]

### 11. Scan Session Summary
expected: After scanning one or more cards, click "End Session". A summary page shows all scanned cards with: card art, name, set, variant/condition badges, quantity, market price placeholder, purchase price input, and want/trade toggle buttons per unique card. "Scan More" returns to camera. "Done" navigates to /collection.
result: [pending]

### 12. Stats Tab
expected: On /collection, click the "Stats" tab. Shows stat cards (total cards, total value, unique cards). Set completion progress bars. A bar chart showing value by set. A donut chart showing rarity distribution. Deck recommendation cards below with ownership percentage bars and synergy text.
result: [pending]

### 13. Language Toggle (EN to ES)
expected: In the dashboard navigation header, a language toggle (globe icon) is visible. Clicking it and selecting ES reloads the page with all UI text in Spanish (Latin American). Switching back to EN restores English text.
result: [pending]

### 14. Per-List Visibility Toggle
expected: On the Wantlist or Tradelist tab, a visibility toggle is present in the tab header. Toggling it changes the public/private visibility state of the list entries.
result: [pending]

### 15. Trending Decks Tab
expected: Navigate to /decks. A tabbed layout shows "My Decks" and "Trending" tabs. Clicking "Trending" shows tournament/community decks scraped from riftdecks.com with tier badges. Each deck has an "Import" action and a "Wishlist Missing" action.
result: [pending]

## Summary

total: 15
passed: 0
issues: 0
pending: 15
skipped: 0

## Gaps

[none yet]
