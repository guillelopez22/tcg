# Roadmap: La Grieta

## Overview

La Grieta ships five capabilities in dependency order. Collection Tracker ships first because six downstream features — marketplace notifications, want/trade cross-matching, deck buildability, and collection stats — all require knowing what users own. Deck Builder enhancements follow as pure-logic work that has no upstream dependencies and delivers immediate value to competitive players. Points Tracker ships next as a standalone, high-visibility feature that establishes La Grieta's presence at tournament venues before the marketplace is ready. Tournament Manager ships fourth with its non-negotiable offline-first guarantee, and its development window is used to start the WhatsApp phone-warming period. WhatsApp Marketplace ships last because it aggregates everything before it and carries the most external operational dependencies.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Collection Tracker** - Players can digitize every card they own with full variant, condition, and photo support plus wantlist and tradelist management (completed 2026-03-12)
- [ ] **Phase 2: Deck Builder Enhancements** - Competitive players can build, validate, analyze, and share decks with champion-first workflow and format-legal enforcement
- [ ] **Phase 3: Points Tracker** - Any two players can run a scored match with real-time sync via QR code — no account required for the joining player
- [ ] **Phase 4: Tournament Manager** - A tournament organizer can run a full Swiss tournament offline from registration through standings, with crash-safe state
- [ ] **Phase 5: WhatsApp Marketplace** - Buyers and sellers can transact through WhatsApp with automatic want-match notifications and escrow-backed transactions

## Phase Details

### Phase 1: Collection Tracker
**Goal**: Players can digitize their entire card collection with multi-copy, variant, and condition tracking, manage wantlists and tradelists, and view meaningful stats about their holdings
**Depends on**: Nothing (first phase)
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06, COLL-07, COLL-08, COLL-09, COLL-10, PLAT-01, PLAT-03
**Success Criteria** (what must be TRUE):
  1. User can search for any Riftbound card and add one or more copies to their collection, specifying variant (Normal, Alt-Art, Overnumbered, Signature) and condition (NM, LP, MP, HP, Damaged) per copy
  2. User can point their device camera at a card, see a card identification result, confirm or correct it, and have it added to their collection
  3. User can attach a photo to any collection entry and record a purchase price
  4. User can view a wantlist of cards they are hunting and a tradelist of cards they are willing to move, with both lists manageable from the same UI
  5. User can view collection stats showing total cards owned, set completion percentage per set, and value breakdown — and see which of their owned cards can build specific decks
**Plans:** 5/5 plans complete

Plans:
- [ ] 01-01-PLAN.md — Schema migration, Zod schemas, i18n plumbing
- [ ] 01-02-PLAN.md — Collection service rework + wishlist module (API layer)
- [ ] 01-03-PLAN.md — Collection UI (grid, detail, add modal, wantlist/tradelist tabs)
- [ ] 01-04-PLAN.md — Scanner enhancements (confirmation, cooldown, session summary)
- [ ] 01-05-PLAN.md — Stats, deck recommendations, Spanish translations, language toggle

### Phase 2: Deck Builder Enhancements
**Goal**: Players can build format-legal decks with a champion-first workflow, analyze energy curves and hand probability, and share or import decks using standard community formats
**Depends on**: Phase 1
**Requirements**: DECK-01, DECK-02, DECK-03, DECK-04, DECK-05, DECK-06, DECK-07, DECK-08, DECK-09
**Success Criteria** (what must be TRUE):
  1. User selects a champion first when creating a deck, and the builder enforces the 40 main + 12 runes + 1 champion format with real-time violation feedback
  2. User can simulate drawing a sample opening hand from any deck they are building
  3. User can view energy and domain distribution charts for their deck
  4. User can export a deck as a short share code and import any deck from a share code, a Riftbound.gg list, or a Piltover Archive format
  5. User can browse community-shared decks and view decks used in notable tournaments
**Plans**: TBD

### Phase 3: Points Tracker
**Goal**: Any two players at a table can start a scored match, sync scores to both screens in real time via a QR code, and see the correct battlefield-control scoring rules applied automatically
**Depends on**: Phase 1
**Requirements**: PTS-01, PTS-02, PTS-03, PTS-04, PTS-05, PTS-06, PTS-07, PTS-08, PLAT-02
**Success Criteria** (what must be TRUE):
  1. User can create a 1v1, 2v2, or FFA match session and track which player controls each battlefield
  2. System automatically applies +1 on conquest and +1 per controlled battlefield at turn start, keeping score without manual calculation
  3. Opponent can join a synced session by scanning a QR code without creating an account, and both screens show the same score in real time
  4. Authenticated users can view their match history after a session ends
  5. The news section displays Riftbound community updates and announcements
**Plans**: TBD

### Phase 4: Tournament Manager
**Goal**: A tournament organizer can register players, generate correct Swiss pairings with bye handling, and run the full tournament offline — with state that survives a browser crash and syncs to the server when connectivity returns
**Depends on**: Phase 3
**Requirements**: TOUR-01, TOUR-02, TOUR-03, TOUR-04, TOUR-05, TOUR-06, TOUR-07, TOUR-08
**Success Criteria** (what must be TRUE):
  1. Tournament organizer can create a tournament, register players, and generate Swiss pairings including correct bye assignment for odd player counts
  2. Tournament state persists through a full browser crash and refresh — no data loss, no manual recovery step
  3. Players can submit deck lists linked to their La Grieta deck builder decks
  4. Tournament organizer can export the current round's pairings to PDF and view the standings table after any completed round
  5. Tournament data syncs automatically to the server when the device regains internet connectivity
**Plans**: TBD

### Phase 5: WhatsApp Marketplace
**Goal**: Buyers and sellers in the Riftbound community can find cards, post listings, and complete trades through WhatsApp, with automatic notification when a wishlisted card hits the market and escrow-backed transaction safety
**Depends on**: Phase 4
**Requirements**: WHAP-01, WHAP-02, WHAP-03, WHAP-04, WHAP-05, WHAP-06, WHAP-07
**Success Criteria** (what must be TRUE):
  1. Buyer can search card inventory by sending text commands to the WhatsApp bot and receive accurate results
  2. Seller can list a card by sending a photo to the bot, which identifies the card and creates the listing
  3. User automatically receives a WhatsApp notification when a card on their wantlist is listed for sale or trade
  4. System cross-matches wantlists and tradelists and surfaces trade suggestions between community members
  5. Platform collects a transaction fee on completed sales using an escrow model — no direct payment between users
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Collection Tracker | 5/5 | Complete   | 2026-03-12 |
| 2. Deck Builder Enhancements | 0/? | Not started | - |
| 3. Points Tracker | 0/? | Not started | - |
| 4. Tournament Manager | 0/? | Not started | - |
| 5. WhatsApp Marketplace | 0/? | Not started | - |
