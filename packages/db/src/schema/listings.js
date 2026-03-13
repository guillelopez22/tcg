"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listings = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const cards_1 = require("./cards");
const enums_1 = require("./enums");
exports.listings = (0, pg_core_1.pgTable)('listings', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    sellerId: (0, pg_core_1.uuid)('seller_id').notNull().references(() => users_1.users.id),
    cardId: (0, pg_core_1.uuid)('card_id').notNull().references(() => cards_1.cards.id),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    priceInCents: (0, pg_core_1.integer)('price_in_cents').notNull(),
    currency: (0, pg_core_1.varchar)('currency', { length: 3 }).notNull().default('USD'),
    condition: (0, enums_1.cardConditionEnum)('condition').notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(1),
    status: (0, enums_1.listingStatusEnum)('status').notNull().default('active'),
    imageUrls: (0, pg_core_1.text)('image_urls').array(),
    city: (0, pg_core_1.varchar)('city', { length: 100 }),
    shippingAvailable: (0, pg_core_1.varchar)('shipping_available', { length: 20 }).notNull().default('local'),
    expiresAt: (0, pg_core_1.timestamp)('expires_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_listings_seller_id').on(table.sellerId),
    (0, pg_core_1.index)('idx_listings_card_id').on(table.cardId),
    (0, pg_core_1.index)('idx_listings_status').on(table.status),
    (0, pg_core_1.index)('idx_listings_city').on(table.city),
    (0, pg_core_1.index)('idx_listings_price').on(table.priceInCents),
    (0, pg_core_1.index)('idx_listings_created_at').on(table.createdAt),
]);
