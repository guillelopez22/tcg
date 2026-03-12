import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cards } from './cards';

export const decks = pgTable('decks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  coverCardId: uuid('cover_card_id').references(() => cards.id),
  isPublic: boolean('is_public').notNull().default(false),
  domain: varchar('domain', { length: 100 }),
  tier: varchar('tier', { length: 2 }),
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

export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
export type DeckCard = typeof deckCards.$inferSelect;
export type NewDeckCard = typeof deckCards.$inferInsert;
