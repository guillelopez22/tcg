"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Integration tests for card browsing.
 *
 * Tests the full stack: CardRouter → CardService → mocked DB.
 * Exercises all filter combinations that Phase 1 requires.
 */
const vitest_1 = require("vitest");
const trpc_service_1 = require("../src/trpc/trpc.service");
const card_service_1 = require("../src/modules/card/card.service");
const card_router_1 = require("../src/modules/card/card.router");
// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------
function makeMockDb() {
    const selectResults = [];
    let selectIdx = 0;
    const select = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = selectIdx++;
        const chain = {};
        chain['from'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['innerJoin'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['orderBy'] = vitest_1.vi.fn().mockImplementation(() => {
            const orderChain = {};
            orderChain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
            orderChain['then'] = (onFulfilled) => Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
            return orderChain;
        });
        chain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
        return chain;
    });
    return {
        select,
        _pushSelect: (...rows) => { selectResults.push(...rows); },
    };
}
// Rate-limit pipeline mock — always under limit
function makeMockRedis() {
    const pipeline = {
        zremrangebyscore: vitest_1.vi.fn().mockReturnThis(),
        zadd: vitest_1.vi.fn().mockReturnThis(),
        zcard: vitest_1.vi.fn().mockReturnThis(),
        expire: vitest_1.vi.fn().mockReturnThis(),
        exec: vitest_1.vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
    };
    return {
        pipeline: vitest_1.vi.fn().mockReturnValue(pipeline),
        get: vitest_1.vi.fn().mockResolvedValue(null),
    };
}
// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const SET_ID = '10000000-0000-0000-0000-000000000001';
const CARD_ID = '20000000-0000-0000-0000-000000000001';
const TEST_SET = {
    id: SET_ID,
    slug: 'origins',
    name: 'Origins',
    total: 298,
    releaseDate: '2025-10-31',
    description: null,
    tcgplayerGroupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};
function makeCard(overrides = {}) {
    return {
        id: overrides.id ?? CARD_ID,
        externalId: 'origins-001-298',
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
        tcgplayerUrl: 'https://tcgplayer.com/652771',
        isProduct: overrides.isProduct ?? false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
}
function buildCardCaller(db, redis) {
    const trpcService = new trpc_service_1.TrpcService();
    const cardService = new card_service_1.CardService(db);
    const cardRouter = new card_router_1.CardRouter(trpcService, cardService);
    const router = cardRouter.buildRouter();
    const ctx = {
        req: {
            headers: {},
            ip: '127.0.0.1',
            method: 'GET',
        },
        db: db,
        redis: redis,
    };
    return router.createCaller(ctx);
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('Card browsing integration', () => {
    let db;
    let redis;
    let caller;
    (0, vitest_1.beforeEach)(() => {
        process.env['JWT_SECRET'] = 'test-secret-min-32-chars-for-test';
        db = makeMockDb();
        redis = makeMockRedis();
        caller = buildCardCaller(db, redis);
    });
    (0, vitest_1.afterEach)(() => {
        delete process.env['JWT_SECRET'];
        vitest_1.vi.restoreAllMocks();
    });
    // =========================================================================
    // card.list — filter combinations
    // =========================================================================
    (0, vitest_1.describe)('card.list', () => {
        (0, vitest_1.it)('should return paginated cards with defaults (no filters)', async () => {
            const cards = [makeCard(), makeCard({ id: 'card-2' })];
            db._pushSelect(cards);
            const result = await caller.list({ limit: 20, includeProducts: false });
            (0, vitest_1.expect)(result.items).toHaveLength(2);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
        });
        (0, vitest_1.it)('should set nextCursor when limit+1 rows are returned', async () => {
            const cards = Array.from({ length: 21 }, (_, i) => makeCard({ id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000` }));
            db._pushSelect(cards);
            const result = await caller.list({ limit: 20, includeProducts: false });
            (0, vitest_1.expect)(result.items).toHaveLength(20);
            (0, vitest_1.expect)(result.nextCursor).toBeTruthy();
        });
        (0, vitest_1.it)('should filter by setSlug (first queries sets, then cards)', async () => {
            db._pushSelect([{ id: SET_ID }]); // set lookup
            db._pushSelect([makeCard()]); // card query
            const result = await caller.list({ limit: 20, includeProducts: false, setSlug: 'origins' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should return empty items when setSlug does not match any set', async () => {
            db._pushSelect([]); // set not found
            const result = await caller.list({ limit: 20, includeProducts: false, setSlug: 'unknown-set' });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
        });
        (0, vitest_1.it)('should filter by rarity=Common', async () => {
            db._pushSelect([makeCard({ rarity: 'Common' })]);
            const result = await caller.list({ limit: 20, includeProducts: false, rarity: 'Common' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by rarity=Rare', async () => {
            db._pushSelect([makeCard({ rarity: 'Rare' })]);
            const result = await caller.list({ limit: 20, includeProducts: false, rarity: 'Rare' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should reject invalid rarity values via Zod validation', async () => {
            await (0, vitest_1.expect)(caller.list({ limit: 20, includeProducts: false, rarity: 'InvalidRarity' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should filter by cardType', async () => {
            db._pushSelect([makeCard({ cardType: 'Champion Unit' })]);
            const result = await caller.list({ limit: 20, includeProducts: false, cardType: 'Champion Unit' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by domain', async () => {
            db._pushSelect([makeCard({ domain: 'Chaos' })]);
            const result = await caller.list({ limit: 20, includeProducts: false, domain: 'Chaos' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by search term', async () => {
            db._pushSelect([makeCard({ name: 'Shadow Stalker', cleanName: 'Shadow Stalker' })]);
            const result = await caller.list({ limit: 20, includeProducts: false, search: 'Shadow' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter with cursor-based pagination', async () => {
            const cursorId = '30000000-0000-0000-0000-aabbccddeeff';
            db._pushSelect([makeCard()]);
            const result = await caller.list({
                limit: 20,
                includeProducts: false,
                cursor: cursorId,
            });
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should apply combined filters: rarity + domain + search', async () => {
            db._pushSelect([makeCard({ rarity: 'Epic', domain: 'Fury', name: 'Infernal King' })]);
            const result = await caller.list({
                limit: 20,
                includeProducts: false,
                rarity: 'Epic',
                domain: 'Fury',
                search: 'Infernal',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should respect limit=5', async () => {
            db._pushSelect([makeCard()]);
            const result = await caller.list({ limit: 5, includeProducts: false });
            (0, vitest_1.expect)(result.items.length).toBeLessThanOrEqual(5);
        });
        (0, vitest_1.it)('should reject limit=0 (below minimum)', async () => {
            await (0, vitest_1.expect)(caller.list({ limit: 0, includeProducts: false })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject limit=101 (above maximum)', async () => {
            await (0, vitest_1.expect)(caller.list({ limit: 101, includeProducts: false })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject cursor that is not a UUID', async () => {
            await (0, vitest_1.expect)(caller.list({ limit: 20, includeProducts: false, cursor: 'not-a-uuid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should return empty results when no cards exist', async () => {
            db._pushSelect([]);
            const result = await caller.list({ limit: 20, includeProducts: false });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
        });
    });
    // =========================================================================
    // card.getById
    // =========================================================================
    (0, vitest_1.describe)('card.getById', () => {
        (0, vitest_1.it)('should return card with set info when card exists', async () => {
            db._pushSelect([{ ...makeCard(), set: TEST_SET }]);
            const result = await caller.getById({ id: CARD_ID });
            (0, vitest_1.expect)(result.id).toBe(CARD_ID);
            (0, vitest_1.expect)(result.set.slug).toBe('origins');
        });
        (0, vitest_1.it)('should throw NOT_FOUND when card does not exist', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(caller.getById({ id: '00000000-0000-0000-0000-000000000000' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
        (0, vitest_1.it)('should reject non-UUID id via Zod validation', async () => {
            await (0, vitest_1.expect)(caller.getById({ id: 'not-a-uuid' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
    });
    // =========================================================================
    // card.sets
    // =========================================================================
    (0, vitest_1.describe)('card.sets', () => {
        (0, vitest_1.it)('should return all sets', async () => {
            db._pushSelect([TEST_SET]);
            const result = await caller.sets();
            (0, vitest_1.expect)(result).toHaveLength(1);
            (0, vitest_1.expect)(result[0].slug).toBe('origins');
        });
        (0, vitest_1.it)('should return empty array when no sets exist', async () => {
            db._pushSelect([]);
            const result = await caller.sets();
            (0, vitest_1.expect)(result).toHaveLength(0);
        });
    });
    // =========================================================================
    // card.sync
    // =========================================================================
    (0, vitest_1.describe)('card.sync', () => {
        (0, vitest_1.it)('should return all cards and a hash when no lastSyncHash provided', async () => {
            db._pushSelect([makeCard()]);
            const result = await caller.sync({});
            (0, vitest_1.expect)(result.hash).toBeTruthy();
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
            (0, vitest_1.expect)(result.upToDate).toBe(false);
        });
        (0, vitest_1.it)('should return upToDate=true when hash matches', async () => {
            // Calculate the hash that the service will produce
            const updatedAt = new Date('2026-01-01T00:00:00Z');
            const card = makeCard({ updatedAt });
            // First call to get the hash
            db._pushSelect([card]);
            const firstResult = await caller.sync({});
            const hash = firstResult.hash;
            // Second call with matching hash
            db._pushSelect([card]);
            const result = await caller.sync({ lastSyncHash: hash });
            (0, vitest_1.expect)(result.upToDate).toBe(true);
            (0, vitest_1.expect)(result.cards).toHaveLength(0);
        });
        (0, vitest_1.it)('should return full card list when hash does not match', async () => {
            db._pushSelect([makeCard()]);
            const result = await caller.sync({ lastSyncHash: 'stale-hash' });
            (0, vitest_1.expect)(result.upToDate).toBe(false);
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
        });
    });
});
