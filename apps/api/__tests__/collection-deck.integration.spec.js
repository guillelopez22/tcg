"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Integration tests for the Collection + Deck flow.
 *
 * Tests interactions between CollectionService and DeckService:
 *   1. Add cards to collection
 *   2. Create deck from collection
 *   3. Browse public decks
 *   4. Auth boundary: owner-only mutations, public reads
 *
 * Uses service-level testing with mocked DB (no real DB needed).
 * Verifies the services behave correctly as part of the full flow.
 */
const vitest_1 = require("vitest");
const collection_service_1 = require("../src/modules/collection/collection.service");
const deck_service_1 = require("../src/modules/deck/deck.service");
// ---------------------------------------------------------------------------
// Shared mock factory (supports both CollectionService and DeckService)
// ---------------------------------------------------------------------------
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
// Fixtures
// ---------------------------------------------------------------------------
const USER_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'b2c3d4e5-0000-0000-0000-000000000002';
const CARD_ID_1 = '10000000-0000-0000-0000-000000000001';
const CARD_ID_2 = '10000000-0000-0000-0000-000000000002';
const COLLECTION_ENTRY_ID = '20000000-0000-0000-0000-000000000001';
const DECK_ID = '40000000-0000-0000-0000-000000000001';
const SET_ID = '30000000-0000-0000-0000-000000000001';
function makeCollectionEntry(cardId, quantity = 4) {
    return {
        id: COLLECTION_ENTRY_ID,
        userId: USER_ID,
        cardId,
        quantity,
        condition: 'near_mint',
        notes: null,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    };
}
function makeDeck(isPublic = false) {
    return {
        id: DECK_ID,
        userId: USER_ID,
        name: 'Fury Rush',
        description: null,
        coverCardId: null,
        isPublic,
        domain: 'Fury',
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    };
}
function makeDeckCard(cardId, quantity = 2) {
    return {
        id: '50000000-0000-0000-0000-000000000001',
        deckId: DECK_ID,
        cardId,
        quantity,
        createdAt: new Date(),
        updatedAt: new Date(),
        card: {
            id: cardId,
            name: 'Blazing Scorcher',
            cleanName: 'Blazing Scorcher',
            rarity: 'Common',
            cardType: 'Unit',
            domain: 'Fury',
            imageSmall: null,
            imageLarge: null,
        },
    };
}
// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('Collection + Deck Integration', () => {
    let db;
    let collectionService;
    let deckService;
    (0, vitest_1.beforeEach)(() => {
        db = makeMockDb();
        collectionService = new collection_service_1.CollectionService(db);
        deckService = new deck_service_1.DeckService(db);
    });
    // =========================================================================
    // Full flow: add cards → build deck → browse
    // =========================================================================
    (0, vitest_1.describe)('add cards to collection then create deck', () => {
        (0, vitest_1.it)('should add a card to collection and then use it to create a deck', async () => {
            // Step 1: Add card to collection
            db._pushSelect([{ id: CARD_ID_1 }]); // card exists
            db._pushSelect([]); // no existing entry
            db._pushInsert([makeCollectionEntry(CARD_ID_1, 4)]);
            const collectionEntry = await collectionService.add(USER_ID, {
                cardId: CARD_ID_1,
                quantity: 4,
                condition: 'near_mint',
            });
            (0, vitest_1.expect)(collectionEntry.cardId).toBe(CARD_ID_1);
            (0, vitest_1.expect)(collectionEntry.quantity).toBe(4);
            // Step 2: Create deck using cards from collection
            const deck = makeDeck(false);
            db._pushInsert([deck]); // deck insert
            db._pushInsert([]); // deckCards insert
            db._pushSelect([deck]); // getById -> deck
            db._pushSelect([makeDeckCard(CARD_ID_1, 4)]); // getById -> cards
            const createdDeck = await deckService.create(USER_ID, {
                name: 'Fury Rush',
                cards: [{ cardId: CARD_ID_1, quantity: 4 }],
            });
            (0, vitest_1.expect)(createdDeck.name).toBe('Fury Rush');
            (0, vitest_1.expect)(createdDeck.cards).toHaveLength(1);
            (0, vitest_1.expect)(createdDeck.cards[0].cardId).toBe(CARD_ID_1);
            (0, vitest_1.expect)(createdDeck.cards[0].quantity).toBe(4);
        });
        (0, vitest_1.it)('should add multiple cards and create deck with all of them', async () => {
            // Add card 1
            db._pushSelect([{ id: CARD_ID_1 }]);
            db._pushSelect([]);
            db._pushInsert([makeCollectionEntry(CARD_ID_1, 4)]);
            await collectionService.add(USER_ID, { cardId: CARD_ID_1, quantity: 4, condition: 'near_mint' });
            // Add card 2
            db._pushSelect([{ id: CARD_ID_2 }]);
            db._pushSelect([]);
            db._pushInsert([makeCollectionEntry(CARD_ID_2, 2)]);
            await collectionService.add(USER_ID, { cardId: CARD_ID_2, quantity: 2, condition: 'near_mint' });
            // Build deck with both cards
            const deck = makeDeck(true); // public
            db._pushInsert([deck]);
            db._pushInsert([]);
            db._pushSelect([deck]);
            db._pushSelect([makeDeckCard(CARD_ID_1, 4), makeDeckCard(CARD_ID_2, 2)]);
            const createdDeck = await deckService.create(USER_ID, {
                name: 'Fury Rush',
                isPublic: true,
                cards: [
                    { cardId: CARD_ID_1, quantity: 4 },
                    { cardId: CARD_ID_2, quantity: 2 },
                ],
            });
            (0, vitest_1.expect)(createdDeck.isPublic).toBe(true);
            (0, vitest_1.expect)(createdDeck.cards).toHaveLength(2);
        });
    });
    // =========================================================================
    // Auth boundary tests: owner-only mutations
    // =========================================================================
    (0, vitest_1.describe)('auth boundary: collection mutations require ownership', () => {
        (0, vitest_1.it)('should allow owner to remove their own collection entry', async () => {
            db._pushSelect([{ id: COLLECTION_ENTRY_ID }]); // owned by USER_ID
            await (0, vitest_1.expect)(collectionService.remove(USER_ID, { id: COLLECTION_ENTRY_ID })).resolves.toBeUndefined();
        });
        (0, vitest_1.it)('should reject non-owner from removing collection entry', async () => {
            db._pushSelect([]); // not found for OTHER_USER_ID
            await (0, vitest_1.expect)(collectionService.remove(OTHER_USER_ID, { id: COLLECTION_ENTRY_ID })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
        (0, vitest_1.it)('should allow owner to update their collection entry quantity', async () => {
            const existing = makeCollectionEntry(CARD_ID_1, 2);
            const updated = { ...existing, quantity: 5 };
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await collectionService.update(USER_ID, {
                id: COLLECTION_ENTRY_ID,
                quantity: 5,
            });
            (0, vitest_1.expect)(result.quantity).toBe(5);
        });
    });
    (0, vitest_1.describe)('auth boundary: deck mutations require ownership', () => {
        (0, vitest_1.it)('should allow owner to update their deck', async () => {
            const existing = { id: DECK_ID, userId: USER_ID };
            const updated = makeDeck(false);
            db._pushSelect([existing]);
            db._pushUpdate([{ ...updated, name: 'Renamed Deck' }]);
            const result = await deckService.update(USER_ID, {
                id: DECK_ID,
                name: 'Renamed Deck',
            });
            (0, vitest_1.expect)(result.name).toBe('Renamed Deck');
        });
        (0, vitest_1.it)('should reject non-owner from updating deck', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(deckService.update(OTHER_USER_ID, { id: DECK_ID, name: 'Hijacked' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
        (0, vitest_1.it)('should allow owner to delete their deck', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(deckService.delete(USER_ID, { id: DECK_ID })).resolves.toBeUndefined();
        });
        (0, vitest_1.it)('should reject non-owner from deleting deck', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(deckService.delete(OTHER_USER_ID, { id: DECK_ID })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
        (0, vitest_1.it)('should allow owner to setCards on their deck', async () => {
            const deck = makeDeck();
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            db._pushInsert([]);
            db._pushSelect([deck]);
            db._pushSelect([]);
            const result = await deckService.setCards(USER_ID, {
                deckId: DECK_ID,
                cards: [],
            });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
        });
        (0, vitest_1.it)('should reject non-owner from calling setCards', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(deckService.setCards(OTHER_USER_ID, {
                deckId: DECK_ID,
                cards: [{ cardId: CARD_ID_1, quantity: 2 }],
            })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
    });
    // =========================================================================
    // Public read: anyone can browse public decks
    // =========================================================================
    (0, vitest_1.describe)('public deck visibility', () => {
        (0, vitest_1.it)('should allow any user to browse public decks', async () => {
            const publicDeck = makeDeck(true);
            db._pushSelect([publicDeck]);
            const result = await deckService.browse({ limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(result.items[0].isPublic).toBe(true);
        });
        (0, vitest_1.it)('should allow non-owner to read a public deck', async () => {
            const publicDeck = makeDeck(true);
            db._pushSelect([publicDeck]);
            db._pushSelect([]);
            const result = await deckService.getById(OTHER_USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
        });
        (0, vitest_1.it)('should allow unauthenticated access to browse', async () => {
            db._pushSelect([]);
            const result = await deckService.browse({ limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
        });
        (0, vitest_1.it)('should block private deck from non-owner', async () => {
            const privateDeck = makeDeck(false);
            db._pushSelect([privateDeck]);
            await (0, vitest_1.expect)(deckService.getById(OTHER_USER_ID, { id: DECK_ID })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
        (0, vitest_1.it)('should allow owner to read their own private deck', async () => {
            const privateDeck = makeDeck(false);
            db._pushSelect([privateDeck]);
            db._pushSelect([makeDeckCard(CARD_ID_1)]);
            const result = await deckService.getById(USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
            (0, vitest_1.expect)(result.isPublic).toBe(false);
        });
    });
    // =========================================================================
    // Collection stats with multiple sets
    // =========================================================================
    (0, vitest_1.describe)('collection stats', () => {
        (0, vitest_1.it)('should compute stats after adding cards to collection', async () => {
            // stats() flow: aggregates, then sets, then per-set counts
            db._pushSelect([{ totalCards: 6, uniqueCards: 2 }]); // aggregates
            db._pushSelect([
                {
                    id: SET_ID,
                    slug: 'origins',
                    name: 'Origins',
                    total: 298,
                    releaseDate: '2025-10-31',
                    description: null,
                    tcgplayerGroupId: 12345,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]);
            db._pushSelect([{ count: 298 }]); // total in set
            db._pushSelect([{ count: 2 }]); // owned in set
            const stats = await collectionService.stats(USER_ID);
            (0, vitest_1.expect)(stats.totalCards).toBe(6);
            (0, vitest_1.expect)(stats.uniqueCards).toBe(2);
            (0, vitest_1.expect)(stats.setStats).toHaveLength(1);
            (0, vitest_1.expect)(stats.setStats[0].ownedCards).toBe(2);
            (0, vitest_1.expect)(stats.setStats[0].totalCards).toBe(298);
            (0, vitest_1.expect)(stats.setStats[0].completionPercent).toBeLessThan(5); // 2/298 ≈ 0.67%
        });
        (0, vitest_1.it)('should return 0 completion for a set with no owned cards', async () => {
            db._pushSelect([{ totalCards: 0, uniqueCards: 0 }]);
            db._pushSelect([
                {
                    id: SET_ID,
                    slug: 'spiritforged',
                    name: 'Spiritforged',
                    total: 200,
                    releaseDate: '2026-01-01',
                    description: null,
                    tcgplayerGroupId: 99999,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ]);
            db._pushSelect([{ count: 200 }]);
            db._pushSelect([{ count: 0 }]);
            const stats = await collectionService.stats(USER_ID);
            (0, vitest_1.expect)(stats.setStats[0].completionPercent).toBe(0);
            (0, vitest_1.expect)(stats.setStats[0].ownedCards).toBe(0);
        });
    });
    // =========================================================================
    // Bulk add
    // =========================================================================
    (0, vitest_1.describe)('bulk collection add', () => {
        (0, vitest_1.it)('should add multiple cards at once via addBulk', async () => {
            // Card 1
            db._pushSelect([{ id: CARD_ID_1 }]);
            db._pushSelect([]);
            db._pushInsert([makeCollectionEntry(CARD_ID_1, 4)]);
            // Card 2
            db._pushSelect([{ id: CARD_ID_2 }]);
            db._pushSelect([]);
            db._pushInsert([makeCollectionEntry(CARD_ID_2, 2)]);
            const results = await collectionService.addBulk(USER_ID, {
                entries: [
                    { cardId: CARD_ID_1, quantity: 4, condition: 'near_mint' },
                    { cardId: CARD_ID_2, quantity: 2, condition: 'lightly_played' },
                ],
            });
            (0, vitest_1.expect)(results).toHaveLength(2);
            (0, vitest_1.expect)(results[0].cardId).toBe(CARD_ID_1);
            (0, vitest_1.expect)(results[1].cardId).toBe(CARD_ID_2);
        });
        (0, vitest_1.it)('should atomically fail addBulk if a card does not exist', async () => {
            db._pushSelect([]); // first card not found
            await (0, vitest_1.expect)(collectionService.addBulk(USER_ID, {
                entries: [
                    { cardId: CARD_ID_1, quantity: 4, condition: 'near_mint' },
                ],
            })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
        });
    });
});
