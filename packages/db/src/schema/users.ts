import { pgTable, uuid, varchar, text, boolean, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  bio: text('bio'),
  city: varchar('city', { length: 100 }),
  whatsappPhone: varchar('whatsapp_phone', { length: 20 }),
  isVerified: boolean('is_verified').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeConnectId: varchar('stripe_connect_id', { length: 255 }),
  role: userRoleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
  index('idx_users_email').on(table.email),
  index('idx_users_username').on(table.username),
  index('idx_users_whatsapp_phone').on(table.whatsappPhone),
  index('idx_users_city').on(table.city),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
