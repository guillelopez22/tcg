import { pgTable, uuid, varchar, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';

export const matchFormatEnum = pgEnum('match_format', ['1v1', '2v2', 'ffa']);
export const matchStatusEnum = pgEnum('match_status', ['waiting', 'active', 'completed', 'abandoned']);

export const matchSessions = pgTable('match_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 12 }).notNull().unique(),
  format: matchFormatEnum('format').notNull(),
  status: matchStatusEnum('status').notNull().default('waiting'),
  hostUserId: uuid('host_user_id'),
  winTarget: integer('win_target').notNull(),
  state: jsonb('state').notNull().default({}),
  winnerId: varchar('winner_id', { length: 50 }),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('idx_match_sessions_code').on(table.code),
  index('idx_match_sessions_host_user_id').on(table.hostUserId),
  index('idx_match_sessions_status').on(table.status),
]);

export type MatchSession = typeof matchSessions.$inferSelect;
export type NewMatchSession = typeof matchSessions.$inferInsert;
