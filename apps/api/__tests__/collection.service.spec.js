"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const collection_service_1 = require("../src/modules/collection/collection.service");
// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------
/**
 * Drizzle chain mock for CollectionService.
 *
 * Call patterns:
 *   list:              db.select({...}).from(collections).innerJoin(...).innerJoin(...).where(...).orderBy(...).limit(n+1)
 *   list (setSlug):    db.select({id}).from(sets).where(...).limit(1)  [then collections query]
 *   add (card check):  db.select({id}).from(cards).where(...).limit(1)
 *   add (existing):    db.select({id,qty}).from(collections).where(...).limit(1)
 *   add (update):      db.update(collections).set({...}).where(...).returning()
 *   add (insert):      db.insert(collections).values({...}).returning()
 *   update (select):   db.select().from(collections).where(...).limit(1)
 *   update (delete):   db.delete(collections).where(...)
 *   update (update):   db.update(collections).set({...}).where(...).returning()
 *   remove (select):   db.select({id}).from(collections).where(...).limit(1)
 *   remove (delete):   db.delete(collections).where(...)
 *   stats:             various select + innerJoin chains
 */
function makeMockDb() {
    const selectResults = [];
    const insertResults = [];
    const updateResults = [];
    let selectIdx = 0;
    let insertIdx = 0;
    let updateIdx = 0;
    const select = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = selectIdx++;
        const chain = {};
        chain['from'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['innerJoin'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
        chain['orderBy'] = vitest_1.vi.fn().mockImplementation(() => {
            const orderChain = {};
            orderChain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
            orderChain['then'] = (onFulfilled) => Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
            return orderChain;
        });
        return chain;
    });
    const insert = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = insertIdx++;
        const chain = {};
        chain['values'] = vitest_1.vi.fn().mockImplementation(() => {
            const valuesChain = {};
            valuesChain['returning'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(insertResults[capturedIdx] ?? []));
            valuesChain['then'] = (onFulfilled) => Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
            return valuesChain;
        });
        return chain;
    });
    const update = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = updateIdx++;
        const chain = {};
        chain['set'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['returning'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(updateResults[capturedIdx] ?? []));
        return chain;
    });
    const deleteFn = vitest_1.vi.fn().mockImplementation(() => {
        const chain = {};
        chain['where'] = vitest_1.vi.fn().mockResolvedValue([]);
        return chain;
    });
    return {
        select,
        insert,
        update,
        delete: deleteFn,
        _pushSelect: (...rows) => { selectResults.push(...rows); },
        _pushInsert: (...rows) => { insertResults.push(...rows); },
        _pushUpdate: (...rows) => { updateResults.push(...rows); },
    };
}
// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const USER_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'b2c3d4e5-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000001';
const CARD_ID_2 = '10000000-0000-0000-0000-000000000002';
const COLLECTION_ID = '20000000-0000-0000-0000-000000000001';
const SET_ID = '30000000-0000-0000-0000-000000000001';
function makeCollectionEntry(overrides = {}) {
    return {
        id: overrides.id ?? COLLECTION_ID,
        userId: overrides.userId ?? USER_ID,
        cardId: overrides.cardId ?? CARD_ID,
        quantity: overrides.quantity ?? 1,
        condition: overrides.condition ?? 'near_mint',
        notes: overrides.notes ?? null,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    };
}
function makeCollectionEntryWithCard(overrides = {}) {
    return {
        ...makeCollectionEntry(overrides),
        card: {
            id: overrides.cardId ?? CARD_ID,
            externalId: 'origins-001',
            number: '001/298',
            code: '001/298',
            name: 'Blazing Scorcher',
            cleanName: 'Blazing Scorcher',
            setId: SET_ID,
            rarity: 'Common',
            cardType: 'Unit',
            domain: 'Fury',
            energyCost: 5,
            powerCost: 0,
            might: 5,
            description: 'ACCELERATE',
            flavorText: null,
            imageSmall: 'https://cdn.example.com/small.jpg',
            imageLarge: 'https://cdn.example.com/large.jpg',
            tcgplayerId: 652771,
            tcgplayerUrl: 'https://www.tcgplayer.com/product/652771',
            isProduct: false,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
            set: {
                id: SET_ID,
                slug: 'origins',
                name: 'Origins',
                total: 298,
                releaseDate: '2025-10-31',
                description: null,
                tcgplayerGroupId: 12345,
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
            },
        },
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('CollectionService', () => {
    let db;
    let service;
    (0, vitest_1.beforeEach)(() => {
        db = makeMockDb();
        service = new collection_service_1.CollectionService(db);
    });
    // =========================================================================
    // list()
    // =========================================================================
    (0, vitest_1.describe)('list()', () => {
        (0, vitest_1.it)('should return paginated collection entries for the user', async () => {
            const entries = [makeCollectionEntryWithCard()];
            db._pushSelect(entries);
            const result = await service.list(USER_ID, { limit: 20 });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
            (0, vitest_1.expect)(result.items[0].userId).toBe(USER_ID);
        });
        (0, vitest_1.it)('should return empty result when user has no collection entries', async () => {
            db._pushSelect([]);
            const result = await service.list(USER_ID, { limit: 20 });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
        });
        (0, vitest_1.it)('should set nextCursor when there are more items than the limit', async () => {
            const entries = Array.from({ length: 21 }, (_, i) => makeCollectionEntryWithCard({ id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000` }));
            db._pushSelect(entries);
            const result = await service.list(USER_ID, { limit: 20 });
            (0, vitest_1.expect)(result.items).toHaveLength(20);
            (0, vitest_1.expect)(result.nextCursor).toBeTruthy();
            (0, vitest_1.expect)(result.nextCursor).toBe(result.items[19]?.id);
        });
        (0, vitest_1.it)('should return empty result when setSlug filter matches no set', async () => {
            db._pushSelect([]); // set lookup returns empty
            const result = await service.list(USER_ID, { limit: 20, setSlug: 'nonexistent-set' });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
        });
        (0, vitest_1.it)('should filter by setSlug when set exists', async () => {
            db._pushSelect([{ id: SET_ID }]); // set lookup
            db._pushSelect([makeCollectionEntryWithCard()]); // collection query
            const result = await service.list(USER_ID, { limit: 20, setSlug: 'origins' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(db.select).toHaveBeenCalledTimes(2);
        });
        (0, vitest_1.it)('should include card details in each entry', async () => {
            db._pushSelect([makeCollectionEntryWithCard()]);
            const result = await service.list(USER_ID, { limit: 20 });
            const entry = result.items[0];
            (0, vitest_1.expect)(entry.card).toBeDefined();
            (0, vitest_1.expect)(entry.card.name).toBe('Blazing Scorcher');
            (0, vitest_1.expect)(entry.card.rarity).toBe('Common');
        });
        (0, vitest_1.it)('should filter by rarity when provided', async () => {
            db._pushSelect([makeCollectionEntryWithCard()]);
            const result = await service.list(USER_ID, { limit: 20, rarity: 'Common' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should use cursor for pagination', async () => {
            const cursorId = '11111111-0000-0000-0000-000000000001';
            db._pushSelect([makeCollectionEntryWithCard()]);
            const result = await service.list(USER_ID, { limit: 20, cursor: cursorId });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
        });
    });
    // =========================================================================
    // add()
    // =========================================================================
    (0, vitest_1.describe)('add()', () => {
        (0, vitest_1.it)('should create a new collection entry when card exists and no duplicate', async () => {
            const entry = makeCollectionEntry();
            db._pushSelect([{ id: CARD_ID }]); // card exists
            db._pushSelect([]); // no existing entry
            db._pushInsert([entry]); // insert
            const result = await service.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition: 'near_mint' });
            (0, vitest_1.expect)(result.id).toBe(COLLECTION_ID);
            (0, vitest_1.expect)(result.cardId).toBe(CARD_ID);
            (0, vitest_1.expect)(result.quantity).toBe(1);
        });
        (0, vitest_1.it)('should throw NOT_FOUND when card does not exist', async () => {
            db._pushSelect([]); // card not found
            await (0, vitest_1.expect)(service.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition: 'near_mint' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
        });
        (0, vitest_1.it)('should upsert (increment quantity) when same user+card+condition entry already exists', async () => {
            const existing = { id: COLLECTION_ID, quantity: 2 };
            const updated = makeCollectionEntry({ quantity: 3 });
            db._pushSelect([{ id: CARD_ID }]); // card exists
            db._pushSelect([existing]); // existing entry found
            db._pushUpdate([updated]); // update returns
            const result = await service.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition: 'near_mint' });
            (0, vitest_1.expect)(result.quantity).toBe(3);
            (0, vitest_1.expect)(db.update).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(db.insert).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('should cap quantity at 99 when upsert would exceed max', async () => {
            const existing = { id: COLLECTION_ID, quantity: 98 };
            const updated = makeCollectionEntry({ quantity: 99 });
            db._pushSelect([{ id: CARD_ID }]);
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await service.add(USER_ID, { cardId: CARD_ID, quantity: 5, condition: 'near_mint' });
            (0, vitest_1.expect)(result.quantity).toBe(99); // capped at 99
        });
        (0, vitest_1.it)('should default condition to near_mint when not provided', async () => {
            const entry = makeCollectionEntry({ condition: 'near_mint' });
            db._pushSelect([{ id: CARD_ID }]);
            db._pushSelect([]); // no existing
            db._pushInsert([entry]);
            const result = await service.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition: 'near_mint' });
            (0, vitest_1.expect)(result.condition).toBe('near_mint');
        });
        (0, vitest_1.it)('should store notes when provided', async () => {
            const entry = makeCollectionEntry({ notes: 'Bought at GP San Jose' });
            db._pushSelect([{ id: CARD_ID }]);
            db._pushSelect([]);
            db._pushInsert([entry]);
            const result = await service.add(USER_ID, {
                cardId: CARD_ID,
                quantity: 1,
                condition: 'near_mint',
                notes: 'Bought at GP San Jose',
            });
            (0, vitest_1.expect)(result.notes).toBe('Bought at GP San Jose');
        });
        (0, vitest_1.it)('should support all valid card conditions', async () => {
            const conditions = ['near_mint', 'lightly_played', 'moderately_played', 'heavily_played', 'damaged'];
            for (const condition of conditions) {
                const freshDb = makeMockDb();
                const svc = new collection_service_1.CollectionService(freshDb);
                const entry = makeCollectionEntry({ condition });
                freshDb._pushSelect([{ id: CARD_ID }]);
                freshDb._pushSelect([]);
                freshDb._pushInsert([entry]);
                const result = await svc.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition });
                (0, vitest_1.expect)(result.condition).toBe(condition);
            }
        });
        (0, vitest_1.it)('should create separate entries for same card with different conditions', async () => {
            // First entry: near_mint
            const nmEntry = makeCollectionEntry({ id: '20000000-0000-0000-0000-000000000001', condition: 'near_mint' });
            db._pushSelect([{ id: CARD_ID }]);
            db._pushSelect([]); // no near_mint entry
            db._pushInsert([nmEntry]);
            const nmResult = await service.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition: 'near_mint' });
            // Second entry: damaged (different db, simulating second call)
            const dmgEntry = makeCollectionEntry({ id: '20000000-0000-0000-0000-000000000002', condition: 'damaged' });
            db._pushSelect([{ id: CARD_ID }]);
            db._pushSelect([]); // no damaged entry
            db._pushInsert([dmgEntry]);
            const dmgResult = await service.add(USER_ID, { cardId: CARD_ID, quantity: 1, condition: 'damaged' });
            (0, vitest_1.expect)(nmResult.condition).toBe('near_mint');
            (0, vitest_1.expect)(dmgResult.condition).toBe('damaged');
            (0, vitest_1.expect)(nmResult.id).not.toBe(dmgResult.id);
        });
    });
    // =========================================================================
    // addBulk()
    // =========================================================================
    (0, vitest_1.describe)('addBulk()', () => {
        (0, vitest_1.it)('should add multiple cards in bulk', async () => {
            const entry1 = makeCollectionEntry({ id: '20000000-0000-0000-0000-000000000001', cardId: CARD_ID });
            const entry2 = makeCollectionEntry({ id: '20000000-0000-0000-0000-000000000002', cardId: CARD_ID_2 });
            // Card 1: exists, no existing entry, insert
            db._pushSelect([{ id: CARD_ID }]);
            db._pushSelect([]);
            db._pushInsert([entry1]);
            // Card 2: exists, no existing entry, insert
            db._pushSelect([{ id: CARD_ID_2 }]);
            db._pushSelect([]);
            db._pushInsert([entry2]);
            const result = await service.addBulk(USER_ID, {
                entries: [
                    { cardId: CARD_ID, quantity: 1, condition: 'near_mint' },
                    { cardId: CARD_ID_2, quantity: 2, condition: 'lightly_played' },
                ],
            });
            (0, vitest_1.expect)(result).toHaveLength(2);
            (0, vitest_1.expect)(result[0].cardId).toBe(CARD_ID);
            (0, vitest_1.expect)(result[1].cardId).toBe(CARD_ID_2);
        });
        (0, vitest_1.it)('should return empty array for empty entries list', async () => {
            const result = await service.addBulk(USER_ID, { entries: [] });
            (0, vitest_1.expect)(result).toHaveLength(0);
        });
        (0, vitest_1.it)('should throw NOT_FOUND and stop if any card in bulk does not exist', async () => {
            db._pushSelect([]); // first card not found
            await (0, vitest_1.expect)(service.addBulk(USER_ID, {
                entries: [{ cardId: CARD_ID, quantity: 1, condition: 'near_mint' }],
            })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
        });
        (0, vitest_1.it)('should process up to 50 entries', async () => {
            // Setup 50 entries all pointing to same card (with different conditions isn't realistic, but tests the limit)
            const entries = Array.from({ length: 10 }, (_, i) => {
                const cardId = `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
                db._pushSelect([{ id: cardId }]);
                db._pushSelect([]);
                db._pushInsert([makeCollectionEntry({ cardId })]);
                return { cardId, quantity: 1, condition: 'near_mint' };
            });
            const result = await service.addBulk(USER_ID, { entries });
            (0, vitest_1.expect)(result).toHaveLength(10);
        });
    });
    // =========================================================================
    // update()
    // =========================================================================
    (0, vitest_1.describe)('update()', () => {
        (0, vitest_1.it)('should update the quantity of an existing collection entry', async () => {
            const existing = makeCollectionEntry({ quantity: 1 });
            const updated = makeCollectionEntry({ quantity: 5 });
            db._pushSelect([existing]); // ownership check
            db._pushUpdate([updated]); // update
            const result = await service.update(USER_ID, { id: COLLECTION_ID, quantity: 5 });
            (0, vitest_1.expect)(result).not.toBeNull();
            (0, vitest_1.expect)(result.quantity).toBe(5);
        });
        (0, vitest_1.it)('should throw NOT_FOUND when collection entry does not exist', async () => {
            db._pushSelect([]); // entry not found
            await (0, vitest_1.expect)(service.update(USER_ID, { id: COLLECTION_ID, quantity: 3 })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
        });
        (0, vitest_1.it)('should throw NOT_FOUND when user does not own the collection entry', async () => {
            db._pushSelect([]); // not found (wrong userId in query)
            await (0, vitest_1.expect)(service.update(OTHER_USER_ID, { id: COLLECTION_ID, quantity: 3 })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
        });
        (0, vitest_1.it)('should delete the entry when quantity is set to 0', async () => {
            const existing = makeCollectionEntry({ quantity: 2 });
            db._pushSelect([existing]);
            const result = await service.update(USER_ID, { id: COLLECTION_ID, quantity: 0 });
            (0, vitest_1.expect)(result).toBeNull();
            (0, vitest_1.expect)(db.delete).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(db.update).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('should update notes when provided', async () => {
            const existing = makeCollectionEntry({ notes: 'Old note' });
            const updated = makeCollectionEntry({ notes: 'New note' });
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await service.update(USER_ID, {
                id: COLLECTION_ID,
                quantity: 1,
                notes: 'New note',
            });
            (0, vitest_1.expect)(result.notes).toBe('New note');
        });
        (0, vitest_1.it)('should keep existing notes when notes not provided in update', async () => {
            const existing = makeCollectionEntry({ notes: 'Preserved note', quantity: 1 });
            const updated = makeCollectionEntry({ notes: 'Preserved note', quantity: 3 });
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await service.update(USER_ID, { id: COLLECTION_ID, quantity: 3 });
            (0, vitest_1.expect)(result.notes).toBe('Preserved note');
        });
    });
    // =========================================================================
    // remove()
    // =========================================================================
    (0, vitest_1.describe)('remove()', () => {
        (0, vitest_1.it)('should remove a collection entry owned by the user', async () => {
            db._pushSelect([{ id: COLLECTION_ID }]); // ownership verified
            await (0, vitest_1.expect)(service.remove(USER_ID, { id: COLLECTION_ID })).resolves.toBeUndefined();
            (0, vitest_1.expect)(db.delete).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)('should throw NOT_FOUND when collection entry does not exist', async () => {
            db._pushSelect([]); // not found
            await (0, vitest_1.expect)(service.remove(USER_ID, { id: COLLECTION_ID })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
        });
        (0, vitest_1.it)('should throw NOT_FOUND when user does not own the entry', async () => {
            db._pushSelect([]); // not found for this userId
            await (0, vitest_1.expect)(service.remove(OTHER_USER_ID, { id: COLLECTION_ID })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
        });
        (0, vitest_1.it)('should not delete when ownership check fails', async () => {
            db._pushSelect([]);
            try {
                await service.remove(OTHER_USER_ID, { id: COLLECTION_ID });
            }
            catch {
                // expected
            }
            (0, vitest_1.expect)(db.delete).not.toHaveBeenCalled();
        });
    });
    // =========================================================================
    // stats()
    // =========================================================================
    (0, vitest_1.describe)('stats()', () => {
        (0, vitest_1.it)('should return zero stats when user has no collection entries', async () => {
            // stats() calls: select aggregates, then select sets, then for each set: totalCards + ownedCards
            db._pushSelect([{ totalCards: 0, uniqueCards: 0 }]); // totals
            db._pushSelect([]); // no sets
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.totalCards).toBe(0);
            (0, vitest_1.expect)(result.uniqueCards).toBe(0);
            (0, vitest_1.expect)(result.setStats).toHaveLength(0);
        });
        (0, vitest_1.it)('should return correct totalCards and uniqueCards counts', async () => {
            db._pushSelect([{ totalCards: 10, uniqueCards: 7 }]); // aggregates
            db._pushSelect([]); // no sets
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.totalCards).toBe(10);
            (0, vitest_1.expect)(result.uniqueCards).toBe(7);
        });
        (0, vitest_1.it)('should compute completion percentage for each set', async () => {
            const testSet = {
                id: SET_ID,
                slug: 'origins',
                name: 'Origins',
                total: 298,
                releaseDate: '2025-10-31',
                description: null,
                tcgplayerGroupId: 12345,
                createdAt: new Date('2026-01-01T00:00:00Z'),
                updatedAt: new Date('2026-01-01T00:00:00Z'),
            };
            db._pushSelect([{ totalCards: 30, uniqueCards: 20 }]); // aggregates
            db._pushSelect([testSet]); // sets
            db._pushSelect([{ count: 298 }]); // total cards in set
            db._pushSelect([{ count: 149 }]); // owned cards in set
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.setStats).toHaveLength(1);
            const setStat = result.setStats[0];
            (0, vitest_1.expect)(setStat.setSlug).toBe('origins');
            (0, vitest_1.expect)(setStat.setName).toBe('Origins');
            (0, vitest_1.expect)(setStat.totalCards).toBe(298);
            (0, vitest_1.expect)(setStat.ownedCards).toBe(149);
            (0, vitest_1.expect)(setStat.completionPercent).toBe(50); // 149/298 = ~50%
        });
        (0, vitest_1.it)('should handle 100% completion correctly', async () => {
            const testSet = {
                id: SET_ID,
                slug: 'origins',
                name: 'Origins',
                total: 100,
                releaseDate: '2025-10-31',
                description: null,
                tcgplayerGroupId: 12345,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            db._pushSelect([{ totalCards: 100, uniqueCards: 100 }]);
            db._pushSelect([testSet]);
            db._pushSelect([{ count: 100 }]); // total in set
            db._pushSelect([{ count: 100 }]); // owned
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.setStats[0].completionPercent).toBe(100);
        });
        (0, vitest_1.it)('should handle 0% completion when user owns no cards from a set', async () => {
            const testSet = {
                id: SET_ID,
                slug: 'spiritforged',
                name: 'Spiritforged',
                total: 200,
                releaseDate: '2026-01-01',
                description: null,
                tcgplayerGroupId: 99999,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            db._pushSelect([{ totalCards: 5, uniqueCards: 5 }]);
            db._pushSelect([testSet]);
            db._pushSelect([{ count: 200 }]);
            db._pushSelect([{ count: 0 }]); // owns none
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.setStats[0].completionPercent).toBe(0);
            (0, vitest_1.expect)(result.setStats[0].ownedCards).toBe(0);
        });
        (0, vitest_1.it)('should handle null totals gracefully (empty collections)', async () => {
            db._pushSelect([null]); // null row from aggregates
            db._pushSelect([]); // no sets
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.totalCards).toBe(0);
            (0, vitest_1.expect)(result.uniqueCards).toBe(0);
        });
        (0, vitest_1.it)('should include setId in each set stat', async () => {
            const testSet = {
                id: SET_ID,
                slug: 'origins',
                name: 'Origins',
                total: 100,
                releaseDate: '2025-10-31',
                description: null,
                tcgplayerGroupId: 12345,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            db._pushSelect([{ totalCards: 5, uniqueCards: 5 }]);
            db._pushSelect([testSet]);
            db._pushSelect([{ count: 100 }]);
            db._pushSelect([{ count: 5 }]);
            const result = await service.stats(USER_ID);
            (0, vitest_1.expect)(result.setStats[0].setId).toBe(SET_ID);
        });
    });
});
