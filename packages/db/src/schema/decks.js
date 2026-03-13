"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deckCards = exports.decks = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const users_1 = require("./users");
const cards_1 = require("./cards");
exports.decks = (0, pg_core_1.pgTable)('decks', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').notNull().references(() => users_1.users.id, { onDelete: 'cascade' }),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    coverCardId: (0, pg_core_1.uuid)('cover_card_id').references(() => cards_1.cards.id),
    isPublic: (0, pg_core_1.boolean)('is_public').notNull().default(false),
    domain: (0, pg_core_1.varchar)('domain', { length: 100 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_decks_user_id').on(table.userId),
    (0, pg_core_1.index)('idx_decks_is_public').on(table.isPublic),
]);
exports.deckCards = (0, pg_core_1.pgTable)('deck_cards', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    deckId: (0, pg_core_1.uuid)('deck_id').notNull().references(() => exports.decks.id, { onDelete: 'cascade' }),
    cardId: (0, pg_core_1.uuid)('card_id').notNull().references(() => cards_1.cards.id),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(1),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.uniqueIndex)('idx_deck_cards_deck_card').on(table.deckId, table.cardId),
    (0, pg_core_1.index)('idx_deck_cards_deck_id').on(table.deckId),
]);
