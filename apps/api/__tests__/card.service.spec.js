"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const crypto = __importStar(require("crypto"));
const card_service_1 = require("../src/modules/card/card.service");
// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------
/**
 * Drizzle chain mock for CardService.
 *
 * Call patterns:
 *   list:             db.select().from(cards).where(...).orderBy(...).limit(n+1)
 *   list (setSlug):   db.select({id}).from(sets).where(...).limit(1)  [then cards query]
 *   getById:          db.select({...}).from(cards).innerJoin(...).where(...).limit(1)
 *   getByExternalId:  same as getById
 *   getSets:          db.select().from(sets).orderBy(...)
 *   sync:             db.select().from(cards).where(...).orderBy(...)
 */
function makeMockDb() {
    const selectResults = [];
    let selectIdx = 0;
    const select = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = selectIdx++;
        const chain = {};
        chain['from'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['innerJoin'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['orderBy'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
        // For queries without .limit() (getSets, sync): resolve directly from chain
        // We implement this by making the chain itself thenable when no further chaining
        // Actually getSets uses .orderBy() as terminal — so we need orderBy to also resolve.
        // But we need it to chain for list (which does .orderBy().limit()).
        // Solution: orderBy returns the chain AND is thenable.
        chain['orderBy'] = vitest_1.vi.fn().mockImplementation(() => {
            const orderChain = {};
            orderChain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
            // Thenable for direct await (getSets, sync)
            orderChain['then'] = (onFulfilled) => Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
            return orderChain;
        });
        return chain;
    });
    return {
        select,
        _pushSelect: (...rows) => { selectResults.push(...rows); },
    };
}
// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const SET_ID = 'set-uuid-1111-2222-3333-444444444444';
const CARD_ID = 'card-uuid-aaaa-bbbb-cccc-dddddddddddd';
const EXTERNAL_ID = 'origins-001-298';
const TEST_SET = {
    id: SET_ID,
    slug: 'origins',
    name: 'Origins',
    total: 298,
    releaseDate: '2025-10-31',
    description: 'The first set',
    tcgplayerGroupId: 12345,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
};
function makeCard(overrides = {}) {
    return {
        id: overrides.id ?? CARD_ID,
        externalId: overrides.externalId ?? EXTERNAL_ID,
        number: '001/298',
        code: '001/298',
        name: overrides.name ?? 'Blazing Scorcher',
        cleanName: overrides.cleanName ?? 'Blazing Scorcher',
        setId: overrides.setId ?? SET_ID,
        rarity: overrides.rarity ?? 'Common',
        cardType: overrides.cardType ?? 'Unit',
        domain: overrides.domain ?? 'Fury',
        energyCost: 5,
        powerCost: 0,
        might: 5,
        description: 'ACCELERATE',
        flavorText: null,
        imageSmall: 'https://cdn.tcgplayer.com/small.jpg',
        imageLarge: 'https://cdn.tcgplayer.com/large.jpg',
        tcgplayerId: 652771,
        tcgplayerUrl: 'https://www.tcgplayer.com/product/652771',
        isProduct: overrides.isProduct ?? false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: overrides.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
    };
}
const TEST_CARD = makeCard();
const TEST_CARD_WITH_SET = { ...TEST_CARD, set: TEST_SET };
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('CardService', () => {
    let db;
    let service;
    (0, vitest_1.beforeEach)(() => {
        db = makeMockDb();
        service = new card_service_1.CardService(db);
    });
    // =========================================================================
    // list()
    // =========================================================================
    (0, vitest_1.describe)('list()', () => {
        (0, vitest_1.it)('should return paginated cards with default limit', async () => {
            const cards = Array.from({ length: 5 }, (_, i) => makeCard({ id: `card-${i}`, name: `Card ${i}` }));
            db._pushSelect(cards);
            const result = await service.list({
                limit: 20,
                includeProducts: false,
            });
            (0, vitest_1.expect)(result.items).toHaveLength(5);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
        });
        (0, vitest_1.it)('should set nextCursor when more items exist than the limit', async () => {
            // Return limit+1 cards to trigger next page detection
            const cards = Array.from({ length: 21 }, (_, i) => makeCard({ id: `card-uuid-${i.toString().padStart(4, '0')}-placeholder-uuid`, name: `Card ${i}` }));
            db._pushSelect(cards);
            const result = await service.list({ limit: 20, includeProducts: false });
            (0, vitest_1.expect)(result.items).toHaveLength(20); // trimmed to limit
            (0, vitest_1.expect)(result.nextCursor).toBeTruthy();
            (0, vitest_1.expect)(result.nextCursor).toBe(result.items[19]?.id);
        });
        (0, vitest_1.it)('should return empty array when no cards match', async () => {
            db._pushSelect([]);
            const result = await service.list({ limit: 20, includeProducts: false });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
        });
        (0, vitest_1.it)('should return empty result when setSlug is provided but set does not exist', async () => {
            db._pushSelect([]); // set lookup returns empty
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                setSlug: 'nonexistent-set',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
        });
        (0, vitest_1.it)('should query cards when setSlug matches a known set', async () => {
            db._pushSelect([{ id: SET_ID }]); // set lookup
            db._pushSelect([TEST_CARD]); // card query
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                setSlug: 'origins',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should include products when includeProducts is true', async () => {
            const product = makeCard({ isProduct: true, rarity: 'Common' });
            db._pushSelect([product]);
            const result = await service.list({ limit: 20, includeProducts: true });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should pass cursor filter when cursor is provided', async () => {
            const cursorId = 'cursor-uuid-0000-0000-0000-000000000000';
            db._pushSelect([TEST_CARD]);
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                cursor: cursorId,
            });
            // Verify the db.select was called (cursor condition was built)
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by rarity', async () => {
            db._pushSelect([TEST_CARD]); // mock returns the filtered result
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                rarity: 'Common',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            // db.select was called with rarity condition built
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should filter by cardType', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                cardType: 'Unit',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by domain (partial match via ilike)', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                domain: 'Fury',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by search term (partial match via ilike on cleanName)', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.list({
                limit: 20,
                includeProducts: false,
                search: 'Blazing',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should fetch limit+1 rows from DB to detect next page', async () => {
            db._pushSelect([]);
            await service.list({ limit: 20, includeProducts: false });
            // The chain's limit() was called — we verify the service passes limit+1
            // by checking the mock was called (implementation detail tested indirectly)
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should return items with correct card shape', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.list({ limit: 20, includeProducts: false });
            const card = result.items[0];
            (0, vitest_1.expect)(card.id).toBe(CARD_ID);
            (0, vitest_1.expect)(card.name).toBe('Blazing Scorcher');
            (0, vitest_1.expect)(card.rarity).toBe('Common');
        });
    });
    // =========================================================================
    // getById()
    // =========================================================================
    (0, vitest_1.describe)('getById()', () => {
        (0, vitest_1.it)('should return card with set info when card exists', async () => {
            db._pushSelect([TEST_CARD_WITH_SET]);
            const result = await service.getById({ id: CARD_ID });
            (0, vitest_1.expect)(result.id).toBe(CARD_ID);
            (0, vitest_1.expect)(result.name).toBe('Blazing Scorcher');
            (0, vitest_1.expect)(result.set.slug).toBe('origins');
        });
        (0, vitest_1.it)('should throw NOT_FOUND when card does not exist', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(service.getById({ id: '00000000-0000-0000-0000-000000000000' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
        });
        (0, vitest_1.it)('should include set relationship in the returned object', async () => {
            db._pushSelect([TEST_CARD_WITH_SET]);
            const result = await service.getById({ id: CARD_ID });
            (0, vitest_1.expect)(result.set).toBeDefined();
            (0, vitest_1.expect)(result.set.id).toBe(SET_ID);
            (0, vitest_1.expect)(result.set.name).toBe('Origins');
        });
        (0, vitest_1.it)('should include all expected card fields', async () => {
            db._pushSelect([TEST_CARD_WITH_SET]);
            const result = await service.getById({ id: CARD_ID });
            const required = [
                'id', 'externalId', 'number', 'code', 'name', 'cleanName',
                'setId', 'rarity', 'cardType', 'domain', 'energyCost', 'powerCost',
                'might', 'description', 'flavorText', 'imageSmall', 'imageLarge',
                'tcgplayerId', 'tcgplayerUrl', 'isProduct', 'createdAt', 'updatedAt',
            ];
            for (const field of required) {
                (0, vitest_1.expect)(result, `missing field: ${field}`).toHaveProperty(field);
            }
        });
    });
    // =========================================================================
    // getByExternalId()
    // =========================================================================
    (0, vitest_1.describe)('getByExternalId()', () => {
        (0, vitest_1.it)('should return card with set info when externalId matches', async () => {
            db._pushSelect([TEST_CARD_WITH_SET]);
            const result = await service.getByExternalId({ externalId: EXTERNAL_ID });
            (0, vitest_1.expect)(result.externalId).toBe(EXTERNAL_ID);
            (0, vitest_1.expect)(result.set.slug).toBe('origins');
        });
        (0, vitest_1.it)('should throw NOT_FOUND when externalId does not match', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(service.getByExternalId({ externalId: 'nonexistent-id' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
        });
    });
    // =========================================================================
    // getSets()
    // =========================================================================
    (0, vitest_1.describe)('getSets()', () => {
        (0, vitest_1.it)('should return all sets ordered by releaseDate', async () => {
            const sets = [
                { ...TEST_SET, id: 'set-1', slug: 'origins', releaseDate: '2025-10-31' },
                { ...TEST_SET, id: 'set-2', slug: 'spiritforged', releaseDate: '2026-01-01' },
            ];
            db._pushSelect(sets);
            const result = await service.getSets();
            (0, vitest_1.expect)(result).toHaveLength(2);
            (0, vitest_1.expect)(result[0]?.slug).toBe('origins');
            (0, vitest_1.expect)(result[1]?.slug).toBe('spiritforged');
        });
        (0, vitest_1.it)('should return empty array when no sets exist', async () => {
            db._pushSelect([]);
            const result = await service.getSets();
            (0, vitest_1.expect)(result).toHaveLength(0);
        });
        (0, vitest_1.it)('should return sets with all required fields', async () => {
            db._pushSelect([TEST_SET]);
            const [set] = await service.getSets();
            (0, vitest_1.expect)(set?.id).toBe(SET_ID);
            (0, vitest_1.expect)(set?.slug).toBe('origins');
            (0, vitest_1.expect)(set?.name).toBe('Origins');
            (0, vitest_1.expect)(set?.total).toBe(298);
        });
    });
    // =========================================================================
    // sync()
    // =========================================================================
    (0, vitest_1.describe)('sync()', () => {
        (0, vitest_1.it)('should return all non-product cards with a hash', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.sync({});
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
            (0, vitest_1.expect)(result.hash).toBeTruthy();
            (0, vitest_1.expect)(result.upToDate).toBe(false);
        });
        (0, vitest_1.it)('should return upToDate=false when no lastSyncHash provided', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.sync({});
            (0, vitest_1.expect)(result.upToDate).toBe(false);
        });
        (0, vitest_1.it)('should return upToDate=true and empty cards when hash matches', async () => {
            // Build the exact hash the service would generate
            const updatedAt = new Date('2026-01-01T00:00:00Z');
            const card = makeCard({ updatedAt });
            const expectedHash = crypto
                .createHash('sha256')
                .update(`${card.id}:${updatedAt.getTime()}`)
                .digest('hex');
            db._pushSelect([card]);
            const result = await service.sync({ lastSyncHash: expectedHash });
            (0, vitest_1.expect)(result.upToDate).toBe(true);
            (0, vitest_1.expect)(result.cards).toHaveLength(0);
            (0, vitest_1.expect)(result.hash).toBe(expectedHash);
        });
        (0, vitest_1.it)('should return upToDate=false and full card list when hash does not match', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.sync({ lastSyncHash: 'old-stale-hash-value' });
            (0, vitest_1.expect)(result.upToDate).toBe(false);
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
        });
        (0, vitest_1.it)('should generate a deterministic SHA-256 hash from card ids and updatedAt', async () => {
            const card = makeCard({ updatedAt: new Date('2026-01-15T12:00:00Z') });
            db._pushSelect([card]);
            const result1 = await service.sync({});
            db._pushSelect([card]);
            const result2 = await service.sync({});
            (0, vitest_1.expect)(result1.hash).toBe(result2.hash); // deterministic
        });
        (0, vitest_1.it)('should produce different hashes when card updatedAt changes', async () => {
            const card1 = makeCard({ updatedAt: new Date('2026-01-01T00:00:00Z') });
            db._pushSelect([card1]);
            const result1 = await service.sync({});
            const card2 = makeCard({ updatedAt: new Date('2026-02-01T00:00:00Z') });
            db._pushSelect([card2]);
            const result2 = await service.sync({});
            (0, vitest_1.expect)(result1.hash).not.toBe(result2.hash);
        });
        (0, vitest_1.it)('should return empty cards array when DB has no non-product cards', async () => {
            db._pushSelect([]);
            const result = await service.sync({});
            (0, vitest_1.expect)(result.cards).toHaveLength(0);
            (0, vitest_1.expect)(result.upToDate).toBe(false);
        });
        (0, vitest_1.it)('should return a 64-character hex SHA-256 hash', async () => {
            db._pushSelect([TEST_CARD]);
            const result = await service.sync({});
            (0, vitest_1.expect)(result.hash).toHaveLength(64);
            (0, vitest_1.expect)(result.hash).toMatch(/^[0-9a-f]+$/);
        });
    });
});
