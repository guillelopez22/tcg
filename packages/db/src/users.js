"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = exports.userRoleEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.userRoleEnum = (0, pg_core_1.pgEnum)('user_role', ['user', 'admin']);
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    username: (0, pg_core_1.varchar)('username', { length: 50 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 255 }).notNull(),
    displayName: (0, pg_core_1.varchar)('display_name', { length: 100 }),
    avatarUrl: (0, pg_core_1.varchar)('avatar_url', { length: 500 }),
    bio: (0, pg_core_1.text)('bio'),
    city: (0, pg_core_1.varchar)('city', { length: 100 }),
    whatsappPhone: (0, pg_core_1.varchar)('whatsapp_phone', { length: 20 }),
    isVerified: (0, pg_core_1.boolean)('is_verified').notNull().default(false),
    isActive: (0, pg_core_1.boolean)('is_active').notNull().default(true),
    stripeCustomerId: (0, pg_core_1.varchar)('stripe_customer_id', { length: 255 }),
    stripeConnectId: (0, pg_core_1.varchar)('stripe_connect_id', { length: 255 }),
    role: (0, exports.userRoleEnum)('role').notNull().default('user'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_users_email').on(table.email),
    (0, pg_core_1.index)('idx_users_username').on(table.username),
    (0, pg_core_1.index)('idx_users_whatsapp_phone').on(table.whatsappPhone),
    (0, pg_core_1.index)('idx_users_city').on(table.city),
]);
