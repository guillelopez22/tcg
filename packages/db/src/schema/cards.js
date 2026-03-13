"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cards = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const sets_1 = require("./sets");
exports.cards = (0, pg_core_1.pgTable)('cards', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    externalId: (0, pg_core_1.varchar)('external_id', { length: 100 }).notNull().unique(),
    number: (0, pg_core_1.varchar)('number', { length: 20 }).notNull(),
    code: (0, pg_core_1.varchar)('code', { length: 20 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    cleanName: (0, pg_core_1.varchar)('clean_name', { length: 255 }).notNull(),
    setId: (0, pg_core_1.uuid)('set_id').notNull().references(() => sets_1.sets.id),
    rarity: (0, pg_core_1.varchar)('rarity', { length: 50 }).notNull(),
    cardType: (0, pg_core_1.varchar)('card_type', { length: 50 }).notNull(),
    domain: (0, pg_core_1.varchar)('domain', { length: 100 }).notNull(),
    energyCost: (0, pg_core_1.integer)('energy_cost'),
    powerCost: (0, pg_core_1.integer)('power_cost'),
    might: (0, pg_core_1.integer)('might'),
    description: (0, pg_core_1.text)('description'),
    flavorText: (0, pg_core_1.text)('flavor_text'),
    imageSmall: (0, pg_core_1.varchar)('image_small', { length: 500 }),
    imageLarge: (0, pg_core_1.varchar)('image_large', { length: 500 }),
    tcgplayerId: (0, pg_core_1.integer)('tcgplayer_id'),
    tcgplayerUrl: (0, pg_core_1.varchar)('tcgplayer_url', { length: 500 }),
    isProduct: (0, pg_core_1.boolean)('is_product').notNull().default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => [
    (0, pg_core_1.index)('idx_cards_set_id').on(table.setId),
    (0, pg_core_1.index)('idx_cards_rarity').on(table.rarity),
    (0, pg_core_1.index)('idx_cards_card_type').on(table.cardType),
    (0, pg_core_1.index)('idx_cards_domain').on(table.domain),
    (0, pg_core_1.index)('idx_cards_clean_name').on(table.cleanName),
    (0, pg_core_1.index)('idx_cards_is_product').on(table.isProduct),
]);
