"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardPrices = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const cards_1 = require("./cards");
exports.cardPrices = (0, pg_core_1.pgTable)('card_prices', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    cardId: (0, pg_core_1.uuid)('card_id').notNull().references(() => cards_1.cards.id, { onDelete: 'cascade' }),
    tcgplayerProductId: (0, pg_core_1.integer)('tcgplayer_product_id').notNull(),
    // Normal foil/non-foil prices
    lowPrice: (0, pg_core_1.numeric)('low_price', { precision: 10, scale: 2 }),
    midPrice: (0, pg_core_1.numeric)('mid_price', { precision: 10, scale: 2 }),
    highPrice: (0, pg_core_1.numeric)('high_price', { precision: 10, scale: 2 }),
    marketPrice: (0, pg_core_1.numeric)('market_price', { precision: 10, scale: 2 }),
    directLowPrice: (0, pg_core_1.numeric)('direct_low_price', { precision: 10, scale: 2 }),
    // Foil prices
    foilLowPrice: (0, pg_core_1.numeric)('foil_low_price', { precision: 10, scale: 2 }),
    foilMidPrice: (0, pg_core_1.numeric)('foil_mid_price', { precision: 10, scale: 2 }),
    foilHighPrice: (0, pg_core_1.numeric)('foil_high_price', { precision: 10, scale: 2 }),
    foilMarketPrice: (0, pg_core_1.numeric)('foil_market_price', { precision: 10, scale: 2 }),
    foilDirectLowPrice: (0, pg_core_1.numeric)('foil_direct_low_price', { precision: 10, scale: 2 }),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.unique)('uq_card_prices_card_id').on(table.cardId),
    (0, pg_core_1.index)('idx_card_prices_tcgplayer_product_id').on(table.tcgplayerProductId),
    (0, pg_core_1.index)('idx_card_prices_card_id').on(table.cardId),
]);
