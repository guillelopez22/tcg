import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { decks } from './decks';

export const deckShareCodes = pgTable(
  'deck_share_codes',
  {
    code: varchar('code', { length: 12 }).primaryKey(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_deck_share_codes_deck_id').on(table.deckId),
  ],
);

export type DeckShareCode = typeof deckShareCodes.$inferSelect;
export type NewDeckShareCode = typeof deckShareCodes.$inferInsert;
