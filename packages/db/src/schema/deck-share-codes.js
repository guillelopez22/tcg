"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deckShareCodes = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const decks_1 = require("./decks");
exports.deckShareCodes = (0, pg_core_1.pgTable)('deck_share_codes', {
    code: (0, pg_core_1.varchar)('code', { length: 12 }).primaryKey(),
    deckId: (0, pg_core_1.uuid)('deck_id').notNull().references(() => decks_1.decks.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)('idx_deck_share_codes_deck_id').on(table.deckId),
]);
