import { pgTable, uuid, boolean, timestamp, uniqueIndex, numeric } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { cardVariantEnum, wishlistTypeEnum } from './enums';

export const wishlists = pgTable('wishlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id),
  type: wishlistTypeEnum('type').notNull(),
  preferredVariant: cardVariantEnum('preferred_variant'),
  maxPrice: numeric('max_price', { precision: 10, scale: 2 }),
  askingPrice: numeric('asking_price', { precision: 10, scale: 2 }),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('idx_wishlists_user_card_type').on(table.userId, table.cardId, table.type),
]);

export type Wishlist = typeof wishlists.$inferSelect;
export type NewWishlist = typeof wishlists.$inferInsert;
