# Phase 1: Collection Tracker — Research

**Researched:** 2026-03-11
**Domain:** TCG collection management, card scanning (image hashing/NCC), i18n, R2 file uploads, Drizzle schema migration, stats with market prices
**Confidence:** HIGH — full codebase access, all patterns verified against source

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Schema model:** One row per physical card copy (not quantity-per-group). Each copy has its own variant, condition, purchase price, photo URL, and notes. Drop `UNIQUE(userId, cardId, condition)` constraint.
- **Default on add:** Normal variant / Near Mint condition. Purchase price and photo only available in edit view.
- **Delete copy:** Red "Remove this copy" button in edit view with confirmation dialog.
- **Collection display:** Card image grid with copy count badges overlaid. Tap navigates to detail page (not inline expand). Full filter support: set, rarity, variant, condition, domain. Sort by name/date/price/set number.
- **Four tabs on collection page:** Collection | Wantlist | Tradelist | Stats
- **Add cards flow:** Bottom sheet / modal overlay triggered by floating + button. Multi-select mode: tap cards to increment count, confirm adds all at once as Normal/NM. Max 50 per batch.
- **Wantlist & Tradelist:** Separate `wishlists` table with `type` column (want/trade), linked at card level (not copy level). A card can be on both simultaneously. Wantlist: preferred variant + max price. Tradelist: optional asking price. Toggle from card detail page (star icons). Per-list visibility toggle (public/private, default private).
- **Scanning:** Continuous auto-scan with getUserMedia (desktop webcam + mobile). 90%+ confidence threshold for detection. Confirmation always required, no auto-add. Confirmation card shows: art, name, confidence %, quantity +/- buttons, validated variant toggle. After Add: success toast, auto-resume after configurable cooldown. Session counter badge. Scan session summary with market prices, per-card actions, purchase price entry, total market value.
- **Collection stats:** Total unique cards, total copies, total market value. Per-set progress bars. Value breakdown by set (TCGplayer market price, foil market price for foil variants). Rarity distribution. Market value only — no profit/loss.
- **Deck recommendations (built in Phase 1):** Synergy engine based on card effects/descriptions/legend affinity/rune colors. Sources: tournament + community decks. Shows ownership %, missing cards with prices, one-tap "Add all missing to wantlist". Displayed in Stats tab. Must explain WHY a deck is recommended (synergy reasoning).
- **i18n:** Set up from day one. All UI strings through translation function `t('collection.addCard')`. English primary, Spanish pass at end of phase.

### Claude's Discretion

- Scanner cooldown default duration
- Loading skeleton designs
- Exact grid spacing and responsive breakpoints
- Chart library choice for stats visualizations
- Synergy scoring algorithm weights
- i18n library choice (next-intl vs i18next vs other)
- Scanner viewfinder frame design
- Empty state illustration style

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLL-01 | User can add cards to collection by searching and selecting from the card database | Extend existing `collectionAddBulk` tRPC route and multi-select UI; bottom sheet modal pattern |
| COLL-02 | User can add cards to collection via camera scanning with confirmation step | Existing `scanner.service.ts` (NCC fingerprint matching) and `card-scanner.tsx` need scan-session-summary flow added |
| COLL-03 | User can set variant per copy (Normal, Alt-Art, Overnumbered, Signature) | New `cardVariantEnum` in enums.ts; add `variant` column to `collections` table via Drizzle migration |
| COLL-04 | User can set condition per copy (NM, LP, MP, HP, Damaged) | `cardConditionEnum` already in enums.ts; existing `condition` column retained (one row per copy) |
| COLL-05 | User can record purchase price per copy | Add `purchasePrice` numeric column to `collections` table; edit-view only |
| COLL-06 | User can attach photos to collection entries via R2 upload | `@la-grieta/r2` presign package exists; needs new `collection` UploadPurpose; add `photoUrl`/`photoKey` columns to `collections` table |
| COLL-07 | User can manage a wantlist (cards they want to acquire) | New `wishlists` table with `type='want'`; wishlist tRPC router + service |
| COLL-08 | User can manage a tradelist (cards they're willing to trade) | Same `wishlists` table with `type='trade'`; same router |
| COLL-09 | User can view collection stats (total cards, set completion %, value breakdown by set) | Extend existing `stats()` in collection.service.ts; join `card_prices` for market value |
| COLL-10 | User can see deck recommendations based on cards they own | New `deck-recommendations.service.ts`; synergy scoring against `decks`/`deck_cards` tables; explain reasoning |
| PLAT-01 | App supports English and Spanish with language toggle | next-intl setup; translation file scaffold; language toggle in profile/nav |
| PLAT-03 | Camera scanning works on both desktop (webcam) and mobile browsers (getUserMedia) | Already implemented in `card-scanner.tsx`; needs session-summary and cooldown configuration added |
</phase_requirements>

---

## Summary

This phase extends a working but partial collection system into a full-featured TCG collection tracker. The core infrastructure — NestJS API with tRPC, Drizzle ORM, PostgreSQL, Redis caching, card scanner with NCC fingerprint matching, R2 presigned URL uploads — is already in place. The main work is schema migration + feature expansion, not greenfield building.

The biggest architectural shift is the schema model change: dropping the `UNIQUE(userId, cardId, condition)` constraint and moving from a quantity-aggregated model to one-row-per-physical-copy. This is a breaking migration that touches the collection service, Zod schemas, and all downstream queries. The scanner already handles getUserMedia on both desktop and mobile. The stats service already computes completion percentages but needs market value joins to `card_prices`.

New tables required: `wishlists` (wantlist/tradelist). New enum: `cardVariant`. New columns on `collections`: `variant`, `purchasePrice`, `photoUrl`, `photoKey`. New service: `deck-recommendations`. New i18n plumbing: next-intl.

**Primary recommendation:** Execute the schema migration first (Wave 0), verify all existing tests pass, then layer features on top. The existing test suite for `collection.service.ts` (Vitest, 30+ tests) provides a regression baseline.

---

## Standard Stack

### Core (already in use — do not change)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | ^10.0.0 | API framework | Already used; module/service/router pattern established |
| tRPC | ^11.0.0 | Type-safe API | Already used; httpLink (NOT httpBatchLink) |
| Drizzle ORM | ^0.38.0 | DB queries | Already used; all queries through Drizzle, no raw SQL |
| Zod | ^3.23.0 | Input validation + types | Single source of truth for types |
| sharp | ^0.33.0 | Image processing (scanner) | Already in API deps; used for NCC fingerprints |
| next | ^14.2.0 | Web app | Already used |
| @tanstack/react-query | ^5.56.0 | Data fetching | Used via tRPC React |
| sonner | ^2.0.7 | Toasts | Already used in `card-scanner.tsx` and `collection-manager.tsx` |
| @la-grieta/r2 | workspace:* | R2 presigned uploads | Already exists; needs `collection` purpose added |

### New Libraries Required (Claude's Discretion)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| next-intl | ^3.x | i18n for Next.js | App router compatible, SSR-safe, t() API matches context decision |
| recharts OR chart.js via react-chartjs-2 | latest | Stats visualizations | Recharts is lighter and React-native; chart.js has more chart types |

**i18n recommendation: next-intl** — integrates directly with Next.js App Router, supports server + client components, minimal config, t() function matches the pattern in CONTEXT.md. Recharts recommendation for charts — pure React, tree-shakeable, works with Tailwind.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| next-intl | i18next + react-i18next | i18next is heavier and not App Router native; next-intl is simpler for this scope |
| recharts | chart.js | chart.js has broader chart variety but needs canvas; recharts is declarative JSX |
| NCC fingerprint scanner | Tesseract OCR | OCR is already in web deps (tesseract.js) but accuracy on card names is lower than NCC image matching; existing scanner uses NCC |

**Installation (new libraries only):**
```bash
pnpm add next-intl --filter @la-grieta/web
pnpm add recharts --filter @la-grieta/web
```

---

## Architecture Patterns

### Recommended Project Structure (changes only)

```
packages/db/src/schema/
├── collections.ts          # REWORK: drop unique constraint, add variant/purchasePrice/photoUrl/photoKey
├── wishlists.ts            # NEW: wantlist + tradelist
└── enums.ts                # ADD: cardVariantEnum

packages/shared/src/schemas/
├── collection.schema.ts    # EXTEND: add variant, purchasePrice, photoUrl; remove upsert logic
└── wishlist.schema.ts      # NEW: Zod schemas for wishlist CRUD

apps/api/src/modules/
├── collection/
│   ├── collection.service.ts   # REWORK: per-copy model, stats market value, deck recs
│   └── collection.router.ts    # ADD: getById, wishlist passthrough
├── wishlist/                   # NEW module
│   ├── wishlist.module.ts
│   ├── wishlist.service.ts
│   └── wishlist.router.ts
└── deck-recommendations/       # NEW module
    ├── deck-recommendations.module.ts
    └── deck-recommendations.service.ts

apps/web/src/app/(dashboard)/collection/
├── page.tsx                    # REWORK: four-tab layout
├── [id]/page.tsx               # NEW: card detail + copy list + edit controls
└── collection-manager.tsx      # REWORK: image grid, copy count badges, floating + btn
```

### Pattern 1: Per-Copy Schema Model

**What:** Each physical card copy is its own row. No quantity column. Multiple rows with same `userId + cardId` are normal.
**When to use:** Everywhere in collection CRUD.

**Collections table after migration:**
```typescript
// packages/db/src/schema/collections.ts
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  variant: cardVariantEnum('variant').notNull().default('normal'),
  condition: cardConditionEnum('condition').notNull().default('near_mint'),
  purchasePrice: numeric('purchase_price', { precision: 10, scale: 2 }),
  photoUrl: varchar('photo_url', { length: 500 }),
  photoKey: varchar('photo_key', { length: 500 }),
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  // NO unique constraint — multiple copies of same card are valid
  index('idx_collections_user_id').on(table.userId),
  index('idx_collections_card_id').on(table.cardId),
  index('idx_collections_user_card').on(table.userId, table.cardId),
]);
```

**New enum:**
```typescript
// packages/db/src/schema/enums.ts — add:
export const cardVariantEnum = pgEnum('card_variant', [
  'normal',
  'alt_art',
  'overnumbered',
  'signature',
]);
```

### Pattern 2: Wishlists Table

**What:** Card-level (not copy-level) want/trade lists. Single table, discriminated by `type`.
**When to use:** Wantlist and tradelist management.

```typescript
// packages/db/src/schema/wishlists.ts — NEW
export const wishlists = pgTable('wishlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  type: wishlistTypeEnum('type').notNull(),        // 'want' | 'trade'
  preferredVariant: cardVariantEnum('preferred_variant'),  // wantlist only
  maxPrice: numeric('max_price', { precision: 10, scale: 2 }),  // wantlist only
  askingPrice: numeric('asking_price', { precision: 10, scale: 2 }),  // tradelist only
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  // A card can appear once per type per user
  uniqueIndex('idx_wishlists_user_card_type').on(table.userId, table.cardId, table.type),
  index('idx_wishlists_user_id').on(table.userId),
  index('idx_wishlists_type').on(table.type),
]);
```

```typescript
// New enum in enums.ts:
export const wishlistTypeEnum = pgEnum('wishlist_type', ['want', 'trade']);
```

### Pattern 3: NestJS Module Pattern (established — follow exactly)

```
wishlist.module.ts      → imports DbModule, registers WishlistService + WishlistRouter
wishlist.service.ts     → @Injectable(), constructor(private readonly db: DbClient, private readonly redis: Redis)
wishlist.router.ts      → @Injectable(), buildRouter() returning this.trpc.router({...})
```

Register in app.module.ts the same way collection.module is registered.

### Pattern 4: Drizzle Migration via `pnpm db:push` or Migration File

The project uses Drizzle Kit. Check `packages/db/drizzle.config.ts` for the migration approach. The safe path for production-level changes:
1. Write the new schema (enums first, then tables)
2. Run `pnpm --filter @la-grieta/db db:generate` to generate migration SQL
3. Run `pnpm --filter @la-grieta/db db:migrate` to apply

The UNIQUE constraint removal requires: `DROP INDEX idx_collections_user_card_condition` in the migration. **This is not auto-reversible** — document clearly.

### Pattern 5: R2 Photo Upload for Collection Entries

Add `'collection'` to `UPLOAD_PURPOSES` in `packages/r2/src/constants.ts`. The upload flow is:
1. Client calls `collection.getUploadUrl` tRPC mutation → returns presigned PUT URL
2. Client PUTs file directly to R2 (never through API)
3. Client calls `collection.update` with returned `publicUrl` and `key`
4. API stores `photoUrl` + `photoKey` on the collection row

The `generateUploadUrl` function in `@la-grieta/r2` already handles everything — just add the purpose.

### Pattern 6: Stats Market Value Join

Extend the existing `stats()` method to join `card_prices`. The `card_prices` table has `marketPrice` (normal) and `foilMarketPrice` (foil). Map variant to price column:
- `normal` → `marketPrice`
- `alt_art`, `overnumbered` → `foilMarketPrice` (TCGplayer treats these as foil pricing)
- `signature` → `foilMarketPrice`

```sql
-- Conceptual — express as Drizzle:
SELECT
  SUM(CASE WHEN c.variant = 'normal' THEN cp.market_price ELSE cp.foil_market_price END) as total_value
FROM collections col
JOIN cards c ON col.card_id = c.id
LEFT JOIN card_prices cp ON c.id = cp.card_id
WHERE col.user_id = $userId
```

### Pattern 7: next-intl App Router Setup

```typescript
// apps/web/src/i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

```typescript
// apps/web/next.config.ts — wrap with createNextIntlPlugin
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin();
export default withNextIntl({ /* existing config */ });
```

Locale routing strategy: **no URL-based locale prefix** (use cookie/accept-language header). The app is single-domain; URL routing adds complexity without benefit for a two-language app.

### Anti-Patterns to Avoid

- **Upsert in add:** The old service upserts (increments quantity) on same user+card+condition. The new model must NOT upsert — always insert a new row. The old upsert logic must be removed entirely.
- **quantity column:** Do not keep or migrate the `quantity` column. One row = one copy.
- **Raw SQL for stats:** All stats queries must go through Drizzle's query builder (`sql` template literal for aggregates is allowed, raw strings are not).
- **Auto-add on scan:** Scanner must never add to collection without user confirmation. The `handleAdd()` mutation is always user-triggered.
- **Hardcoding foil logic:** Variant-to-price mapping must live in a shared constant, not scattered across service and UI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image fingerprint matching | Custom pixel comparison | Existing `scanner.service.ts` (NCC + sharp) | Already production-quality with CLAHE normalization |
| Presigned R2 uploads | Direct file upload to API | `@la-grieta/r2` presign package | Handles key generation, TTL, public URL, MIME validation |
| Toast notifications | Custom notification system | `sonner` (already in web deps) | Already used in scanner and collection manager |
| Pagination cursor logic | Custom offset pagination | `buildPaginatedResult` from `@la-grieta/shared` | Already handles cursor-based pagination correctly |
| Card fuzzy search for add modal | Custom string matching | `fuse.js` (already in web deps) | Already available; powers search-based card selection |
| Chart rendering | SVG path math | `recharts` | Handles responsive containers, tooltips, accessibility |
| i18n message loading | Custom JSON loader | `next-intl` | Handles SSR, RSC, client components, TypeScript-safe keys |

**Key insight:** The scanner, R2 upload, pagination, and fuzzy search infrastructure already exists. The add-cards modal can reuse `fuse.js` for card search without adding any new search library.

---

## Common Pitfalls

### Pitfall 1: Migration Does Not Remove Old Unique Index Atomically
**What goes wrong:** Drizzle may generate a migration that tries to add new columns before dropping the unique constraint, causing the migration to fail if any existing rows violate the schema during the transition.
**Why it happens:** The old constraint `UNIQUE(userId, cardId, condition)` will conflict once multiple copies of the same card+condition exist.
**How to avoid:** In the generated migration SQL, ensure `DROP INDEX idx_collections_user_card_condition` comes BEFORE any `INSERT` or data-shape changes. Review the generated migration file before running.
**Warning signs:** `migration failed: duplicate key value violates unique constraint`.

### Pitfall 2: Redis Cache Invalidation for Stats After Schema Change
**What goes wrong:** `stats()` caches `all_sets` and `cards_per_set` in Redis with 1-hour TTL. After migration, the stats also need to query market values — if the new stats shape is cached with the old shape, clients get stale/wrong data.
**Why it happens:** The existing `stats()` method caches user-independent data aggressively. Adding market value breaks the cached shape.
**How to avoid:** When extending stats, use new cache keys (e.g., `cache:cards_per_set_v2`) or simply increase the version suffix. Alternatively, do not cache the value-aggregated query (it's user-specific anyway).
**Warning signs:** Stats show 0 market value for users with priced cards.

### Pitfall 3: Scanner Confidence Score vs 90% Threshold Mismatch
**What goes wrong:** The current scanner returns an NCC score (0.0–1.0). NCC 0.30 is the `NCC_THRESHOLD` constant. Mapping this to "90% confidence" for the UI requires a normalization step — the raw NCC score is NOT a percentage.
**Why it happens:** NCC range [0.3, 1.0] when filtered maps to roughly [0%, 100%] in practical use. Simply multiplying by 100 gives "30% = lowest match" not "30% = low confidence".
**How to avoid:** Normalize the displayed confidence: `displayPct = Math.round(((score - NCC_THRESHOLD) / (1 - NCC_THRESHOLD)) * 100)`. The 90% threshold should be `NCC ≥ (0.9 * (1 - NCC_THRESHOLD) + NCC_THRESHOLD) = 0.93`. Verify this against real card scans before committing.
**Warning signs:** Confidence % shown as 30% even on strong matches.

### Pitfall 4: Variant Toggle Must Be Card-Specific
**What goes wrong:** The confirmation card shows variant options. If all variants are shown for all cards, users can set a card to "Signature" when no Signature version exists.
**Why it happens:** The card data schema does not have a `variants: string[]` field — variants must be inferred from which TCGplayer product IDs are mapped to a card, or from a hardcoded rule set.
**How to avoid:** Research which cards have Alt-Art, Overnumbered, and Signature variants from the card data. Consider adding a `supportedVariants` JSON column to the `cards` table during seeding, or derive from the card data JSON at seed time. At minimum, maintain a known-variant lookup table for the ~550 cards.
**Warning signs:** Users select non-existent variants; scanner session data has wrong variant for card.

### Pitfall 5: R2 Upload Purpose Missing for Collection Photos
**What goes wrong:** `UPLOAD_PURPOSES` in `packages/r2/src/constants.ts` only has `['listing', 'avatar']`. Calling `generateUploadUrl` with purpose `'collection'` will throw at runtime.
**Why it happens:** The R2 package was built for marketplace listings before this phase.
**How to avoid:** Add `'collection'` to `UPLOAD_PURPOSES` as the first task in the R2 extension work. Also update `MAX_FILE_SIZE_BYTES` with an appropriate limit (5 MB matches `listing`).
**Warning signs:** `Content type "..." is not allowed` error or TypeScript type error.

### Pitfall 6: tRPC httpLink Does Not Support Batching
**What goes wrong:** If a wave implementation accidentally imports `httpBatchLink` instead of `httpLink`, all tRPC calls silently fail.
**Why it happens:** Documentation examples default to httpBatchLink; the project uses httpLink due to Express adapter limitations.
**How to avoid:** Never change `trpc.ts` in the web app. All new tRPC endpoints use existing `proc` and `pub` patterns in routers.
**Warning signs:** API calls return 400 or connection errors on any new endpoint.

### Pitfall 7: Deck Recommendations Without Existing Decks in DB
**What goes wrong:** The synergy engine queries the `decks` and `deck_cards` tables for tournament/community decks. If no decks are seeded, recommendations return empty.
**Why it happens:** Phase 2 (Deck Builder) is when users create decks. Phase 1 deck recommendations need seed data.
**How to avoid:** Create a seed script that inserts 5–10 representative tournament decks for each champion into the `decks` table, marked as `isPublic: true` and `isTournament: true` (or similar flag). Research actual Riftbound tournament deck lists from the community.
**Warning signs:** Stats tab shows "No deck recommendations" even for users with large collections.

---

## Code Examples

Verified from codebase reading:

### Existing Add Pattern (to REPLACE — do not use after migration)
```typescript
// OLD: upsert-based (packages/api/src/modules/collection/collection.service.ts lines 169–227)
// REMOVE the existing check and increment; always INSERT new row
async add(userId: string, input: CollectionAddInput): Promise<Collection> {
  // NEW: no upsert — insert one row per copy
  const [created] = await this.db
    .insert(collections)
    .values({
      userId,
      cardId: input.cardId,
      variant: input.variant ?? 'normal',
      condition: input.condition ?? 'near_mint',
      notes: input.notes ?? null,
    })
    .returning();
  if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', ... });
  return created;
}
```

### Collection List with Copy Count Aggregation
```typescript
// New list query — group by cardId, count copies, show distinct cards
// For the grid view: SELECT cardId, COUNT(*) as copyCount, MAX(updatedAt)
// For the detail view: SELECT all copies WHERE cardId = X AND userId = Y
```

### Stats with Market Value
```typescript
// Extend existing stats() in collection.service.ts
const valueBySet = await this.db
  .select({
    setId: cards.setId,
    totalValue: sql<number>`
      COALESCE(SUM(
        CASE WHEN ${collections.variant} = 'normal'
          THEN CAST(${cardPrices.marketPrice} AS numeric)
          ELSE CAST(${cardPrices.foilMarketPrice} AS numeric)
        END
      ), 0)
    `.as('totalValue'),
  })
  .from(collections)
  .innerJoin(cards, eq(collections.cardId, cards.id))
  .leftJoin(cardPrices, eq(cards.id, cardPrices.cardId))
  .where(eq(collections.userId, userId))
  .groupBy(cards.setId);
```

### Wishlist Toggle from Card Detail
```typescript
// tRPC procedure pattern for toggle:
toggle: proc
  .input(z.object({ cardId: z.string().uuid(), type: z.enum(['want', 'trade']) }))
  .mutation(async ({ ctx, input }) => this.wishlistService.toggle(ctx.userId, input))

// toggle() in WishlistService:
async toggle(userId: string, input: { cardId: string; type: 'want' | 'trade' }): Promise<{ added: boolean }> {
  const existing = await this.db.select({ id: wishlists.id }).from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.cardId, input.cardId), eq(wishlists.type, input.type)))
    .limit(1);
  if (existing[0]) {
    await this.db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
    return { added: false };
  }
  await this.db.insert(wishlists).values({ userId, cardId: input.cardId, type: input.type });
  return { added: true };
}
```

### next-intl Client Component Usage
```typescript
// In any client component:
'use client';
import { useTranslations } from 'next-intl';

export function CollectionManager() {
  const t = useTranslations('collection');
  return <h1>{t('title')}</h1>;  // messages/en.json: { "collection": { "title": "My Collection" } }
}
```

### R2 Upload Flow (client side)
```typescript
// 1. Get presigned URL
const { uploadUrl, publicUrl, key } = await trpc.collection.getUploadUrl.mutate({
  contentType: 'image/jpeg'
});
// 2. Upload directly
await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': 'image/jpeg' } });
// 3. Save to collection entry
await trpc.collection.update.mutate({ id: entryId, photoUrl: publicUrl, photoKey: key });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Quantity-per-group collection model | One row per physical copy | Phase 1 migration | Changes all list queries and add flow |
| No variant tracking | `cardVariant` enum (normal/alt_art/overnumbered/signature) | Phase 1 | New enum, new column |
| Stats: completion only | Stats: completion + market value + rarity distribution | Phase 1 | Needs card_prices join |
| Scanner: simple add | Scanner: session summary with market prices | Phase 1 | New session state management |

**Deprecated/outdated in this phase:**
- `upsert` logic in `collection.service.ts` add/addBulk: replace with pure insert
- `quantity` column on collections table: remove
- `UNIQUE(userId, cardId, condition)` constraint: drop
- `scanner.router.ts` identify endpoint: remains unchanged (NCC backend is solid); scanner UI component needs session summary added on top

---

## Open Questions

1. **Variant validation per card**
   - What we know: Not all cards have all variants. The card JSON from `riftbound-tcg-data/` has TCGplayer product IDs per card, but variants are implied by product listings.
   - What's unclear: Is there a reliable programmatic way to determine which variants exist per card from the JSON, or does this require manual curation?
   - Recommendation: During Wave 0, parse the card JSON and add a `supportedVariants` array to the seed. Alternatively, ship all variants enabled but note in spec that grayed-out variants are enforced by convention until data is available.

2. **Deck recommendations seed data**
   - What we know: The synergy engine must query existing decks. Phase 2 is where users build decks. No tournament decks are seeded yet.
   - What's unclear: Are actual Riftbound tournament deck lists available in a structured format?
   - Recommendation: The planner should include a task to research Riftbound tournament decks and create a JSON seed file. The synergy service should degrade gracefully (return empty array) if no decks exist.

3. **Scanner confidence normalization for 90% threshold**
   - What we know: NCC scores range 0.3–1.0 in practice (NCC_THRESHOLD = 0.3 already filters lower). The CONTEXT.md says "90%+ confidence threshold triggers detection."
   - What's unclear: Whether "90%" means raw NCC 0.9 or a normalized score.
   - Recommendation: Use raw NCC 0.9 as the confidence trigger threshold (which maps to very high visual similarity). The displayed "confidence %" should normalize to the [NCC_THRESHOLD, 1.0] range for user-facing text. Default scanner cooldown: **3 seconds** (balances flow with accidental re-scans).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @la-grieta/api test -- --reporter=verbose collection` |
| Full suite command | `pnpm --filter @la-grieta/api test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLL-01 | Add card by search: inserts one row per copy, no upsert | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ✅ needs update |
| COLL-02 | Scanner identify returns matches; session summary tracks added cards | unit | `pnpm --filter @la-grieta/api test -- scanner.service` | ❌ Wave 0 |
| COLL-03 | Variant stored per copy; all 4 variants accepted | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ✅ needs update |
| COLL-04 | Condition stored per copy; all 5 conditions accepted | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ✅ already tested |
| COLL-05 | Purchase price stored as numeric; null by default | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ✅ needs update |
| COLL-06 | R2 upload URL generated for collection purpose; photoUrl saved | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ❌ Wave 0 |
| COLL-07 | Wishlist toggle: adds when absent, removes when present (type=want) | unit | `pnpm --filter @la-grieta/api test -- wishlist.service` | ❌ Wave 0 |
| COLL-08 | Tradelist toggle: adds when absent, removes when present (type=trade) | unit | `pnpm --filter @la-grieta/api test -- wishlist.service` | ❌ Wave 0 |
| COLL-09 | Stats returns totalValue summed from card_prices with variant mapping | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ✅ needs update |
| COLL-10 | Deck recommendations returns sorted list with ownership%; empty array if no decks | unit | `pnpm --filter @la-grieta/api test -- deck-recommendations.service` | ❌ Wave 0 |
| PLAT-01 | t() function returns correct EN/ES string for collection namespace key | unit/smoke | manual-only (UI) | ❌ Wave 0 config |
| PLAT-03 | getUserMedia called with facingMode:environment; file fallback when denied | smoke | manual-only (camera) | existing component |

### Sampling Rate
- **Per task commit:** `pnpm --filter @la-grieta/api test -- --reporter=dot`
- **Per wave merge:** `pnpm --filter @la-grieta/api test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/__tests__/scanner.service.spec.ts` — covers COLL-02 scanner identify
- [ ] `apps/api/__tests__/wishlist.service.spec.ts` — covers COLL-07, COLL-08
- [ ] `apps/api/__tests__/deck-recommendations.service.spec.ts` — covers COLL-10
- [ ] Update `apps/api/__tests__/collection.service.spec.ts` — update all fixtures to remove `quantity` field, add `variant` field; update add() tests to assert single insert (no upsert)
- [ ] next-intl package install + `apps/web/src/i18n.ts` config + `apps/web/messages/en.json` scaffold

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading — `apps/api/src/modules/collection/collection.service.ts`, `scanner.service.ts`, `scanner.router.ts`, `collection.router.ts`
- Direct codebase reading — `packages/db/src/schema/collections.ts`, `enums.ts`, `card-prices.ts`, `cards.ts`
- Direct codebase reading — `packages/r2/src/constants.ts`, `presign.ts`
- Direct codebase reading — `packages/shared/src/schemas/collection.schema.ts`, `constants/card.constants.ts`
- Direct codebase reading — `apps/web/src/app/(dashboard)/collection/collection-manager.tsx`, `scanner/card-scanner.tsx`
- Direct codebase reading — `apps/api/__tests__/collection.service.spec.ts`, `apps/api/vitest.config.ts`
- Direct codebase reading — `.planning/phases/01-collection-tracker/01-CONTEXT.md`

### Secondary (MEDIUM confidence)
- next-intl App Router integration pattern — based on library version ^3.x documentation patterns; recommend verifying install with `pnpm add next-intl` output
- Recharts recommendation — based on ecosystem standing as of August 2025 training data; verify latest version before install

### Tertiary (LOW confidence)
- NCC-to-percentage normalization formula — derived from first principles; should be validated against real Riftbound card scans in Wave 1 or 2
- Variant-to-price column mapping (normal → marketPrice, others → foilMarketPrice) — plausible assumption based on TCGplayer's foil/non-foil pricing model; requires verification against actual card_prices data

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libraries verified by reading package.json and source
- Architecture: HIGH — schema migrations, module patterns, and API patterns verified against existing code
- Pitfalls: HIGH (implementation), MEDIUM (NCC normalization numbers) — most pitfalls derived from reading actual code paths
- Validation: HIGH — vitest config and test patterns confirmed by reading existing test files

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable stack; next-intl and recharts versions may shift sooner)
