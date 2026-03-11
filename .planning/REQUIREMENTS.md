# Requirements: La Grieta

**Defined:** 2026-03-11
**Core Value:** Players can digitize their entire Riftbound card collection and use that data to build decks, find trades, and track what they're hunting.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Collection Tracker

- [ ] **COLL-01**: User can add cards to collection by searching and selecting from the card database
- [ ] **COLL-02**: User can add cards to collection via camera scanning with confirmation step
- [ ] **COLL-03**: User can set variant per copy (Normal, Alt-Art, Overnumbered, Signature)
- [ ] **COLL-04**: User can set condition per copy (NM, LP, MP, HP, Damaged)
- [ ] **COLL-05**: User can record purchase price per copy
- [ ] **COLL-06**: User can attach photos to collection entries via R2 upload
- [ ] **COLL-07**: User can manage a wantlist (cards they want to acquire)
- [ ] **COLL-08**: User can manage a tradelist (cards they're willing to trade)
- [ ] **COLL-09**: User can view collection stats (total cards, set completion %, value breakdown by set)
- [ ] **COLL-10**: User can see deck recommendations based on cards they own

### Deck Builder

- [ ] **DECK-01**: User can build a deck using champion-first workflow (pick champion, then add cards)
- [ ] **DECK-02**: Deck builder validates format in real time (40 main + 12 runes + 1 champion)
- [ ] **DECK-03**: User can simulate sample opening hands from their deck
- [ ] **DECK-04**: User can view deck analytics (energy curve, domain distribution)
- [ ] **DECK-05**: User can export deck as a short share code
- [ ] **DECK-06**: User can import deck from a share code
- [ ] **DECK-07**: User can import deck from Riftbound.gg and Piltover Archive formats
- [ ] **DECK-08**: User can browse community-shared decks
- [ ] **DECK-09**: User can view decks used in notable tournaments

### Points Tracker

- [ ] **PTS-01**: User can create a 1v1 match session (2 battlefields, first to 8 points)
- [ ] **PTS-02**: User can create a 2v2 match session (3 battlefields, first to 11 points)
- [ ] **PTS-03**: User can create a FFA match session (3-4 players, 3 battlefields, first to 8 points)
- [ ] **PTS-04**: User can track battlefield control (who controls each battlefield)
- [ ] **PTS-05**: System automatically scores +1 on conquest and +1 per controlled battlefield at turn start
- [ ] **PTS-06**: Opponent can join a synced session by scanning a QR code without needing an account
- [ ] **PTS-07**: Both players see real-time score updates on their screens
- [ ] **PTS-08**: Authenticated users can view their match history

### Tournament Manager

- [ ] **TOUR-01**: TO can create a tournament and register players
- [ ] **TOUR-02**: System generates Swiss pairings with correct bye handling for odd player counts
- [ ] **TOUR-03**: Tournament runs fully offline (IndexedDB persistence on every mutation)
- [ ] **TOUR-04**: Tournament state survives browser crash and refresh
- [ ] **TOUR-05**: Players can submit deck lists linked to the deck builder
- [ ] **TOUR-06**: TO can export current round pairings to PDF for display
- [ ] **TOUR-07**: TO can view standings table after each round
- [ ] **TOUR-08**: Tournament data syncs to server when connectivity is restored

### WhatsApp Marketplace

- [ ] **WHAP-01**: Buyer can search card inventory via WhatsApp text commands
- [ ] **WHAP-02**: Seller can list a card by sending a photo to the WhatsApp bot
- [ ] **WHAP-03**: User receives WhatsApp notification when a wishlisted card hits the market
- [ ] **WHAP-04**: System cross-matches wantlists and tradelists to suggest trades
- [ ] **WHAP-05**: Community members can open mini shops within the La Grieta ecosystem
- [ ] **WHAP-06**: Platform collects transaction fee on marketplace sales
- [ ] **WHAP-07**: Marketplace uses escrow model (no direct payment between users)

### Platform

- [ ] **PLAT-01**: App supports English and Spanish with language toggle
- [ ] **PLAT-02**: News section displaying Riftbound community updates and announcements
- [ ] **PLAT-03**: Camera scanning works on both desktop (webcam) and mobile browsers (getUserMedia)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Mobile Native

- **MOB-01**: React Native mobile app for iOS and Android
- **MOB-02**: Offline card database bundled locally (~550 cards)
- **MOB-03**: Native camera integration for faster card scanning

### Advanced Features

- **ADV-01**: Live price API integration for card valuation
- **ADV-02**: Card grading integration with third-party services
- **ADV-03**: Community meta/tier lists (pending Riot policy clarity)
- **ADV-04**: Undo support for Points Tracker (last 10 actions)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Metagame win-rate aggregation | Riot policy explicitly prohibits this |
| Tournament brackets via Riot API | Riot policy explicitly prohibits this |
| In-app real-time chat | Competes with WhatsApp unnecessarily; splits attention from marketplace |
| External pricing API for v1 | High complexity, low ROI for current Honduran market scale |
| iOS native app for v1 | Ship web first; iOS deployment is unfamiliar territory |
| UI/design system overhaul | Functionality first, polish later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COLL-01 | Phase 1 | Pending |
| COLL-02 | Phase 1 | Pending |
| COLL-03 | Phase 1 | Pending |
| COLL-04 | Phase 1 | Pending |
| COLL-05 | Phase 1 | Pending |
| COLL-06 | Phase 1 | Pending |
| COLL-07 | Phase 1 | Pending |
| COLL-08 | Phase 1 | Pending |
| COLL-09 | Phase 1 | Pending |
| COLL-10 | Phase 1 | Pending |
| DECK-01 | Phase 2 | Pending |
| DECK-02 | Phase 2 | Pending |
| DECK-03 | Phase 2 | Pending |
| DECK-04 | Phase 2 | Pending |
| DECK-05 | Phase 2 | Pending |
| DECK-06 | Phase 2 | Pending |
| DECK-07 | Phase 2 | Pending |
| DECK-08 | Phase 2 | Pending |
| DECK-09 | Phase 2 | Pending |
| PTS-01 | Phase 3 | Pending |
| PTS-02 | Phase 3 | Pending |
| PTS-03 | Phase 3 | Pending |
| PTS-04 | Phase 3 | Pending |
| PTS-05 | Phase 3 | Pending |
| PTS-06 | Phase 3 | Pending |
| PTS-07 | Phase 3 | Pending |
| PTS-08 | Phase 3 | Pending |
| TOUR-01 | Phase 4 | Pending |
| TOUR-02 | Phase 4 | Pending |
| TOUR-03 | Phase 4 | Pending |
| TOUR-04 | Phase 4 | Pending |
| TOUR-05 | Phase 4 | Pending |
| TOUR-06 | Phase 4 | Pending |
| TOUR-07 | Phase 4 | Pending |
| TOUR-08 | Phase 4 | Pending |
| WHAP-01 | Phase 5 | Pending |
| WHAP-02 | Phase 5 | Pending |
| WHAP-03 | Phase 5 | Pending |
| WHAP-04 | Phase 5 | Pending |
| WHAP-05 | Phase 5 | Pending |
| WHAP-06 | Phase 5 | Pending |
| WHAP-07 | Phase 5 | Pending |
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 3 | Pending |
| PLAT-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after roadmap creation*
