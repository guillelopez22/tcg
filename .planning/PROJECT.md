# La Grieta

## What This Is

La Grieta is the definitive companion app for Riftbound TCG, built for the Honduran market and operating across web, mobile, and WhatsApp. It digitizes the full player experience — from tracking every card you own, to building and validating decks, to scoring live matches with synced screens, to running tournaments offline, to buying and selling cards through WhatsApp without ever leaving the chat. "La Grieta" means "The Rift" in Spanish, rooted in the League of Legends universe that Riftbound draws from.

## Core Value

Players can digitize their entire Riftbound card collection — every card, variant, and condition — and use that data to build decks, find trades, and track what they're hunting.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ User can register and log in with email/password — existing
- ✓ JWT access tokens in memory, refresh tokens in httpOnly cookies — existing
- ✓ All ~550 Riftbound cards seeded and browsable with filters — existing
- ✓ Users can create decks with card associations — existing
- ✓ Design system (lg-* component classes) for consistent UI — existing

### Active

<!-- Current scope. Building toward these. -->

**Collection Tracker (Priority 1):**
- [ ] User can add cards to collection via camera scanning (web getUserMedia)
- [ ] User can add cards manually by searching and selecting
- [ ] User can set variant per copy (Normal, Alt-Art, Overnumbered, Signature)
- [ ] User can set condition per copy (NM, LP, MP, HP, Damaged)
- [ ] User can record purchase price per copy
- [ ] User can attach photos to collection entries
- [ ] User can manage a wantlist (cards they're hunting)
- [ ] User can manage a tradelist (cards they're willing to move)
- [ ] User can view collection stats (total cards, completion %, value breakdown)

**Deck Builder Enhancements:**
- [ ] Champion-first deck building workflow
- [ ] Real-time validation against 40 main + 12 runes + 1 champion format
- [ ] Sample hand simulator
- [ ] Deck analytics (curve, domain distribution)
- [ ] Share decks via short code (import/export)
- [ ] Import from Riftbound.gg and Piltover Archive formats

**Points Tracker:**
- [ ] Score tracking for 1v1 (2 battlefields, first to 8 points)
- [ ] Score tracking for 2v2 (3 battlefields, first to 11 points)
- [ ] Score tracking for FFA/3-4 players (3 battlefields, first to 8 points)
- [ ] Battlefield control tracking (who controls each battlefield)
- [ ] Automatic scoring: +1 on conquest, +1 per controlled battlefield at turn start
- [ ] QR code sync — opponent scans to share a synced screen, no account needed
- [ ] Match history

**Tournament Manager:**
- [ ] Offline-first operation (runs without internet on tournament day)
- [ ] Swiss pairings generation
- [ ] Deck list submission by players
- [ ] Bracket management
- [ ] No Riot API dependency, no leaderboards — operational tools only

**WhatsApp Marketplace:**
- [ ] Buyers search card inventory via WhatsApp bot
- [ ] Instant notification when a wishlisted card hits the market
- [ ] Sellers list cards by sending a photo
- [ ] Trade posting with automatic cross-matching (wants vs haves)
- [ ] Community mini shops within the La Grieta ecosystem
- [ ] Revenue model: free to list, transaction fee on sales, premium tier for shops

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Tournament brackets via Riot API — Riot policy prohibits this
- Win-rate / metagame data — Riot policy prohibits this
- External pricing API integration — price fields left nullable, manual or later
- iOS native app for v1 — ship web first, mobile follows (iOS deployment is unfamiliar territory)
- UI/design system overhaul — functionality first, polish later

## Context

- Riftbound TCG is a League of Legends trading card game with ~550 cards across 3 sets (Origins, Origins: Proving Grounds, Spiritforged)
- Card rarities: Common (bronze frame), Uncommon (silver frame), Rare (gold frame/foil), Epic (minimalist gold/full foil)
- Card variants (non-functional): Normal, Alt-Art, Overnumbered (card number >298 in Origins), Signature (tied to 16+ champion legends)
- Deck format: 40 main deck + 12 runes + 1 champion
- Scoring system: battlefield control-based, not life points. Conquer = +1 point, hold at turn start = +1 per battlefield controlled
- Existing community presence across multiple Honduran cities
- Card data sourced from apitcg/riftbound-tcg-data GitHub repo (cloned locally, free, no API key)
- Honduran market means WhatsApp is the dominant messaging platform — marketplace must live there
- All card data (images, metadata) comes from the cloned repo JSON files

## Constraints

- **Tech stack**: NestJS + tRPC backend, Next.js web, React Native mobile, PostgreSQL, Redis, Cloudflare R2 — established and non-negotiable
- **Card data**: All sourced from riftbound-tcg-data repo — no external API dependencies
- **Security**: JWT + refresh tokens, rate limiting, Zod validation, R2 presigned URLs for uploads
- **Riot Policy**: No tournament brackets via Riot API, no win-rate metagame data
- **Marketplace**: Escrow model for transactions, no direct payment between users
- **WhatsApp API**: Not yet decided between Meta Business API or third-party — needs research
- **Mobile**: iOS deployment is a concern — may start Android-only or web PWA

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Collection Tracker ships first | Foundation for marketplace, deck builder, and trade matching — everything depends on knowing what users own | — Pending |
| Web-first with camera scanning | getUserMedia API works on mobile browsers, no native app needed for v1 scanning | — Pending |
| Keep existing design system | Functionality over polish — lg-* classes work, rework later | — Pending |
| Free + premium marketplace model | Free listing attracts sellers, transaction fees on sales, premium tier for mini shops | — Pending |
| Offline-first tournament manager | TOs need reliability on event day — internet can't be a dependency | — Pending |
| WhatsApp as marketplace platform | Dominant messaging app in Honduras — meet users where they are | — Pending |

---
*Last updated: 2026-03-11 after initialization*
