import { pgTable, uuid, varchar, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sets } from './sets';

export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 100 }).notNull().unique(),
  number: varchar('number', { length: 20 }).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  cleanName: varchar('clean_name', { length: 255 }).notNull(),
  setId: uuid('set_id').notNull().references(() => sets.id),
  rarity: varchar('rarity', { length: 50 }).notNull(),
  cardType: varchar('card_type', { length: 50 }).notNull(),
  domain: varchar('domain', { length: 100 }).notNull(),
  energyCost: integer('energy_cost'),
  powerCost: integer('power_cost'),
  might: integer('might'),
  description: text('description'),
  flavorText: text('flavor_text'),
  imageSmall: varchar('image_small', { length: 500 }),
  imageLarge: varchar('image_large', { length: 500 }),
  tcgplayerId: integer('tcgplayer_id'),
  tcgplayerUrl: varchar('tcgplayer_url', { length: 500 }),
  isProduct: boolean('is_product').notNull().default(false),
  keywords: text('keywords').array().default([]),
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

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
