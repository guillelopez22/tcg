import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { cardConditionEnum, listingStatusEnum } from './enums';

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  sellerId: uuid('seller_id').notNull().references(() => users.id),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priceInCents: integer('price_in_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  condition: cardConditionEnum('condition').notNull(),
  quantity: integer('quantity').notNull().default(1),
  status: listingStatusEnum('status').notNull().default('active'),
  imageUrls: text('image_urls').array(),
  city: varchar('city', { length: 100 }),
  shippingAvailable: varchar('shipping_available', { length: 20 }).notNull().default('local'),
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

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
