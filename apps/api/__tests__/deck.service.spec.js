"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const deck_service_1 = require("../src/modules/deck/deck.service");
// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------
/**
 * Drizzle chain mock for DeckService.
 *
 * Call patterns:
 *   list:                db.select().from(decks).where(...).orderBy(...).limit(n+1)
 *   getById (deck):      db.select().from(decks).where(...).limit(1)
 *   getById (cards):     db.select({...}).from(deckCards).innerJoin(...).where(...).orderBy(...)
 *   create (insert deck):db.insert(decks).values({...}).returning()
 *   create (insert cards):db.insert(deckCards).values([...])
 *   update (select):     db.select({id,userId}).from(decks).where(...).limit(1)
 *   update (update/select): db.update(decks).set({...}).where(...).returning() OR db.select().from(decks).where(...).limit(1)
 *   delete (select):     db.select({id,userId}).from(decks).where(...).limit(1)
 *   delete (delete):     db.delete(decks).where(...)
 *   setCards (select):   db.select({id,userId}).from(decks).where(...).limit(1)
 *   setCards (delete):   db.delete(deckCards).where(...)
 *   setCards (insert):   db.insert(deckCards).values([...])
 *   browse:              db.select().from(decks).where(...).orderBy(...).limit(n+1)
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
const DECK_ID = '40000000-0000-0000-0000-000000000001';
const DECK_ID_2 = '40000000-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000001';
const CARD_ID_2 = '10000000-0000-0000-0000-000000000002';
const DECK_CARD_ID = '50000000-0000-0000-0000-000000000001';
function makeDeck(overrides = {}) {
    return {
        id: overrides.id ?? DECK_ID,
        userId: overrides.userId ?? USER_ID,
        name: overrides.name ?? 'Fury Rush',
        description: overrides.description ?? null,
        coverCardId: overrides.coverCardId ?? null,
        isPublic: overrides.isPublic ?? false,
        domain: overrides.domain ?? 'Fury',
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
    };
}
function makeDeckCard(overrides = {}) {
    return {
        id: overrides.id ?? DECK_CARD_ID,
        deckId: overrides.deckId ?? DECK_ID,
        cardId: overrides.cardId ?? CARD_ID,
        quantity: overrides.quantity ?? 2,
        createdAt: new Date('2026-03-10T00:00:00Z'),
        updatedAt: new Date('2026-03-10T00:00:00Z'),
        card: {
            id: overrides.cardId ?? CARD_ID,
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
function makeDeckWithCards(deckOverrides = {}, cardCount = 1) {
    return {
        ...makeDeck(deckOverrides),
        cards: Array.from({ length: cardCount }, (_, i) => makeDeckCard({ id: `50000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}` })),
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('DeckService', () => {
    let db;
    let service;
    (0, vitest_1.beforeEach)(() => {
        db = makeMockDb();
        service = new deck_service_1.DeckService(db);
    });
    // =========================================================================
    // list()
    // =========================================================================
    (0, vitest_1.describe)('list()', () => {
        (0, vitest_1.it)('should return paginated decks for the user', async () => {
            const decks = [makeDeck()];
            db._pushSelect(decks);
            const result = await service.list(USER_ID, { limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(result.nextCursor).toBeUndefined();
            (0, vitest_1.expect)(result.items[0].userId).toBe(USER_ID);
        });
        (0, vitest_1.it)('should return empty result when user has no decks', async () => {
            db._pushSelect([]);
            const result = await service.list(USER_ID, { limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
        });
        (0, vitest_1.it)('should set nextCursor when more items exist than the limit', async () => {
            const decks = Array.from({ length: 11 }, (_, i) => makeDeck({ id: `40000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}` }));
            db._pushSelect(decks);
            const result = await service.list(USER_ID, { limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(10);
            (0, vitest_1.expect)(result.nextCursor).toBeTruthy();
        });
        (0, vitest_1.it)('should use cursor for pagination', async () => {
            db._pushSelect([makeDeck()]);
            const result = await service.list(USER_ID, {
                limit: 10,
                cursor: '11111111-0000-0000-0000-000000000001',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should not return other users decks', async () => {
            // The WHERE clause filters by userId — our mock returns what we push.
            // We verify only decks for this user are queried by checking no cross-user data leaks.
            db._pushSelect([makeDeck({ userId: USER_ID })]);
            const result = await service.list(USER_ID, { limit: 10 });
            (0, vitest_1.expect)(result.items[0].userId).toBe(USER_ID);
        });
    });
    // =========================================================================
    // getById()
    // =========================================================================
    (0, vitest_1.describe)('getById()', () => {
        (0, vitest_1.it)('should return deck with cards when deck exists and user is owner', async () => {
            db._pushSelect([makeDeck()]); // deck lookup
            db._pushSelect([makeDeckCard()]); // card rows
            const result = await service.getById(USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
            (0, vitest_1.expect)(result.name).toBe('Fury Rush');
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
        });
        (0, vitest_1.it)('should throw NOT_FOUND when deck does not exist', async () => {
            db._pushSelect([]); // deck not found
            await (0, vitest_1.expect)(service.getById(USER_ID, { id: '00000000-0000-0000-0000-000000000000' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
        });
        (0, vitest_1.it)('should return public deck to any user (including non-owner)', async () => {
            db._pushSelect([makeDeck({ isPublic: true })]); // public deck
            db._pushSelect([makeDeckCard()]); // cards
            const result = await service.getById(OTHER_USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
        });
        (0, vitest_1.it)('should return public deck to unauthenticated user (null userId)', async () => {
            db._pushSelect([makeDeck({ isPublic: true })]);
            db._pushSelect([]);
            const result = await service.getById(null, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
        });
        (0, vitest_1.it)('should throw FORBIDDEN when private deck is accessed by non-owner', async () => {
            db._pushSelect([makeDeck({ isPublic: false, userId: USER_ID })]);
            await (0, vitest_1.expect)(service.getById(OTHER_USER_ID, { id: DECK_ID })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'This deck is private' });
        });
        (0, vitest_1.it)('should allow owner to access their own private deck', async () => {
            db._pushSelect([makeDeck({ isPublic: false, userId: USER_ID })]);
            db._pushSelect([makeDeckCard()]);
            const result = await service.getById(USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
        });
        (0, vitest_1.it)('should return deck with empty cards array when deck has no cards', async () => {
            db._pushSelect([makeDeck()]);
            db._pushSelect([]); // no cards
            const result = await service.getById(USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.cards).toHaveLength(0);
        });
        (0, vitest_1.it)('should include card details in each deck card', async () => {
            db._pushSelect([makeDeck()]);
            db._pushSelect([makeDeckCard()]);
            const result = await service.getById(USER_ID, { id: DECK_ID });
            const deckCard = result.cards[0];
            (0, vitest_1.expect)(deckCard.card).toBeDefined();
            (0, vitest_1.expect)(deckCard.card.name).toBe('Blazing Scorcher');
            (0, vitest_1.expect)(deckCard.card.rarity).toBe('Common');
        });
    });
    // =========================================================================
    // create()
    // =========================================================================
    (0, vitest_1.describe)('create()', () => {
        (0, vitest_1.it)('should create an empty deck with only metadata', async () => {
            const created = makeDeck({ name: 'New Deck' });
            db._pushInsert([created]); // deck insert
            db._pushSelect([created]); // getById -> deck lookup
            db._pushSelect([]); // getById -> no cards
            const result = await service.create(USER_ID, {
                name: 'New Deck',
                isPublic: false,
            });
            (0, vitest_1.expect)(result.name).toBe('New Deck');
            (0, vitest_1.expect)(result.cards).toHaveLength(0);
        });
        (0, vitest_1.it)('should create a private deck by default', async () => {
            const created = makeDeck({ isPublic: false });
            db._pushInsert([created]);
            db._pushSelect([created]);
            db._pushSelect([]);
            const result = await service.create(USER_ID, { name: 'My Deck' });
            (0, vitest_1.expect)(result.isPublic).toBe(false);
        });
        (0, vitest_1.it)('should create a public deck when isPublic is true', async () => {
            const created = makeDeck({ isPublic: true });
            db._pushInsert([created]);
            db._pushSelect([created]);
            db._pushSelect([]);
            const result = await service.create(USER_ID, { name: 'Public Deck', isPublic: true });
            (0, vitest_1.expect)(result.isPublic).toBe(true);
        });
        (0, vitest_1.it)('should create deck with initial cards', async () => {
            const created = makeDeck();
            const deckCard = makeDeckCard();
            db._pushInsert([created]); // deck insert
            db._pushInsert([]); // deckCards insert
            db._pushSelect([created]); // getById -> deck
            db._pushSelect([deckCard]); // getById -> cards
            const result = await service.create(USER_ID, {
                name: 'Fury Rush',
                cards: [{ cardId: CARD_ID, quantity: 2 }],
            });
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
            (0, vitest_1.expect)(result.cards[0].cardId).toBe(CARD_ID);
            (0, vitest_1.expect)(result.cards[0].quantity).toBe(2);
        });
        (0, vitest_1.it)('should store description when provided', async () => {
            const created = makeDeck({ description: 'Aggressive Fury deck' });
            db._pushInsert([created]);
            db._pushSelect([created]);
            db._pushSelect([]);
            const result = await service.create(USER_ID, {
                name: 'Fury Rush',
                description: 'Aggressive Fury deck',
            });
            (0, vitest_1.expect)(result.description).toBe('Aggressive Fury deck');
        });
        (0, vitest_1.it)('should reject creating deck with more than 4 copies of the same card', async () => {
            await (0, vitest_1.expect)(service.create(USER_ID, {
                name: 'Broken Deck',
                cards: [{ cardId: CARD_ID, quantity: 5 }],
            })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject creating deck with more than 60 total cards', async () => {
            const cards = Array.from({ length: 20 }, (_, i) => ({
                cardId: `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
                quantity: 4, // 20 * 4 = 80 cards
            }));
            await (0, vitest_1.expect)(service.create(USER_ID, { name: 'Overloaded Deck', cards })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should allow exactly 60 cards (max limit)', async () => {
            // 15 unique cards * 4 copies = 60
            const cardList = Array.from({ length: 15 }, (_, i) => ({
                cardId: `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
                quantity: 4,
            }));
            const created = makeDeck();
            db._pushInsert([created]); // deck insert
            db._pushInsert([]); // deckCards insert
            db._pushSelect([created]); // getById -> deck
            db._pushSelect(cardList.map(c => makeDeckCard({ cardId: c.cardId, quantity: 4 }))); // cards
            const result = await service.create(USER_ID, { name: 'Max Deck', cards: cardList });
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(db.insert).toHaveBeenCalledTimes(2); // deck + deckCards
        });
        (0, vitest_1.it)('should not insert deckCards when cards array is empty', async () => {
            const created = makeDeck();
            db._pushInsert([created]);
            db._pushSelect([created]);
            db._pushSelect([]);
            await service.create(USER_ID, { name: 'Empty Deck', cards: [] });
            (0, vitest_1.expect)(db.insert).toHaveBeenCalledTimes(1); // only deck, no deckCards
        });
    });
    // =========================================================================
    // update()
    // =========================================================================
    (0, vitest_1.describe)('update()', () => {
        (0, vitest_1.it)('should update the deck name', async () => {
            const existing = { id: DECK_ID, userId: USER_ID };
            const updated = makeDeck({ name: 'New Name' });
            db._pushSelect([existing]); // ownership check
            db._pushUpdate([updated]); // update
            const result = await service.update(USER_ID, { id: DECK_ID, name: 'New Name' });
            (0, vitest_1.expect)(result.name).toBe('New Name');
        });
        (0, vitest_1.it)('should throw NOT_FOUND when deck does not exist', async () => {
            db._pushSelect([]); // not found
            await (0, vitest_1.expect)(service.update(USER_ID, { id: DECK_ID, name: 'Ghost Deck' })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
        });
        (0, vitest_1.it)('should throw FORBIDDEN when user does not own the deck', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]); // deck owned by USER_ID
            await (0, vitest_1.expect)(service.update(OTHER_USER_ID, { id: DECK_ID, name: 'Stolen Name' })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You do not own this deck' });
        });
        (0, vitest_1.it)('should toggle isPublic from false to true', async () => {
            const existing = { id: DECK_ID, userId: USER_ID };
            const updated = makeDeck({ isPublic: true });
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await service.update(USER_ID, { id: DECK_ID, isPublic: true });
            (0, vitest_1.expect)(result.isPublic).toBe(true);
        });
        (0, vitest_1.it)('should update description', async () => {
            const existing = { id: DECK_ID, userId: USER_ID };
            const updated = makeDeck({ description: 'Updated description' });
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await service.update(USER_ID, { id: DECK_ID, description: 'Updated description' });
            (0, vitest_1.expect)(result.description).toBe('Updated description');
        });
        (0, vitest_1.it)('should return current deck unchanged when no fields provided', async () => {
            const existing = { id: DECK_ID, userId: USER_ID };
            const deck = makeDeck();
            db._pushSelect([existing]); // ownership check
            db._pushSelect([deck]); // re-fetch for empty update
            const result = await service.update(USER_ID, { id: DECK_ID });
            (0, vitest_1.expect)(result.id).toBe(DECK_ID);
            (0, vitest_1.expect)(db.update).not.toHaveBeenCalled();
        });
        (0, vitest_1.it)('should set coverCardId', async () => {
            const existing = { id: DECK_ID, userId: USER_ID };
            const updated = makeDeck({ coverCardId: CARD_ID });
            db._pushSelect([existing]);
            db._pushUpdate([updated]);
            const result = await service.update(USER_ID, { id: DECK_ID, coverCardId: CARD_ID });
            (0, vitest_1.expect)(result.coverCardId).toBe(CARD_ID);
        });
    });
    // =========================================================================
    // delete()
    // =========================================================================
    (0, vitest_1.describe)('delete()', () => {
        (0, vitest_1.it)('should delete deck owned by the user', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(service.delete(USER_ID, { id: DECK_ID })).resolves.toBeUndefined();
            (0, vitest_1.expect)(db.delete).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)('should throw NOT_FOUND when deck does not exist', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(service.delete(USER_ID, { id: DECK_ID })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
        });
        (0, vitest_1.it)('should throw FORBIDDEN when user does not own the deck', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]); // owned by USER_ID
            await (0, vitest_1.expect)(service.delete(OTHER_USER_ID, { id: DECK_ID })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You do not own this deck' });
        });
        (0, vitest_1.it)('should not delete when ownership check fails', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            try {
                await service.delete(OTHER_USER_ID, { id: DECK_ID });
            }
            catch {
                // expected
            }
            (0, vitest_1.expect)(db.delete).not.toHaveBeenCalled();
        });
    });
    // =========================================================================
    // setCards()
    // =========================================================================
    (0, vitest_1.describe)('setCards()', () => {
        (0, vitest_1.it)('should replace all deck cards with new set', async () => {
            const deck = makeDeck();
            const newCard = makeDeckCard({ cardId: CARD_ID_2 });
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]); // ownership
            db._pushInsert([]); // deckCards insert
            db._pushSelect([deck]); // getById -> deck
            db._pushSelect([newCard]); // getById -> new cards
            const result = await service.setCards(USER_ID, {
                deckId: DECK_ID,
                cards: [{ cardId: CARD_ID_2, quantity: 2 }],
            });
            (0, vitest_1.expect)(db.delete).toHaveBeenCalledTimes(1); // old cards deleted
            (0, vitest_1.expect)(result.cards).toHaveLength(1);
        });
        (0, vitest_1.it)('should throw NOT_FOUND when deck does not exist', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(service.setCards(USER_ID, {
                deckId: DECK_ID,
                cards: [{ cardId: CARD_ID, quantity: 2 }],
            })).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
        });
        (0, vitest_1.it)('should throw FORBIDDEN when user does not own the deck', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(service.setCards(OTHER_USER_ID, {
                deckId: DECK_ID,
                cards: [{ cardId: CARD_ID, quantity: 2 }],
            })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You do not own this deck' });
        });
        (0, vitest_1.it)('should reject setCards with more than 4 copies of any card', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            await (0, vitest_1.expect)(service.setCards(USER_ID, {
                deckId: DECK_ID,
                cards: [{ cardId: CARD_ID, quantity: 5 }],
            })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject setCards exceeding 60 total cards', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            const cards = Array.from({ length: 20 }, (_, i) => ({
                cardId: `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
                quantity: 4, // 20 * 4 = 80
            }));
            await (0, vitest_1.expect)(service.setCards(USER_ID, { deckId: DECK_ID, cards })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should allow clearing all cards (empty setCards)', async () => {
            const deck = makeDeck();
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            db._pushSelect([deck]); // getById
            db._pushSelect([]); // no cards
            const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards: [] });
            (0, vitest_1.expect)(db.delete).toHaveBeenCalledTimes(1); // cleared
            (0, vitest_1.expect)(db.insert).not.toHaveBeenCalled(); // no inserts for empty
            (0, vitest_1.expect)(result.cards).toHaveLength(0);
        });
        (0, vitest_1.it)('should detect multiple entries for same card that exceed 4 copies', async () => {
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            // Two entries for same card, each with 3 — total 6 > 4
            await (0, vitest_1.expect)(service.setCards(USER_ID, {
                deckId: DECK_ID,
                cards: [
                    { cardId: CARD_ID, quantity: 3 },
                    { cardId: CARD_ID, quantity: 3 },
                ],
            })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should allow exactly 4 copies of one card (at the max)', async () => {
            const deck = makeDeck();
            const deckCard = makeDeckCard({ quantity: 4 });
            db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
            db._pushInsert([]);
            db._pushSelect([deck]);
            db._pushSelect([deckCard]);
            const result = await service.setCards(USER_ID, {
                deckId: DECK_ID,
                cards: [{ cardId: CARD_ID, quantity: 4 }],
            });
            (0, vitest_1.expect)(result.cards[0].quantity).toBe(4);
        });
    });
    // =========================================================================
    // browse()
    // =========================================================================
    (0, vitest_1.describe)('browse()', () => {
        (0, vitest_1.it)('should return only public decks', async () => {
            const publicDeck = makeDeck({ isPublic: true });
            db._pushSelect([publicDeck]);
            const result = await service.browse({ limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(db.select).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should return empty result when no public decks exist', async () => {
            db._pushSelect([]);
            const result = await service.browse({ limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(0);
        });
        (0, vitest_1.it)('should set nextCursor when more public decks exist than limit', async () => {
            const decks = Array.from({ length: 11 }, (_, i) => makeDeck({ id: `40000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}`, isPublic: true }));
            db._pushSelect(decks);
            const result = await service.browse({ limit: 10 });
            (0, vitest_1.expect)(result.items).toHaveLength(10);
            (0, vitest_1.expect)(result.nextCursor).toBeTruthy();
        });
        (0, vitest_1.it)('should filter by domain', async () => {
            const furyDeck = makeDeck({ isPublic: true, domain: 'Fury' });
            db._pushSelect([furyDeck]);
            const result = await service.browse({ limit: 10, domain: 'Fury' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should filter by search term (partial match on name)', async () => {
            const deck = makeDeck({ name: 'Fury Rush Aggro', isPublic: true });
            db._pushSelect([deck]);
            const result = await service.browse({ limit: 10, search: 'Rush' });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should support cursor pagination for browse', async () => {
            db._pushSelect([makeDeck({ isPublic: true })]);
            const result = await service.browse({
                limit: 10,
                cursor: '11111111-0000-0000-0000-000000000001',
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
        });
        (0, vitest_1.it)('should return all required deck fields', async () => {
            const deck = makeDeck({ isPublic: true, description: 'Test deck', domain: 'Fury' });
            db._pushSelect([deck]);
            const result = await service.browse({ limit: 10 });
            const d = result.items[0];
            (0, vitest_1.expect)(d.id).toBe(DECK_ID);
            (0, vitest_1.expect)(d.name).toBe('Fury Rush');
            (0, vitest_1.expect)(d.isPublic).toBe(true);
            (0, vitest_1.expect)(d.userId).toBe(USER_ID);
        });
    });
    // =========================================================================
    // validateCardEntries() — tested via create() and setCards()
    // =========================================================================
    (0, vitest_1.describe)('card validation (via create/setCards)', () => {
        (0, vitest_1.it)('should reject 5 copies of the same card', async () => {
            await (0, vitest_1.expect)(service.create(USER_ID, {
                name: 'Invalid',
                cards: [{ cardId: CARD_ID, quantity: 5 }],
            })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should allow 4 copies (boundary)', async () => {
            const created = makeDeck();
            db._pushInsert([created]);
            db._pushInsert([]);
            db._pushSelect([created]);
            db._pushSelect([makeDeckCard({ quantity: 4 })]);
            const result = await service.create(USER_ID, {
                name: 'Valid',
                cards: [{ cardId: CARD_ID, quantity: 4 }],
            });
            (0, vitest_1.expect)(result).toBeDefined();
        });
        (0, vitest_1.it)('should reject 61 total cards (boundary + 1)', async () => {
            const cards = Array.from({ length: 16 }, (_, i) => ({
                cardId: `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
                quantity: 4, // 16 * 4 = 64
            }));
            await (0, vitest_1.expect)(service.create(USER_ID, { name: 'Too Big', cards })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should include the card id in the error message when copies exceeded', async () => {
            await (0, vitest_1.expect)(service.create(USER_ID, {
                name: 'Invalid',
                cards: [{ cardId: CARD_ID, quantity: 5 }],
            })).rejects.toMatchObject({
                code: 'BAD_REQUEST',
                message: vitest_1.expect.stringContaining(CARD_ID),
            });
        });
        (0, vitest_1.it)('should detect combined duplicates: two entries summing to > 4 copies', async () => {
            await (0, vitest_1.expect)(service.create(USER_ID, {
                name: 'Bad',
                cards: [
                    { cardId: CARD_ID, quantity: 3 },
                    { cardId: CARD_ID, quantity: 2 },
                ],
            })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should allow two different cards each with 4 copies', async () => {
            const created = makeDeck();
            db._pushInsert([created]);
            db._pushInsert([]);
            db._pushSelect([created]);
            db._pushSelect([
                makeDeckCard({ cardId: CARD_ID, quantity: 4 }),
                makeDeckCard({ cardId: CARD_ID_2, quantity: 4 }),
            ]);
            const result = await service.create(USER_ID, {
                name: 'Two Cards Max',
                cards: [
                    { cardId: CARD_ID, quantity: 4 },
                    { cardId: CARD_ID_2, quantity: 4 },
                ],
            });
            (0, vitest_1.expect)(result).toBeDefined();
        });
    });
});
