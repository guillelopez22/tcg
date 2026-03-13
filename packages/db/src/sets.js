"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sets = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.sets = (0, pg_core_1.pgTable)('sets', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    externalId: (0, pg_core_1.varchar)('external_id', { length: 100 }).notNull().unique(),
    slug: (0, pg_core_1.varchar)('slug', { length: 100 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    total: (0, pg_core_1.integer)('total').notNull(),
    releaseDate: (0, pg_core_1.date)('release_date').notNull(),
    description: (0, pg_core_1.varchar)('description', { length: 1000 }),
    tcgplayerGroupId: (0, pg_core_1.integer)('tcgplayer_group_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});
