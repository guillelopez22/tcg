import { pgTable, uuid, integer, numeric, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { cards } from './cards';

export const cardPrices = pgTable('card_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  tcgplayerProductId: integer('tcgplayer_product_id').notNull(),
  // Normal foil/non-foil prices
  lowPrice: numeric('low_price', { precision: 10, scale: 2 }),
  midPrice: numeric('mid_price', { precision: 10, scale: 2 }),
  highPrice: numeric('high_price', { precision: 10, scale: 2 }),
  marketPrice: numeric('market_price', { precision: 10, scale: 2 }),
  directLowPrice: numeric('direct_low_price', { precision: 10, scale: 2 }),
  // Foil prices
  foilLowPrice: numeric('foil_low_price', { precision: 10, scale: 2 }),
  foilMidPrice: numeric('foil_mid_price', { precision: 10, scale: 2 }),
  foilHighPrice: numeric('foil_high_price', { precision: 10, scale: 2 }),
  foilMarketPrice: numeric('foil_market_price', { precision: 10, scale: 2 }),
  foilDirectLowPrice: numeric('foil_direct_low_price', { precision: 10, scale: 2 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('uq_card_prices_card_id').on(table.cardId),
  index('idx_card_prices_tcgplayer_product_id').on(table.tcgplayerProductId),
  index('idx_card_prices_card_id').on(table.cardId),
]);

export type CardPrice = typeof cardPrices.$inferSelect;
export type NewCardPrice = typeof cardPrices.$inferInsert;
