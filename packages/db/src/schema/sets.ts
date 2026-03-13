import { pgTable, uuid, varchar, integer, date, timestamp } from 'drizzle-orm/pg-core';

export const sets = pgTable('sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  total: integer('total').notNull(),
  releaseDate: date('release_date').notNull(),
  description: varchar('description', { length: 1000 }),
  tcgplayerGroupId: integer('tcgplayer_group_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
