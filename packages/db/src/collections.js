"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collections = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const cards_1 = require("./cards");
const enums_1 = require("./enums");
exports.collections = (0, pg_core_1.pgTable)('collections', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => users_1.users.id, { onDelete: 'cascade' }),
    cardId: (0, pg_core_1.uuid)('card_id').notNull().references(() => cards_1.cards.id),
    variant: (0, enums_1.cardVariantEnum)('variant').notNull().default('normal'),
    condition: (0, enums_1.cardConditionEnum)('condition').notNull().default('near_mint'),
    purchasePrice: (0, pg_core_1.numeric)('purchase_price', { precision: 10, scale: 2 }),
    photoUrl: (0, pg_core_1.varchar)('photo_url', { length: 500 }),
    photoKey: (0, pg_core_1.varchar)('photo_key', { length: 500 }),
    notes: (0, pg_core_1.varchar)('notes', { length: 500 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_collections_user_card').on(table.userId, table.cardId),
    (0, pg_core_1.index)('idx_collections_user_id').on(table.userId),
    (0, pg_core_1.index)('idx_collections_card_id').on(table.cardId),
]);
