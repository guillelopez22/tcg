# Phase 1: Collection Tracker - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Players can digitize their entire card collection with multi-copy, variant, and condition tracking per physical card. They can manage wantlists and tradelists with metadata (variant preference, max/asking price), view collection stats (totals, set completion, value, rarity distribution), and receive intelligent deck recommendations based on card synergies. Camera scanning provides continuous auto-detection with 90%+ confidence threshold. i18n plumbing (EN/ES) is established from day one.

Requirements: COLL-01 through COLL-10, PLAT-01, PLAT-03.

</domain>

<decisions>
## Implementation Decisions

### Collection Entry Model
- One row per physical card copy (not quantity-per-group) — each copy has its own variant, condition, purchase price, photo, and notes
- Existing `collections` schema needs rework: drop `UNIQUE(userId, cardId, condition)` constraint, add variant and purchase price fields
- Default to Normal variant / Near Mint condition on add — user edits after if needed
- Purchase price and photo only available in the edit view, not during initial add (keep add flow fast)
- Delete copy via red "Remove this copy" button in edit view with confirmation dialog

### Collection Display
- Card image grid layout with copy count badges overlaid on thumbnails
- Tap card navigates to a detail page (not inline expand) showing large art, all copies, and edit controls
- Full filter support: set, rarity, variant, condition, domain
- Sort options: name, date added, price, set number
- Four tabs on the collection page: Collection | Wantlist | Tradelist | Stats

### Adding Cards
- "Add cards" via bottom sheet / modal overlay triggered by floating + button
- Multi-select mode: tap cards to increment count, confirm adds all at once as Normal/NM
- Bulk add uses existing `collectionAddBulk` schema pattern (max 50 per batch)

### Wantlist & Tradelist
- Separate `wishlists` table with `type` column (want/trade), linked at card level (not copy level)
- A card can be on both wantlist AND tradelist simultaneously (common in TCG: want upgrade, trade existing)
- Wantlist entries include: preferred variant, max price willing to pay
- Tradelist entries include: optional asking price
- Toggle from any card detail page (star icons for want/trade)
- Per-list visibility toggle in profile settings: each list independently set to public or private (default: private)
- Empty state: illustration + CTA button to browse cards

### Card Scanning Flow
- Continuous auto-scan using device camera (getUserMedia on both desktop webcam and mobile)
- 90%+ confidence threshold triggers card detection — below 90% keeps scanning silently
- On detection: show card with confirmation controls (not auto-add)
- Confirmation card shows: card art, name, confidence %, quantity +/- buttons, validated variant toggle (only shows variants the specific card can have, others grayed out)
- After tapping "Add": success toast, then auto-resume scanning after configurable cooldown
- Cooldown is user-configurable via dropdown in scanner settings (default TBD by Claude)
- Session counter badge showing running tally of cards scanned
- Scan session summary: full list of scanned cards with market prices (from card_prices table), per-card actions (want/trade toggles), optional purchase price entry per card, and total market value

### Collection Stats
- Stats tab shows: total unique cards, total copies, total market value
- Set completion: per-set progress bars (owned vs total in set)
- Value breakdown: total market value by set (uses TCGplayer market price from card_prices, foil market price for foil variants)
- Rarity distribution: breakdown by Common/Uncommon/Rare/Epic
- Market value only — no profit/loss tracking

### Deck Recommendations
- Full synergy engine built in Phase 1 (not deferred to Phase 2)
- Intelligent matching based on: card effects, descriptions, legend affinity, rune colors and effects
- Sources: tournament decks and community/user-shared decks
- Shows ownership percentage per recommended deck
- Missing cards listed with market prices
- One-tap "Add all missing to wantlist" integration
- Displayed as a section within the Stats tab

### Internationalization
- i18n plumbing set up from day one using translation functions (e.g., next-intl or equivalent)
- All UI strings go through translation function: `t('collection.addCard')`
- English as primary, Spanish translations added as a pass at end of phase

### Claude's Discretion
- Scanner cooldown default duration
- Loading skeleton designs
- Exact grid spacing and responsive breakpoints
- Chart library choice for stats visualizations
- Synergy scoring algorithm weights
- i18n library choice (next-intl vs i18next vs other)
- Scanner viewfinder frame design
- Empty state illustration style

</decisions>

<specifics>
## Specific Ideas

- Scanner should feel like a pack-opening experience: scan all cards from a booster, see the session summary with total value and per-card actions
- Variant toggle on scan confirmation must be validated against what variants the card actually supports (e.g., if a card has no Alt-Art version, that option is grayed out)
- Wantlist/tradelist metadata (variant preference, asking price) is forward-looking for Phase 5 marketplace cross-matching
- User-controlled visibility per list (not all-or-nothing) — tradelist public to attract trades, wantlist private to avoid being targeted
- Deck recommendations should explain WHY a deck is recommended (synergy reasoning), not just show ownership %

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `collections` table (packages/db/src/schema/collections.ts): exists but needs rework — drop unique constraint, add variant/purchasePrice/photoUrl fields
- `card_prices` table (packages/db/src/schema/card-prices.ts): TCGplayer market prices already synced (low/mid/high/market for normal and foil)
- `collection.schema.ts` (packages/shared/src/schemas/): Zod schemas for add/update/remove/bulk — need extension for variant, price, photo
- `collection.service.ts` + `collection.router.ts`: existing CRUD module to extend
- `scanner.service.ts` + `scanner.router.ts`: existing scanner module (tesseract.js OCR + fuse.js fuzzy search)
- `card-scanner.tsx` + `collection-manager.tsx`: existing web components to rebuild/extend
- `@la-grieta/r2` package: R2 presigned URL client ready for photo uploads
- Design system: `lg-*` component classes in globals.css
- Card data: ~550 cards seeded across 3 sets with images

### Established Patterns
- NestJS module pattern: `*.module.ts` + `*.service.ts` + `*.router.ts`
- Zod schemas as single source of truth for types
- tRPC with httpLink (NOT httpBatchLink) for API calls
- Dashboard layout group `(dashboard)` with auth guard
- `cardConditionEnum` already defined in schema enums

### Integration Points
- Collection pages live in `apps/web/src/app/(dashboard)/collection/`
- Scanner page at `apps/web/src/app/(dashboard)/scanner/`
- Dashboard nav needs tabs for Collection/Wantlist/Tradelist/Stats
- Card detail page needs wantlist/tradelist toggle buttons
- Stats section needs card_prices join for market values
- New `wishlists` table needed in `packages/db/src/schema/`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-collection-tracker*
*Context gathered: 2026-03-11*
