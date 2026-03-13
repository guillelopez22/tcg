# ADR-001: La Grieta v2 Complete Architecture

## Status
Accepted

## Date
2026-03-10

## Context

La Grieta v1 reached Phase 6 (Stripe Connect payments) before a full reset. The codebase was wiped clean to rebuild with better foundations. Key lessons from v1:

- Prisma caused friction; switching to Drizzle ORM for type-safe, SQL-close queries
- `bcrypt` hangs on Alpine Linux; must use `bcryptjs`
- Global route prefix duplication in NestJS controllers caused routing bugs
- The architecture must serve WhatsApp as the primary marketplace interface, with web as dashboard/browsing and mobile for card scanning/offline collection

The game has ~550 playable cards across 3 sets (Origins: 298, Origins Proving Grounds: 24, Spiritforged: ~230+). Card data is sourced from a local clone of `apitcg/riftbound-tcg-data`. The JSON files also contain non-card products (booster packs, displays) identified by null `rarity`/`cardType` fields.

Card attributes discovered from data analysis:
- **Rarities**: Common, Uncommon, Rare, Epic
- **Card Types**: Unit, Champion Unit, Spell, Legend, Signature Unit, Signature Spell, Gear, Signature Gear
- **Domains**: Fury, Calm, Mind, Body, Chaos, Order (can be multi-valued, semicolon-separated e.g. "Fury;Chaos")

## Decision

### 1. Monorepo Structure

Use **pnpm workspaces + Turborepo** for the monorepo. pnpm is the fastest package manager with strict dependency isolation. Turborepo provides task orchestration with caching.

```
la-grieta/
├── apps/
│   ├── api/                    # NestJS + tRPC backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # AuthModule
│   │   │   │   ├── user/       # UserModule
│   │   │   │   ├── card/       # CardModule (read-only card data)
│   │   │   │   ├── collection/ # CollectionModule
│   │   │   │   ├── deck/       # DeckModule
│   │   │   │   ├── listing/    # ListingModule (marketplace)
│   │   │   │   ├── order/      # OrderModule (transactions)
│   │   │   │   ├── upload/     # UploadModule (R2 presigned URLs)
│   │   │   │   └── seed/       # SeedModule (card data import)
│   │   │   ├── trpc/
│   │   │   │   ├── trpc.module.ts
│   │   │   │   ├── trpc.service.ts    # tRPC instance + context
│   │   │   │   ├── trpc.router.ts     # Root router (merges all)
│   │   │   │   └── trpc.middleware.ts  # Auth middleware
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   └── interceptors/
│   │   │   ├── config/
│   │   │   │   ├── database.config.ts
│   │   │   │   ├── redis.config.ts
│   │   │   │   ├── r2.config.ts
│   │   │   │   └── auth.config.ts
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   ├── test/
│   │   ├── drizzle.config.ts
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── web/                    # Next.js 14+ (App Router)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/     # Login/register pages
│   │   │   │   ├── (dashboard)/# User dashboard
│   │   │   │   ├── cards/      # Card browser
│   │   │   │   ├── marketplace/# Listing browser
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   └── trpc.ts     # tRPC client setup
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── mobile/                 # React Native / Expo
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   │   └── trpc.ts
│   │   │   ├── db/             # Local SQLite for offline card DB
│   │   │   └── assets/
│   │   ├── app.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── whatsapp/               # WhatsApp bot (Baileys or Cloud API)
│       ├── src/
│       │   ├── handlers/       # Message handlers per flow
│       │   ├── flows/          # Conversation state machines
│       │   ├── services/       # tRPC client calls to API
│       │   ├── templates/      # Message template builders
│       │   └── main.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── db/                     # Drizzle schema + client
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── index.ts    # Re-exports all schemas
│   │   │   │   ├── users.ts
│   │   │   │   ├── cards.ts
│   │   │   │   ├── sets.ts
│   │   │   │   ├── collections.ts
│   │   │   │   ├── decks.ts
│   │   │   │   ├── listings.ts
│   │   │   │   ├── orders.ts
│   │   │   │   └── sessions.ts
│   │   │   ├── relations.ts    # All Drizzle relations in one file
│   │   │   ├── client.ts       # Drizzle client factory
│   │   │   ├── migrate.ts      # Migration runner
│   │   │   └── index.ts        # Public API
│   │   ├── drizzle/            # Generated migrations
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── shared/                 # Zod schemas, types, constants
│   │   ├── src/
│   │   │   ├── schemas/        # Zod schemas (single source of truth)
│   │   │   │   ├── auth.schema.ts
│   │   │   │   ├── card.schema.ts
│   │   │   │   ├── collection.schema.ts
│   │   │   │   ├── deck.schema.ts
│   │   │   │   ├── listing.schema.ts
│   │   │   │   ├── order.schema.ts
│   │   │   │   └── user.schema.ts
│   │   │   ├── types/          # Inferred types from Zod
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── card.constants.ts   # Rarities, domains, card types
│   │   │   │   ├── order.constants.ts  # Order statuses
│   │   │   │   └── listing.constants.ts
│   │   │   ├── utils/
│   │   │   │   ├── currency.ts
│   │   │   │   └── pagination.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── tsconfig/               # Shared TypeScript configs
│       ├── base.json
│       ├── nestjs.json
│       ├── nextjs.json
│       ├── react-native.json
│       └── package.json
├── tools/
│   └── seed/                   # Card data seeding scripts
│       ├── seed-cards.ts
│       └── package.json
├── riftbound-tcg-data/         # External repo (DO NOT MODIFY)
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml          # Local dev (Postgres + Redis)
└── CLAUDE.md
```

### 2. Database Schema (Drizzle ORM)

All tables use UUID primary keys, `createdAt`/`updatedAt` timestamps, and snake_case column names.

#### 2.1 Sets Table

```typescript
// packages/db/src/schema/sets.ts
import { pgTable, uuid, varchar, integer, date, timestamp } from 'drizzle-orm/pg-core';

export const sets = pgTable('sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),     // "origins", "spiritforged"
  name: varchar('name', { length: 255 }).notNull(),               // "Origins"
  total: integer('total').notNull(),                               // 360
  releaseDate: date('release_date').notNull(),
  description: varchar('description', { length: 1000 }),
  tcgplayerGroupId: integer('tcgplayer_group_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});
```

#### 2.2 Cards Table

```typescript
// packages/db/src/schema/cards.ts
import { pgTable, uuid, varchar, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sets } from './sets';

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 100 }).notNull().unique(), // "origins-001-298"
  number: varchar('number', { length: 20 }).notNull(),                     // "001/298"
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  cleanName: varchar('clean_name', { length: 255 }).notNull(),
  setId: uuid('set_id').notNull().references(() => sets.id),
  rarity: varchar('rarity', { length: 50 }).notNull(),                     // Common|Uncommon|Rare|Epic
  cardType: varchar('card_type', { length: 50 }).notNull(),                // Unit|Champion Unit|Spell|...
  domain: varchar('domain', { length: 100 }).notNull(),                    // "Fury" or "Fury;Chaos"
  energyCost: integer('energy_cost'),
  powerCost: integer('power_cost'),
  might: integer('might'),
  description: text('description'),
  flavorText: text('flavor_text'),
  imageSmall: varchar('image_small', { length: 500 }),
  imageLarge: varchar('image_large', { length: 500 }),
  tcgplayerId: integer('tcgplayer_id'),
  tcgplayerUrl: varchar('tcgplayer_url', { length: 500 }),
  isProduct: boolean('is_product').notNull().default(false),               // true for booster packs etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_cards_set_id').on(table.setId),
  index('idx_cards_rarity').on(table.rarity),
  index('idx_cards_card_type').on(table.cardType),
  index('idx_cards_domain').on(table.domain),
  index('idx_cards_clean_name').on(table.cleanName),
  index('idx_cards_is_product').on(table.isProduct),
]);
```

**Design decision**: Products (booster packs, displays) are stored in the same table with `isProduct: true` rather than filtered out during seed. This preserves the full TCGPlayer catalog for marketplace listings where users might sell sealed product. All card-browsing queries filter by `isProduct = false`.

**Design decision**: `domain` is stored as a semicolon-separated string matching the source data rather than a junction table. With only 6 possible domains and most cards having 1-2, this avoids join overhead. A GIN index on an array column would be over-engineered for ~550 rows. Full-text filtering uses `LIKE '%Fury%'` or application-level parsing.

**Design decision**: `energyCost`, `powerCost`, `might` are stored as integers (parsed from string source data) for proper numeric sorting/filtering. The source JSON has these as strings like `"5"`.

#### 2.3 Users Table

```typescript
// packages/db/src/schema/users.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  bio: text('bio'),
  city: varchar('city', { length: 100 }),                         // Honduran city for local marketplace
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),       // For WhatsApp bot linking
  isVerified: boolean('is_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeConnectId: varchar('stripe_connect_id', { length: 255 }), // For sellers (Stripe Connect)
  role: varchar('role', { length: 20 }).notNull().default('user'), // user | admin
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_username').on(table.username),
  index('idx_users_whatsapp_phone').on(table.whatsappPhone),
  index('idx_users_city').on(table.city),
]);
```

#### 2.4 Sessions Table (Refresh Tokens)

```typescript
// packages/db/src/schema/sessions.ts
import { pgTable, uuid, varchar, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshToken: varchar('refresh_token', { length: 500 }).notNull().unique(),
  userAgent: varchar('user_agent', { length: 500 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  isRevoked: boolean('is_revoked').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_refresh_token').on(table.refreshToken),
  index('idx_sessions_expires_at').on(table.expiresAt),
]);
```

#### 2.5 Collections Table

```typescript
// packages/db/src/schema/collections.ts
import { pgTable, uuid, integer, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';

export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  quantity: integer('quantity').notNull().default(1),
  condition: varchar('condition', { length: 20 }).notNull().default('near_mint'),
  // condition: near_mint | lightly_played | moderately_played | heavily_played | damaged
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('idx_collections_user_card_condition').on(table.userId, table.cardId, table.condition),
  index('idx_collections_user_id').on(table.userId),
  index('idx_collections_card_id').on(table.cardId),
]);
```

**Design decision**: Collection entries are unique per (user, card, condition). If a user has 3 Near Mint and 2 Lightly Played copies of the same card, those are 2 rows with different quantities. This aligns with TCG marketplace conventions where condition matters for pricing.

#### 2.6 Decks and Deck Cards

```typescript
// packages/db/src/schema/decks.ts
import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';

export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  coverCardId: uuid('cover_card_id').references(() => cards.id),
  isPublic: boolean('is_public').notNull().default(false),
  domain: varchar('domain', { length: 100 }),                     // Primary domain(s) of the deck
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_decks_user_id').on(table.userId),
  index('idx_decks_is_public').on(table.isPublic),
]);

export const deckCards = pgTable('deck_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('idx_deck_cards_deck_card').on(table.deckId, table.cardId),
  index('idx_deck_cards_deck_id').on(table.deckId),
]);
```

#### 2.7 Listings (Marketplace)

```typescript
// packages/db/src/schema/listings.ts
import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';

// Listing status flow: draft -> active -> sold | cancelled | expired
export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priceInCents: integer('price_in_cents').notNull(),              // USD cents (e.g., 1500 = $15.00)
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  condition: varchar('condition', { length: 20 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  // status: draft | active | sold | cancelled | expired
  imageUrls: text('image_urls'),                                   // JSON array of R2 URLs
  city: varchar('city', { length: 100 }),                          // Seller's city for local pickup
  shippingAvailable: varchar('shipping_available', { length: 20 }).notNull().default('local'),
  // shipping: local | national | both
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_listings_seller_id').on(table.sellerId),
  index('idx_listings_card_id').on(table.cardId),
  index('idx_listings_status').on(table.status),
  index('idx_listings_city').on(table.city),
  index('idx_listings_price').on(table.priceInCents),
  index('idx_listings_created_at').on(table.createdAt),
]);
```

**Design decision**: `imageUrls` is stored as a JSON text string rather than a separate table. Listings typically have 1-4 images, they are never queried independently, and a junction table adds complexity with no benefit. Parse with `JSON.parse()` in the application layer.

**Design decision**: Price in cents avoids floating-point precision issues. Currency defaults to USD but the field exists for future multi-currency support (HNL Lempira).

#### 2.8 Orders (Transactions / Escrow)

```typescript
// packages/db/src/schema/orders.ts
import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { listings } from './listings';

// Order status flow: pending -> paid -> shipped -> delivered -> completed
//                                    \-> disputed -> resolved
//                    \-> cancelled
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: uuid('buyer_id').notNull().references(() => users.id),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  listingId: uuid('listing_id').notNull().references(() => listings.id),
  quantity: integer('quantity').notNull().default(1),
  subtotalInCents: integer('subtotal_in_cents').notNull(),
  platformFeeInCents: integer('platform_fee_in_cents').notNull(),   // La Grieta's cut
  totalInCents: integer('total_in_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // status: pending | paid | shipped | delivered | completed | cancelled | disputed | resolved
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
  shippingAddress: text('shipping_address'),                         // Encrypted or structured JSON
  trackingNumber: varchar('tracking_number', { length: 100 }),
  notes: text('notes'),
  paidAt: timestamp('paid_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  completedAt: timestamp('completed_at'),
  cancelledAt: timestamp('cancelled_at'),
  disputeReason: text('dispute_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_orders_buyer_id').on(table.buyerId),
  index('idx_orders_seller_id').on(table.sellerId),
  index('idx_orders_listing_id').on(table.listingId),
  index('idx_orders_status').on(table.status),
  index('idx_orders_stripe_pi').on(table.stripePaymentIntentId),
]);
```

#### 2.9 Relations

```typescript
// packages/db/src/relations.ts
import { relations } from 'drizzle-orm';
import { users } from './schema/users';
import { sessions } from './schema/sessions';
import { sets } from './schema/sets';
import { cards } from './schema/cards';
import { collections } from './schema/collections';
import { decks, deckCards } from './schema/decks';
import { listings } from './schema/listings';
import { orders } from './schema/orders';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  collections: many(collections),
  decks: many(decks),
  listings: many(listings),
  buyerOrders: many(orders, { relationName: 'buyer' }),
  sellerOrders: many(orders, { relationName: 'seller' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const setsRelations = relations(sets, ({ many }) => ({
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  set: one(sets, { fields: [cards.setId], references: [sets.id] }),
  collections: many(collections),
  deckCards: many(deckCards),
  listings: many(listings),
}));

export const collectionsRelations = relations(collections, ({ one }) => ({
  user: one(users, { fields: [collections.userId], references: [users.id] }),
  card: one(cards, { fields: [collections.cardId], references: [cards.id] }),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(users, { fields: [decks.userId], references: [users.id] }),
  coverCard: one(cards, { fields: [decks.coverCardId], references: [cards.id] }),
  cards: many(deckCards),
}));

export const deckCardsRelations = relations(deckCards, ({ one }) => ({
  deck: one(decks, { fields: [deckCards.deckId], references: [decks.id] }),
  card: one(cards, { fields: [deckCards.cardId], references: [cards.id] }),
}));

export const listingsRelations = relations(listings, ({ one }) => ({
  seller: one(users, { fields: [listings.sellerId], references: [users.id] }),
  card: one(cards, { fields: [listings.cardId], references: [cards.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  buyer: one(users, { fields: [orders.buyerId], references: [users.id], relationName: 'buyer' }),
  seller: one(users, { fields: [orders.sellerId], references: [users.id], relationName: 'seller' }),
  listing: one(listings, { fields: [orders.listingId], references: [listings.id] }),
}));
```

### 3. API Design (tRPC Router Hierarchy)

#### 3.1 Root Router Structure

```typescript
// apps/api/src/trpc/trpc.router.ts
export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  card: cardRouter,
  collection: collectionRouter,
  deck: deckRouter,
  listing: listingRouter,
  order: orderRouter,
  upload: uploadRouter,
});
```

#### 3.2 Auth Router

```typescript
const authRouter = router({
  register: publicProcedure
    .input(z.object({
      email: z.string().email().max(255),
      username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
      password: z.string().min(8).max(128),
      displayName: z.string().max(100).optional(),
      city: z.string().max(100).optional(),
    }))
    .mutation(/* returns { user, accessToken, refreshToken } */),

  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(/* returns { user, accessToken, refreshToken } */),

  refresh: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(/* returns { accessToken, refreshToken } */),

  logout: protectedProcedure
    .mutation(/* revokes current session */),

  logoutAll: protectedProcedure
    .mutation(/* revokes all user sessions */),

  me: protectedProcedure
    .query(/* returns current user profile */),
});
```

#### 3.3 Card Router (Read-Only)

```typescript
const cardRouter = router({
  list: publicProcedure
    .input(z.object({
      setSlug: z.string().optional(),
      rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Epic']).optional(),
      cardType: z.string().optional(),
      domain: z.string().optional(),
      search: z.string().max(100).optional(),          // Search by name
      includeProducts: z.boolean().default(false),
      cursor: z.string().uuid().optional(),             // Cursor-based pagination
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(/* returns { items: Card[], nextCursor?: string } */),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(/* returns Card with set info */),

  getByExternalId: publicProcedure
    .input(z.object({ externalId: z.string() }))
    .query(/* returns Card with set info */),

  sets: publicProcedure
    .query(/* returns all sets */),

  // For mobile offline sync — returns full card DB with version hash
  sync: publicProcedure
    .input(z.object({
      lastSyncHash: z.string().optional(),
    }))
    .query(/* returns { cards: Card[], hash: string } or { unchanged: true } */),
});
```

**Design decision**: Cursor-based pagination over offset-based. More performant for large datasets, works correctly when items are inserted/deleted between page loads, and aligns with WhatsApp bot's "show more" interaction pattern.

**Design decision**: The `sync` endpoint returns the full card DB with a hash for mobile offline-first support. At ~550 cards, the full payload is roughly 200-300KB gzipped, small enough for a single request. The hash lets the client skip re-downloading if nothing changed.

#### 3.4 Collection Router

```typescript
const collectionRouter = router({
  list: protectedProcedure
    .input(z.object({
      setSlug: z.string().optional(),
      rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Epic']).optional(),
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(/* returns user's collection with card details */),

  add: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99).default(1),
      condition: z.enum(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']).default('near_mint'),
      notes: z.string().max(500).optional(),
    }))
    .mutation(/* upserts collection entry, increments quantity if exists */),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(0).max(99),          // 0 = remove
      notes: z.string().max(500).optional(),
    }))
    .mutation(/* updates quantity/notes, deletes row if quantity = 0 */),

  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(/* removes collection entry */),

  stats: protectedProcedure
    .query(/* returns { totalCards, uniqueCards, completionBySet: [...] } */),

  // Bulk add for mobile scan import
  addBulk: protectedProcedure
    .input(z.object({
      entries: z.array(z.object({
        cardId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
        condition: z.enum(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']),
      })).max(50),
    }))
    .mutation(/* bulk upserts */),
});
```

#### 3.5 Deck Router

```typescript
const deckRouter = router({
  list: protectedProcedure
    .input(z.object({
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(/* returns user's decks */),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(/* returns deck with cards — public if isPublic, otherwise auth check */),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(1000).optional(),
      isPublic: z.boolean().default(false),
      cards: z.array(z.object({
        cardId: z.string().uuid(),
        quantity: z.number().int().min(1).max(4),
      })).max(60).optional(),
    }))
    .mutation(/* creates deck with optional initial cards */),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional(),
      isPublic: z.boolean().optional(),
      coverCardId: z.string().uuid().optional(),
    }))
    .mutation(/* updates deck metadata */),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(/* deletes deck and its cards */),

  setCards: protectedProcedure
    .input(z.object({
      deckId: z.string().uuid(),
      cards: z.array(z.object({
        cardId: z.string().uuid(),
        quantity: z.number().int().min(1).max(4),
      })).max(60),
    }))
    .mutation(/* replaces all cards in deck (full sync approach) */),

  // Public deck browsing
  browse: publicProcedure
    .input(z.object({
      domain: z.string().optional(),
      search: z.string().max(100).optional(),
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(/* returns public decks */),
});
```

#### 3.6 Listing Router (Marketplace)

```typescript
const listingRouter = router({
  list: publicProcedure
    .input(z.object({
      cardId: z.string().uuid().optional(),
      setSlug: z.string().optional(),
      rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Epic']).optional(),
      condition: z.enum(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']).optional(),
      city: z.string().optional(),
      minPrice: z.number().int().min(0).optional(),
      maxPrice: z.number().int().min(0).optional(),
      search: z.string().max(100).optional(),
      sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'oldest']).default('newest'),
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(/* returns active listings with card + seller info */),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(/* returns listing with full card + seller details */),

  create: protectedProcedure
    .input(z.object({
      cardId: z.string().uuid(),
      title: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      priceInCents: z.number().int().min(25).max(1000000),        // Min $0.25, max $10,000
      condition: z.enum(['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged']),
      quantity: z.number().int().min(1).max(99).default(1),
      imageUrls: z.array(z.string().url()).max(4).optional(),
      shippingAvailable: z.enum(['local', 'national', 'both']).default('local'),
    }))
    .mutation(/* creates listing, requires Stripe Connect setup */),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      priceInCents: z.number().int().min(25).max(1000000).optional(),
      imageUrls: z.array(z.string().url()).max(4).optional(),
      status: z.enum(['active', 'cancelled']).optional(),
    }))
    .mutation(/* updates listing — only owner can modify */),

  myListings: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'active', 'sold', 'cancelled', 'expired']).optional(),
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(/* returns current user's listings */),
});
```

#### 3.7 Order Router

```typescript
const orderRouter = router({
  create: protectedProcedure
    .input(z.object({
      listingId: z.string().uuid(),
      quantity: z.number().int().min(1).default(1),
      shippingAddress: z.string().max(500).optional(),
    }))
    .mutation(/* creates order + Stripe PaymentIntent, returns clientSecret */),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(/* returns order — buyer or seller only */),

  myOrders: protectedProcedure
    .input(z.object({
      role: z.enum(['buyer', 'seller']),
      status: z.string().optional(),
      cursor: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(/* returns user's orders as buyer or seller */),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(['shipped', 'delivered', 'cancelled', 'disputed']),
      trackingNumber: z.string().max(100).optional(),
      disputeReason: z.string().max(1000).optional(),
    }))
    .mutation(/* updates order status with validation of state transitions */),

  // Stripe webhook handler (not tRPC — standard NestJS POST endpoint)
  // POST /api/webhooks/stripe
});
```

#### 3.8 Upload Router

```typescript
const uploadRouter = router({
  getPresignedUrl: protectedProcedure
    .input(z.object({
      filename: z.string().max(255),
      contentType: z.enum([
        'image/jpeg', 'image/png', 'image/webp',
      ]),
      purpose: z.enum(['listing', 'avatar']),
    }))
    .mutation(/* returns { uploadUrl, publicUrl, key } */),
});
```

### 4. Auth System

#### 4.1 Token Strategy

- **Access Token**: JWT, 15-minute expiry, contains `{ sub: userId, role, iat, exp }`
- **Refresh Token**: Opaque random string (64 bytes hex), stored hashed in `sessions` table, 30-day expiry
- **Password Hashing**: `bcryptjs` with 12 salt rounds
- **Token Signing**: RS256 (asymmetric) for production, HS256 acceptable for early development

#### 4.2 Auth Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Redis

    Note over Client,Redis: Registration Flow
    Client->>API: auth.register({ email, username, password })
    API->>DB: Check email/username uniqueness
    DB-->>API: No conflict
    API->>API: Hash password (bcryptjs, 12 rounds)
    API->>DB: INSERT user
    API->>API: Generate access token (JWT 15m)
    API->>API: Generate refresh token (random 64 bytes)
    API->>DB: INSERT session (hashed refresh token)
    API-->>Client: { user, accessToken, refreshToken }

    Note over Client,Redis: Token Refresh Flow
    Client->>API: auth.refresh({ refreshToken })
    API->>DB: Find session by hashed refresh token
    DB-->>API: Session found, not revoked, not expired
    API->>DB: Revoke old session
    API->>API: Generate new access + refresh tokens
    API->>DB: INSERT new session
    API-->>Client: { accessToken, refreshToken }

    Note over Client,Redis: Protected Request Flow
    Client->>API: card.list() + Authorization: Bearer <accessToken>
    API->>API: Verify JWT signature + expiry
    API->>Redis: Check token not in blacklist (for logout)
    Redis-->>API: Not blacklisted
    API->>DB: Execute query
    DB-->>API: Results
    API-->>Client: { items: [...] }
```

#### 4.3 Token Refresh Race Condition Prevention

The refresh token rotation uses a grace period: when a refresh token is used, the old session is marked as "rotated" with a 30-second grace window rather than immediately revoked. This handles the case where multiple concurrent requests from the same client try to refresh simultaneously.

```mermaid
sequenceDiagram
    participant Client1 as Client Tab 1
    participant Client2 as Client Tab 2
    participant API
    participant DB

    Note over Client1,DB: Race condition scenario
    Client1->>API: auth.refresh(tokenA)
    Client2->>API: auth.refresh(tokenA)
    API->>DB: Find session for tokenA
    API->>DB: Find session for tokenA
    DB-->>API: Session valid (Tab 1)
    DB-->>API: Session valid (Tab 2) — within 30s grace
    API->>DB: Mark tokenA as rotated, create tokenB
    API-->>Client1: { tokenB }
    API->>DB: tokenA already rotated but within grace period
    API->>DB: Create tokenC (from same parent)
    API-->>Client2: { tokenC }

    Note over Client1,DB: After grace period, tokenA is fully revoked
```

#### 4.4 tRPC Auth Middleware

```typescript
// apps/api/src/trpc/trpc.middleware.ts
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  const token = ctx.req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing access token' });
  }

  try {
    const payload = await verifyJwt(token);
    // Optional: check Redis blacklist for logged-out tokens
    const isBlacklisted = await ctx.redis.get(`bl:${payload.jti}`);
    if (isBlacklisted) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token revoked' });
    }
    return next({ ctx: { ...ctx, userId: payload.sub, userRole: payload.role } });
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
```

### 5. Card Data Pipeline

#### 5.1 Seed Process

```mermaid
sequenceDiagram
    participant Script as seed-cards.ts
    participant FS as File System
    participant DB as PostgreSQL

    Script->>FS: Read riftbound-tcg-data/sets/en.json
    FS-->>Script: 3 sets
    Script->>DB: UPSERT sets (ON CONFLICT slug DO UPDATE)

    loop For each set
        Script->>FS: Read riftbound-tcg-data/cards/en/{set-slug}.json
        FS-->>Script: Array of cards/products
        Script->>Script: Parse each entry:<br/>- Determine isProduct (rarity === null)<br/>- Parse energyCost/powerCost/might to int<br/>- Map set.id to DB set UUID<br/>- Strip HTML from description
        Script->>DB: UPSERT cards batch (ON CONFLICT external_id DO UPDATE)
    end

    Script->>Script: Log summary:<br/>Sets: 3, Cards: ~550, Products: ~15
```

#### 5.2 Seed Script Design

```typescript
// tools/seed/seed-cards.ts
// Key design decisions:
// 1. Idempotent — safe to run multiple times (uses UPSERT)
// 2. Determines isProduct by checking rarity === null
// 3. Parses string numbers to integers (energyCost, powerCost, might)
// 4. Preserves externalId for cross-referencing with source data
// 5. Runs as standalone script: `pnpm --filter tools exec tsx seed-cards.ts`
// 6. Uses transactions for atomicity per set
```

#### 5.3 Sync Strategy

For new card releases, the upstream `riftbound-tcg-data` repo is updated. The sync process:

1. `git pull` in the `riftbound-tcg-data/` directory
2. Run `seed-cards.ts` again (idempotent UPSERT)
3. Bump the sync hash (stored in a `metadata` key-value table or Redis) so mobile clients know to re-download

This is a manual process triggered by an admin, not automated. Future enhancement: GitHub webhook on the data repo triggers a reseed.

### 6. Shared Packages

#### 6.1 `@la-grieta/db`

- Drizzle schema definitions (all `pgTable` calls)
- Drizzle relations
- Database client factory (`createDbClient(connectionString)`)
- Migration runner
- Exported types: `type User = typeof users.$inferSelect`, etc.

#### 6.2 `@la-grieta/shared`

- **Zod Schemas**: All input/output validation schemas used by tRPC procedures. These are the single source of truth for types across all apps.
- **Inferred Types**: `type RegisterInput = z.infer<typeof registerSchema>`
- **Constants**: Card rarities, card types, domains, order statuses, listing statuses, conditions
- **Utility Functions**: Currency formatting, pagination helpers

#### 6.3 `@la-grieta/tsconfig`

- Base TypeScript config with strict mode
- NestJS-specific config (decorators, emit metadata)
- Next.js config
- React Native config

### 7. Key Technical Decisions

#### 7.1 Redis Usage

Redis serves three purposes:

1. **JWT Blacklist**: When a user logs out, their access token's `jti` is added to Redis with TTL matching remaining token lifetime. This avoids hitting the DB on every authenticated request just to check revocation.
2. **Rate Limiting**: Use `@nestjs/throttler` with Redis store. 100 req/min for public routes, 1000 req/min for authenticated.
3. **Card Sync Hash Cache**: Store the hash of the current card DB state for the mobile sync endpoint. Recalculated on reseed.

Redis is NOT used for session storage (sessions live in PostgreSQL for auditability) or caching query results (premature optimization at this scale).

#### 7.2 R2 Uploads

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant R2 as Cloudflare R2

    Client->>API: upload.getPresignedUrl({ filename, contentType, purpose })
    API->>API: Validate auth + file type
    API->>API: Generate key: {purpose}/{userId}/{uuid}.{ext}
    API->>R2: GeneratePresignedUrl(PUT, key, 10min expiry)
    R2-->>API: Presigned URL
    API-->>Client: { uploadUrl, publicUrl, key }
    Client->>R2: PUT file to uploadUrl (direct upload)
    R2-->>Client: 200 OK
    Client->>API: listing.create({ ..., imageUrls: [publicUrl] })
```

The API never handles file bytes. Clients upload directly to R2 via presigned URLs. The `publicUrl` uses a custom domain or R2 public bucket URL.

#### 7.3 Rate Limiting Strategy

| Route Category | Limit | Window | Store |
|---|---|---|---|
| Public (unauthenticated) | 100 | 1 minute | Redis |
| Authenticated | 1000 | 1 minute | Redis |
| Auth endpoints (login/register) | 10 | 1 minute | Redis |
| Upload presigned URLs | 20 | 1 minute | Redis |

Implemented via `@nestjs/throttler` with a Redis store, applied as NestJS guards that run before tRPC procedure execution.

#### 7.4 Offline Mobile Sync

The mobile app bundles the full card database locally using the `card.sync` endpoint:

1. On first launch, call `card.sync({})` -- returns all cards + a hash
2. Store cards in local SQLite (via `expo-sqlite` or `drizzle-orm/expo-sqlite`)
3. On subsequent launches, call `card.sync({ lastSyncHash })` -- returns `{ unchanged: true }` or updated data
4. All card browsing, collection management, and deck building work offline against local SQLite
5. Collection/deck mutations queue locally and sync when online

#### 7.5 WhatsApp Bot Architecture

The WhatsApp bot is a stateless message handler that calls the API via tRPC client:

```
User WhatsApp Message
  -> WhatsApp Cloud API / Baileys
  -> Message Router (pattern matching)
  -> Flow Handler (conversation state machine)
  -> tRPC Client -> API
  -> Response Builder (text/image/button templates)
  -> WhatsApp Cloud API -> User
```

Conversation state is stored in Redis with a TTL (e.g., "user X is currently browsing listings, page 2"). The bot does not maintain in-memory state.

Key WhatsApp flows:
- **Browse**: "buscar Jinx" -> card search -> show results with buttons
- **List**: "vender" -> guided listing creation flow
- **Buy**: "comprar" -> show listing -> checkout -> Stripe payment link
- **Collection**: "mi coleccion" -> collection stats/browse

#### 7.6 NestJS + tRPC Integration Pattern

tRPC runs inside NestJS as a single controller endpoint. NestJS handles:
- Dependency injection (services, config, database)
- Middleware (CORS, helmet, compression)
- Guards (rate limiting)
- Lifecycle hooks (graceful shutdown)

tRPC handles:
- Router definition and procedure execution
- Input validation (Zod)
- Type-safe client-server contracts
- Batched requests

```typescript
// apps/api/src/trpc/trpc.module.ts
@Module({
  imports: [AuthModule, CardModule, CollectionModule, DeckModule, ListingModule, OrderModule, UploadModule],
  controllers: [TrpcController],
  providers: [TrpcService, TrpcRouter],
})
export class TrpcModule {}

// apps/api/src/trpc/trpc.controller.ts
@Controller()
export class TrpcController {
  @All('/trpc/:path')
  async handler(@Req() req, @Res() res) {
    // Delegate to tRPC HTTP handler
  }
}
```

#### 7.7 Error Handling Strategy

All errors flow through tRPC error codes:

| Scenario | tRPC Code | HTTP Status |
|---|---|---|
| Invalid input | BAD_REQUEST | 400 |
| Not authenticated | UNAUTHORIZED | 401 |
| Not authorized (wrong user) | FORBIDDEN | 403 |
| Resource not found | NOT_FOUND | 404 |
| Duplicate (email, username) | CONFLICT | 409 |
| Rate limited | TOO_MANY_REQUESTS | 429 |
| Server error | INTERNAL_SERVER_ERROR | 500 |

Service layer throws typed errors; tRPC procedures catch and map to appropriate codes. Never expose internal error details to clients.

#### 7.8 Environment Configuration

```env
# .env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/la_grieta
REDIS_URL=redis://localhost:6379

JWT_SECRET=change-me-in-production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=la-grieta-uploads
R2_PUBLIC_URL=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLATFORM_FEE_PERCENT=10

PORT=3000
NODE_ENV=development
```

## Alternatives Considered

### Database ORM: Drizzle vs Prisma vs Raw SQL

#### Option A: Drizzle ORM (Chosen)
- **Pros**: SQL-close syntax, excellent TypeScript inference, lightweight, supports `pgTable` schema-as-code, fast migrations via Drizzle Kit, relational query builder
- **Cons**: Smaller ecosystem than Prisma, fewer guides
- **Effort**: Medium

#### Option B: Prisma
- **Pros**: Mature ecosystem, great docs, Prisma Studio for debugging
- **Cons**: Heavy runtime (Rust engine binary), schema file separate from TypeScript, generated client can be slow, caused friction in v1
- **Effort**: Medium

#### Option C: Raw SQL (pg + sql-template-strings)
- **Pros**: Maximum control, no ORM overhead
- **Cons**: No type safety, manual migration management, error-prone, violates CLAUDE.md rule
- **Effort**: High

### API Framework: tRPC vs REST vs GraphQL

#### Option A: NestJS + tRPC (Chosen)
- **Pros**: End-to-end type safety, auto-generated client types, Zod validation built-in, works with all three frontends, batched requests
- **Cons**: tRPC is opinionated, harder to consume from non-TypeScript clients
- **Effort**: Medium

#### Option B: Pure REST (NestJS controllers)
- **Pros**: Universal, easy to understand, OpenAPI/Swagger docs
- **Cons**: No type safety across the wire, manual type synchronization, more boilerplate
- **Effort**: Medium

#### Option C: GraphQL
- **Pros**: Flexible queries, introspection, good for complex data graphs
- **Cons**: Over-engineered for this use case, complex caching, N+1 query risk, overkill for WhatsApp bot
- **Effort**: High

### Monorepo Tool: Turborepo vs Nx

#### Option A: Turborepo (Chosen)
- **Pros**: Simple config, fast with caching, works naturally with pnpm workspaces, minimal learning curve
- **Cons**: Fewer built-in generators than Nx
- **Effort**: Low

#### Option B: Nx
- **Pros**: More features (generators, affected commands, graph visualization)
- **Cons**: Heavier, steeper learning curve, more config, overkill for 4 apps + 3 packages
- **Effort**: Medium

## Consequences

### Positive
- Type safety from database to client with Drizzle + tRPC + Zod
- Single source of truth for types in `@la-grieta/shared`
- WhatsApp-first API design with atomic, stateless procedures
- Offline-first mobile with local card DB and queue-based sync
- Escrow payment model protects both buyers and sellers
- Idempotent card seeding makes data updates safe and repeatable

### Negative
- tRPC adds a layer between NestJS services and HTTP -- debugging requires understanding both
- Drizzle is less battle-tested than Prisma in production
- Redis is an additional infrastructure dependency
- WhatsApp bot conversation state management adds complexity

### Risks
- **Risk**: tRPC + NestJS integration is non-standard and may have rough edges
  - **Mitigation**: Use the established `nestjs-trpc` adapter pattern; keep tRPC as a thin routing layer over NestJS services
- **Risk**: Offline sync conflicts when mobile queues mutations
  - **Mitigation**: Last-write-wins for collection quantities; server is authoritative; conflict resolution deferred to Phase 4
- **Risk**: WhatsApp API rate limits or policy changes
  - **Mitigation**: Abstract bot logic behind service interfaces; support both Baileys (unofficial) and WhatsApp Cloud API (official)
- **Risk**: Stripe Connect onboarding friction for Honduran sellers
  - **Mitigation**: Research Stripe availability in Honduras early; have manual payment fallback plan

## Implementation Notes

### For Backend Engineers
1. Start with `packages/db` -- define all schemas, generate initial migration, run seed
2. Build `packages/shared` Zod schemas in parallel with DB schemas -- they should mirror each other
3. Set up NestJS app scaffold with tRPC module before any feature modules
4. Each NestJS module should have: `module.ts`, `service.ts`, `router.ts` (tRPC procedures), and `*.spec.ts` tests
5. The tRPC router files in each module are NOT NestJS controllers -- they are plain functions that receive injected services
6. Use `@nestjs/config` with Zod validation for environment variables
7. Rate limiting guard wraps the tRPC controller endpoint, not individual procedures

### For Frontend Engineers (Web)
1. Set up tRPC client in Next.js using `@trpc/next` or `@trpc/react-query`
2. Import Zod schemas from `@la-grieta/shared` for client-side validation
3. Card images come from TCGPlayer CDN URLs stored in the DB -- no local image hosting needed
4. Mobile-first CSS: design for 375px, use Tailwind responsive prefixes to scale up

### For Mobile Engineers
1. Bundle card data on first sync, store in local SQLite via Drizzle's SQLite driver
2. Implement offline mutation queue for collection/deck changes
3. tRPC client connects to API when online; falls back to local data when offline
4. Card scanning (camera) is a future feature -- design the scan flow but don't implement OCR yet

### For WhatsApp Bot Engineers
1. Start with WhatsApp Cloud API (official) over Baileys to avoid account bans
2. Use Redis for conversation state with 30-minute TTL
3. Keep message handlers stateless -- all state comes from Redis or API
4. Build message templates as pure functions that take data and return formatted text
5. The bot authenticates to the API using a service account JWT, not user tokens
