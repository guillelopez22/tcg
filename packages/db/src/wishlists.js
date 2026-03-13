"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlists = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const cards_1 = require("./cards");
const enums_1 = require("./enums");
exports.wishlists = (0, pg_core_1.pgTable)('wishlists', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => users_1.users.id, { onDelete: 'cascade' }),
    cardId: (0, pg_core_1.uuid)('card_id').notNull().references(() => cards_1.cards.id),
    type: (0, enums_1.wishlistTypeEnum)('type').notNull(),
    preferredVariant: (0, enums_1.cardVariantEnum)('preferred_variant'),
    maxPrice: (0, pg_core_1.numeric)('max_price', { precision: 10, scale: 2 }),
    askingPrice: (0, pg_core_1.numeric)('asking_price', { precision: 10, scale: 2 }),
    isPublic: (0, pg_core_1.boolean)('is_public').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('idx_wishlists_user_card_type').on(table.userId, table.cardId, table.type),
]);
