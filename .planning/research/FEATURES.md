# Feature Research

**Domain:** TCG Companion App (Riftbound TCG — La Grieta)
**Researched:** 2026-03-11
**Confidence:** MEDIUM (Riftbound-specific landscape is HIGH confidence; general TCG app patterns are HIGH confidence; WhatsApp marketplace as TCG commerce layer is LOW confidence — no direct precedents found)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features every TCG companion app must have. Missing these means the product feels broken or incomplete before users give it a chance.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full card database with search and filters | Every competitor has it. Users come to browse cards first. | LOW | Already exists in La Grieta. 550 cards from riftbound-tcg-data repo. |
| Card detail view (art, stats, text) | Users need to read cards, see artwork, check costs and abilities. | LOW | Already exists. Images from apitcg repo. |
| Deck builder with format validation | Core workflow for all competitive players. Validation (40+12+1) prevents illegal decks. | MEDIUM | Partial: La Grieta has deck creation, needs champion-first flow and real-time validation. |
| Save and retrieve decks | Without persistence, the builder is a notepad. | LOW | Already exists via DB. |
| User accounts with auth | Required for any data persistence across devices. | LOW | Already exists: JWT + refresh tokens. |
| Collection list (what I own) | The foundation of the entire product. Enables all downstream features. | MEDIUM | Not yet built. Highest-priority gap. |
| Set completion tracking | Users want to see % of each set they own. Provides progress feedback. | LOW | Dependent on collection tracker existing. |
| Collection stats / totals | Card count, by rarity, by set — basic inventory summary. | LOW | Easy once collection data exists. |
| Wantlist (cards I'm hunting) | Standard feature on TCGPlayer, Deckbox, pkmn.gg — users expect it. | LOW | Simple list with notifications hook. |
| Tradelist (cards I'm willing to trade) | Peer-to-peer trading requires knowing who has what. | LOW | Companion to wantlist. |
| Dark mode | Standard UX expectation on mobile apps in 2025. | LOW | Design system supports theming. |
| Deck share / export code | Sharing decks is social currency in TCG communities. | LOW | Short code or text list import/export. |

### Differentiators (Competitive Advantage)

Features that set La Grieta apart from generic tools. These are what the Riftbound-specific community will talk about.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| QR-synced live points tracker | No other Riftbound app has this. Battlefield scoring is unique to Riftbound — no life points. Opponents scan a QR to share a live view with no login. | HIGH | Riftbound's scoring system (battlefield control, 1v1/2v2/FFA modes) is not addressed by any general TCG app. This is a genuine gap. |
| Champion-first deck building workflow | Riftbound's format revolves around champion choice. Surfacing champion selection first reflects how players actually think about decks. | MEDIUM | Competes with Piltover Archive, riftbound.gg, and Rift Mana — but they all use generic list-first UX. |
| WhatsApp marketplace with instant want-match notifications | Honduras is WhatsApp-dominant. No competitor meets players in their existing chat channel. Cross-matching wants vs haves is manual everywhere else. | HIGH | No direct TCG precedent found. Telegram-based peer commerce bots are the closest analog. Meta Business API or third-party wrapper TBD. |
| Card scanning via browser camera (no app install) | Web-based getUserMedia means zero friction. No app download required for scanning. | HIGH | Accuracy on small/similar cards is a known challenge. Riftbound has ~550 cards, which is manageable. Requires image recognition approach (visual hash or ML matching). |
| Offline-first tournament manager | TOs in Honduras cannot depend on internet. Other tools (TopDeck.gg, Limitless) are cloud-first. A local-first Swiss system with deck submission is genuinely differentiated. | HIGH | Must work on the TO's device without internet. Sync-on-reconnect is the key design challenge. |
| Condition and variant tracking (NM/LP/MP/HP/Damaged + Alt-Art/Overnumbered/Signature) | No existing Riftbound tool tracks condition or variant per copy. These distinctions matter for trading value. | MEDIUM | Normal/Alt-Art/Overnumbered/Signature variants are Riftbound-specific. |
| "Can I build this deck?" from collection | Show buildability based on what the user actually owns. Close to standard on mature platforms (Archidekt, pkmn.gg), absent on all current Riftbound tools. | MEDIUM | Requires collection data to be populated. |
| Import from Piltover Archive and riftbound.gg | Users already have decks on competitor platforms. Easy import removes switching friction. | LOW | Text-list format — both use standard card list formats. |
| Sample hand simulator | Deck testing without a table. Growing to standard on mature TCG platforms (pokemoncard.io, ManaBox). Not yet on any Riftbound tool. | MEDIUM | Draw N random cards from shuffled deck. Simple but valued. |
| Energy/might curve visualization | Deck analytics for optimization. Available on Riftbound Companion (iOS) but absent from web competitors. | MEDIUM | Bar chart over cost distribution. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Metagame / win-rate data | Players want to know what decks are winning. | Riot policy explicitly prohibits aggregated win-rate reporting. Violating this risks the entire product. | Provide deck browsing and community sharing. Let players form their own meta read. |
| External price API (live prices) | Users want card values in their collection tracker. | Price APIs (TCGPlayer, Cardmarket) require API keys, have cost, and rate limits. For a small market app with no pricing revenue stream, this is complexity without ROI. | Leave price fields nullable. Allow manual entry per card. Add price API as a paid feature later if user demand justifies it. |
| iOS App Store distribution (v1) | Native app = better UX. | iOS deployment requires Apple Developer Program ($99/yr), App Review process (days to weeks), and deployment expertise the team doesn't have yet. | Web PWA with camera access covers the scanning use case. React Native mobile can target Android first where deployment is straightforward. |
| Riot API integration for tournament brackets | "Official" data sourcing. | Riot policy prohibits using their API for tournament bracket generation or competitive results aggregation. No exceptions. | Run tournaments fully offline with La Grieta's own pairings engine. |
| Real-time chat / in-app messaging | Feels like natural community feature. | This competes with WhatsApp, which users already live in. Building a competing chat means splitting attention. Abandonment is likely. | Drive communication to WhatsApp. The marketplace bot IS the social layer. |
| Card grading integration (PSA, BGS) | Collectors want graded card values. | Riftbound is a year-old game. Grading market is nascent. Complexity-to-value ratio is poor right now. Users complain about this on Pokémon apps even after 25 years of grading data. | Track condition (NM/LP/etc.) manually. Add grading hooks later when market develops. |
| Pack simulator / opening simulator | Engagement feature popular in digital games. | No revenue model. High development cost. Not unique to La Grieta's value proposition. Can create gambling association. | Focus on real collection tracking instead. |
| Social feed / activity stream | Community feel. | Premature social features without critical mass become ghost towns. Negative experience hurts retention more than absence does. | Use WhatsApp community for social engagement. Add follow/sharing of decks first. |

---

## Feature Dependencies

```
User Auth
    └──required by──> Collection Tracker
    └──required by──> Deck Builder (persistence)
    └──required by──> Wantlist / Tradelist
    └──required by──> WhatsApp Marketplace (user identity)
    └──required by──> Tournament Manager (deck submissions)

Collection Tracker
    └──enables──> Set Completion Stats
    └──enables──> Collection Value (if prices added later)
    └──enables──> "Can I build this deck?" feature
    └──enables──> Tradelist / Wantlist population
    └──enables──> WhatsApp Marketplace (what to list for sale)
    └──enables──> Want-match notifications (knows what user wants)

Card Database (seeded)
    └──required by──> Collection Tracker (cards to add)
    └──required by──> Deck Builder (cards to select)
    └──required by──> Card Scanner (cards to match against)
    └──required by──> Wantlist (cards to want)

Deck Builder
    └──enhanced by──> Collection Tracker ("build from owned cards")
    └──enables──> Deck Submission in Tournament Manager
    └──enables──> Deck Share Codes

Wantlist + Tradelist
    └──required by──> WhatsApp Marketplace cross-matching
    └──enables──> Want-match notifications

Points Tracker
    └──no upstream dependencies (standalone feature)
    └──enhanced by──> QR sync (opponent join without account)

Tournament Manager
    └──enhanced by──> Deck Builder (linked deck submission)
    └──no internet dependency (offline-first design)

Card Scanner
    └──feeds into──> Collection Tracker (adds cards)
    └──requires──> Camera permissions (getUserMedia / React Native Camera)
```

### Dependency Notes

- **Collection Tracker is the keystone feature.** It unlocks the marketplace, the tradelist, the "build from owned" deck feature, and the want-match notification system. Nothing else scales without it.
- **Points Tracker is standalone.** No collection or account required. This makes it ideal for quick-win development or early demo to community.
- **WhatsApp Marketplace requires the most upstream work.** Needs: auth, collection tracker, wantlist, tradelist, and a resolved WhatsApp API strategy before it can function end-to-end.
- **Tournament Manager is deliberately isolated.** Offline-first design means it must not depend on backend availability. Deck submission can optionally link to the deck builder but is not blocked by it.

---

## MVP Definition

### Launch With (v1 — this milestone)

Minimum viable set for this milestone. These five pillars are the scope.

- [ ] **Collection Tracker (full)** — Scan, manually add, set variant/condition/purchase price, attach photos, manage wantlist and tradelist, view stats. This is the foundation everything else builds on. Without it, La Grieta is just another card browser.
- [ ] **Deck Builder Enhancements** — Champion-first workflow, real-time format validation (40+12+1), sample hand simulator, energy/might curve, share codes, import from Piltover Archive / riftbound.gg. Transforms the existing basic builder into a competitive tool.
- [ ] **Points Tracker** — 1v1/2v2/FFA battlefield scoring, QR sync for opponent, match history. No login required for the scoring session. Standalone and high-visibility in community.
- [ ] **Tournament Manager** — Offline-first, Swiss pairings, deck list submission, bracket management. No Riot API, no leaderboards.
- [ ] **WhatsApp Marketplace (MVP)** — Bot search for card inventory, want-match notifications, photo listings, basic trade posting. Revenue model active from day one.

### Add After Validation (v1.x)

Add when core is stable and user feedback confirms demand:

- [ ] **Purchase price / collection value rollup** — Manual price entry per card, total collection value stat. Users will ask for this once collection tracker ships.
- [ ] **Deck analytics beyond curve** — Domain distribution, rune distribution, estimated draws-to-key-card. Add when competitive player base grows.
- [ ] **Tournament manager: player self-reporting results** — Mobile-friendly result entry reduces TO workload. Dependency: stable tournament manager v1 with tested Swiss engine.
- [ ] **WhatsApp mini shops (premium)** — Persistent storefronts for frequent sellers. Revenue-generating, add once free marketplace has supply and demand.
- [ ] **"Can I build this deck?" from collection** — Build indicator on deck list view. Quick win once collection tracker has data.

### Future Consideration (v2+)

Defer until product-market fit established:

- [ ] **Live price API integration** — High complexity, ongoing cost. Not the Honduran market's primary need (secondary market is small and informal). Revisit at scale.
- [ ] **Android native app (React Native)** — Web PWA handles v1. Native app adds distribution, push notifications, and offline storage. Worth building once web proves the product.
- [ ] **Community deck meta / tier lists** — Requires aggregation of community data. Only meaningful once user base reaches critical mass. Not until Riot policy position is clarified.
- [ ] **Card grading / PSA integration** — Grading market for Riftbound is not mature in 2025/2026. Revisit in 2027.
- [ ] **Multi-language support (Spanish first-class)** — La Grieta is Spanish-named, Honduran-rooted. Spanish UI is a future differentiator as the game expands in LATAM. Build after English is stable.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Collection Tracker (scan + manual add) | HIGH | HIGH | P1 |
| Collection Tracker (variant + condition) | HIGH | LOW | P1 |
| Collection Tracker (wantlist + tradelist) | HIGH | LOW | P1 |
| Collection Tracker (stats) | MEDIUM | LOW | P1 |
| Deck Builder: champion-first + validation | HIGH | MEDIUM | P1 |
| Deck Builder: share codes + import | HIGH | LOW | P1 |
| Deck Builder: sample hand simulator | MEDIUM | LOW | P1 |
| Deck Builder: curve analytics | MEDIUM | MEDIUM | P1 |
| Points Tracker (1v1 scoring) | HIGH | MEDIUM | P1 |
| Points Tracker (QR sync) | HIGH | HIGH | P1 |
| Points Tracker (2v2 + FFA) | MEDIUM | LOW | P1 |
| Tournament Manager (Swiss + offline) | HIGH | HIGH | P1 |
| Tournament Manager (deck submission) | MEDIUM | MEDIUM | P1 |
| WhatsApp Bot (card search) | HIGH | HIGH | P1 |
| WhatsApp Bot (want-match notifications) | HIGH | MEDIUM | P1 |
| WhatsApp Bot (photo listings) | HIGH | HIGH | P1 |
| Card scanner (browser camera) | MEDIUM | HIGH | P2 |
| Collection value / price entry | MEDIUM | MEDIUM | P2 |
| "Can I build this deck?" indicator | MEDIUM | LOW | P2 |
| Mini shops (premium tier) | MEDIUM | HIGH | P2 |
| Android native app | HIGH | HIGH | P3 |
| Live price API | MEDIUM | HIGH | P3 |
| Metagame / win-rate data | HIGH | N/A | NEVER (Riot policy) |

**Priority key:**
- P1: Must have for this milestone launch
- P2: Should have — add when P1 is stable
- P3: Future milestone — needs separate planning
- NEVER: Explicitly out of scope with documented reason

---

## Competitor Feature Analysis

| Feature | Piltover Archive | riftbound.gg | Riftbound Companion (iOS) | Magical Meta | La Grieta (planned) |
|---------|-----------------|--------------|---------------------------|--------------|----------------------|
| Card database + search | Yes | Yes | Yes | Yes | Yes (existing) |
| Deck builder | Yes | Yes | Yes | Yes | Yes (enhancing) |
| Format validation | Unknown | Yes | Yes | Unknown | Yes |
| Champion-first workflow | No | No | No | No | Yes (differentiator) |
| Collection tracker | Basic | No | Yes (with scanner) | No | Yes (full, with variants) |
| Variant + condition tracking | No | No | No | No | Yes |
| Wantlist / tradelist | No | No | No | No | Yes |
| Sample hand simulator | No | No | No | No | Yes |
| Deck analytics (curve) | No | No | Yes | Yes (some) | Yes |
| Share codes / import | Yes | Yes | No | Yes | Yes |
| Points tracker | No | No | No | No | Yes (differentiator) |
| QR sync for scoring | No | No | No | No | Yes (differentiator) |
| Tournament manager | No | No | No | No | Yes (differentiator) |
| Offline-first tournament | No | No | No | No | Yes (differentiator) |
| Marketplace | No | No | No | No | Yes (differentiator) |
| WhatsApp integration | No | No | No | No | Yes (differentiator) |
| Price tracking | No | No | No | Yes (TCGPlayer) | Not v1 (nullable) |
| Mobile app | No (web) | No (web) | iOS only | No (web) | Web + Android (planned) |

**Key insight:** No existing Riftbound tool covers collection tracking with variants and conditions, a live scoring system, tournament management, or a marketplace. La Grieta has a clear differentiation lane. The deck builder competitors (Piltover Archive, riftbound.gg) are ahead on maturity but have no plans to expand beyond deck building.

---

## Sources

- [Piltover Archive](https://piltoverarchive.com) — Riftbound-specific competitor, feature review
- [Riftbound.gg Deck Builder](https://riftbound.gg/builder/) — Riftbound official community tool
- [Riftbound Companion (iOS)](https://spark.mwm.ai/us/apps/riftbound-companion/6740396103) — Closest iOS competitor
- [Magical Meta Riftbound](https://magicalmeta.ink/riftbound) — Web competitor with price data
- [TopDeck.gg Tournament Features](https://topdeck.gg/features/tournament-operations) — Tournament management reference
- [TCG Stacked — Best Collection Apps 2025](https://www.tcgstacked.com/articles/best-trading-card-collection-apps-tools) — Feature landscape overview
- [pkmn.gg](https://www.pkmn.gg/) — Mature Pokémon companion, feature reference
- [ManaBox MTG](https://play.google.com/store/apps/details?id=skilldevs.com.manabox) — Scanner + collection + deck builder reference
- [Acorn TCG Scanner](https://apps.apple.com/us/app/acorn-tcg-card-scanner/id6740246597) — Card scanning feature reference
- [TrackScore](https://trackscore.online/) — QR-sync live scoring reference
- [Telegram vs WhatsApp for bots (BAZU)](https://bazucompany.com/blog/telegram-bots-vs-whatsapp-bots-which-is-better-for-your-business/) — Platform analysis for marketplace layer
- [TCG Companion user reviews](https://justuseapp.com/en/app/1536768130/tcg-companion-pokemon-tcg/reviews) — Anti-feature evidence (UX failures)

---

*Feature research for: La Grieta — Riftbound TCG Companion App*
*Researched: 2026-03-11*
