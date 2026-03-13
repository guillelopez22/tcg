"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
exports.sessions = (0, pg_core_1.pgTable)('sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => users_1.users.id, { onDelete: 'cascade' }),
    refreshToken: (0, pg_core_1.varchar)('refresh_token', { length: 500 }).notNull().unique(),
    userAgent: (0, pg_core_1.varchar)('user_agent', { length: 500 }),
    ipAddress: (0, pg_core_1.varchar)('ip_address', { length: 45 }),
    isRevoked: (0, pg_core_1.boolean)('is_revoked').notNull().default(false),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_sessions_user_id').on(table.userId),
    (0, pg_core_1.index)('idx_sessions_refresh_token').on(table.refreshToken),
    (0, pg_core_1.index)('idx_sessions_expires_at').on(table.expiresAt),
]);
