import { pgTable, uuid, varchar, timestamp, index, numeric } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';
import { cardConditionEnum, cardVariantEnum } from './enums';

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
  index('idx_collections_user_card').on(table.userId, table.cardId),
  index('idx_collections_user_id').on(table.userId),
  index('idx_collections_card_id').on(table.cardId),
]);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
