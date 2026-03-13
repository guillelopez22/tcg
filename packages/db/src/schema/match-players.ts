import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { pgEnum } from 'drizzle-orm/pg-core';
import { matchSessions } from './match-sessions';

export const playerRoleEnum = pgEnum('player_role', ['player', 'spectator']);

export const matchPlayers = pgTable('match_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => matchSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  guestName: varchar('guest_name', { length: 100 }),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: playerRoleEnum('role').notNull().default('player'),
  teamId: integer('team_id'),
  color: varchar('color', { length: 20 }).notNull(),
  finalScore: integer('final_score'),
  isWinner: boolean('is_winner').notNull().default(false),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => [
  index('idx_match_players_session_id').on(table.sessionId),
  index('idx_match_players_user_id').on(table.userId),
]);

export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type NewMatchPlayer = typeof matchPlayers.$inferInsert;
