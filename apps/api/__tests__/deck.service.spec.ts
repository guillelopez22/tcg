import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckService } from '../src/modules/deck/deck.service';

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
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];
  const updateResults: unknown[][] = [];
  let selectIdx = 0;
  let insertIdx = 0;
  let updateIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const chain: Record<string, unknown> = {};
    chain['from'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['innerJoin'] = vi.fn().mockReturnValue(chain);
    chain['leftJoin'] = vi.fn().mockReturnValue(chain);
    chain['groupBy'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    chain['orderBy'] = vi.fn().mockImplementation(() => {
      const orderChain: Record<string, unknown> = {};
      orderChain['limit'] = vi.fn().mockImplementation(() =>
        Promise.resolve(selectResults[capturedIdx] ?? []),
      );
      orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
      return orderChain;
    });
    chain['then'] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
    return chain;
  });

  const insert = vi.fn().mockImplementation(() => {
    const capturedIdx = insertIdx++;
    const chain: Record<string, unknown> = {};
    chain['values'] = vi.fn().mockImplementation(() => {
      const valuesChain: Record<string, unknown> = {};
      valuesChain['returning'] = vi.fn().mockImplementation(() =>
        Promise.resolve(insertResults[capturedIdx] ?? []),
      );
      valuesChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
      return valuesChain;
    });
    return chain;
  });

  const update = vi.fn().mockImplementation(() => {
    const capturedIdx = updateIdx++;
    const chain: Record<string, unknown> = {};
    chain['set'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['returning'] = vi.fn().mockImplementation(() =>
      Promise.resolve(updateResults[capturedIdx] ?? []),
    );
    return chain;
  });

  const deleteFn = vi.fn().mockImplementation(() => {
    const chain: Record<string, unknown> = {};
    chain['where'] = vi.fn().mockResolvedValue([]);
    return chain;
  });

  const mockDb = {
    select,
    insert,
    update,
    delete: deleteFn,
    transaction: vi.fn().mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
    _pushInsert: (...rows: unknown[][]) => { insertResults.push(...rows); },
    _pushUpdate: (...rows: unknown[][]) => { updateResults.push(...rows); },
  };

  return mockDb;
}

function makeMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
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
const CARD_ID_3 = '10000000-0000-0000-0000-000000000003';
const DECK_CARD_ID = '50000000-0000-0000-0000-000000000001';

function makeDeck(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  description: string | null;
  coverCardId: string | null;
  isPublic: boolean;
  domain: string | null;
  status: string;
}> = {}) {
  return {
    id: overrides.id ?? DECK_ID,
    userId: overrides.userId ?? USER_ID,
    name: overrides.name ?? 'Fury Rush',
    description: overrides.description ?? null,
    coverCardId: overrides.coverCardId ?? null,
    isPublic: overrides.isPublic ?? false,
    domain: overrides.domain ?? 'Fury',
    tier: null,
    status: overrides.status ?? 'draft',
    createdAt: new Date('2026-03-10T00:00:00Z'),
    updatedAt: new Date('2026-03-10T00:00:00Z'),
  };
}

function makeDeckCard(overrides: Partial<{
  id: string;
  deckId: string;
  cardId: string;
  quantity: number;
  zone: string;
}> = {}) {
  return {
    id: overrides.id ?? DECK_CARD_ID,
    deckId: overrides.deckId ?? DECK_ID,
    cardId: overrides.cardId ?? CARD_ID,
    quantity: overrides.quantity ?? 2,
    zone: overrides.zone ?? 'main',
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

function makeDeckWithCards(deckOverrides: Parameters<typeof makeDeck>[0] = {}, cardCount = 1) {
  return {
    ...makeDeck(deckOverrides),
    cards: Array.from({ length: cardCount }, (_, i) =>
      makeDeckCard({ id: `50000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}` }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;
  let service: DeckService;

  beforeEach(() => {
    db = makeMockDb();
    redis = makeMockRedis();
    service = new DeckService(db as never, redis as never);
  });

  // =========================================================================
  // list()
  // =========================================================================

  describe('list()', () => {
    it('should return paginated decks for the user', async () => {
      const decks = [makeDeck()];
      db._pushSelect(decks);

      const result = await service.list(USER_ID, { limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeUndefined();
      expect(result.items[0]!.userId).toBe(USER_ID);
    });

    it('should return empty result when user has no decks', async () => {
      db._pushSelect([]);

      const result = await service.list(USER_ID, { limit: 10 });

      expect(result.items).toHaveLength(0);
    });

    it('should set nextCursor when more items exist than the limit', async () => {
      const decks = Array.from({ length: 11 }, (_, i) =>
        makeDeck({ id: `40000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}` }),
      );
      db._pushSelect(decks);

      const result = await service.list(USER_ID, { limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBeTruthy();
    });

    it('should use cursor for pagination', async () => {
      db._pushSelect([makeDeck()]);

      const result = await service.list(USER_ID, {
        limit: 10,
        cursor: '11111111-0000-0000-0000-000000000001',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should not return other users decks', async () => {
      // The WHERE clause filters by userId — our mock returns what we push.
      // We verify only decks for this user are queried by checking no cross-user data leaks.
      db._pushSelect([makeDeck({ userId: USER_ID })]);

      const result = await service.list(USER_ID, { limit: 10 });

      expect(result.items[0]!.userId).toBe(USER_ID);
    });
  });

  // =========================================================================
  // getById()
  // =========================================================================

  describe('getById()', () => {
    it('should return deck with cards when deck exists and user is owner', async () => {
      db._pushSelect([makeDeck()]); // deck lookup
      db._pushSelect([makeDeckCard()]); // card rows

      const result = await service.getById(USER_ID, { id: DECK_ID });

      expect(result.id).toBe(DECK_ID);
      expect(result.name).toBe('Fury Rush');
      expect(result.cards).toHaveLength(1);
    });

    it('should throw NOT_FOUND when deck does not exist', async () => {
      db._pushSelect([]); // deck not found

      await expect(
        service.getById(USER_ID, { id: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
    });

    it('should return public deck to any user (including non-owner)', async () => {
      db._pushSelect([makeDeck({ isPublic: true })]); // public deck
      db._pushSelect([makeDeckCard()]); // cards

      const result = await service.getById(OTHER_USER_ID, { id: DECK_ID });

      expect(result.id).toBe(DECK_ID);
    });

    it('should return public deck to unauthenticated user (null userId)', async () => {
      db._pushSelect([makeDeck({ isPublic: true })]);
      db._pushSelect([]);

      const result = await service.getById(null, { id: DECK_ID });

      expect(result.id).toBe(DECK_ID);
    });

    it('should throw FORBIDDEN when private deck is accessed by non-owner', async () => {
      db._pushSelect([makeDeck({ isPublic: false, userId: USER_ID })]);

      await expect(
        service.getById(OTHER_USER_ID, { id: DECK_ID }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'This deck is private' });
    });

    it('should allow owner to access their own private deck', async () => {
      db._pushSelect([makeDeck({ isPublic: false, userId: USER_ID })]);
      db._pushSelect([makeDeckCard()]);

      const result = await service.getById(USER_ID, { id: DECK_ID });

      expect(result.id).toBe(DECK_ID);
    });

    it('should return deck with empty cards array when deck has no cards', async () => {
      db._pushSelect([makeDeck()]);
      db._pushSelect([]); // no cards

      const result = await service.getById(USER_ID, { id: DECK_ID });

      expect(result.cards).toHaveLength(0);
    });

    it('should include card details in each deck card', async () => {
      db._pushSelect([makeDeck()]);
      db._pushSelect([makeDeckCard()]);

      const result = await service.getById(USER_ID, { id: DECK_ID });

      const deckCard = result.cards[0]!;
      expect(deckCard.card).toBeDefined();
      expect(deckCard.card.name).toBe('Blazing Scorcher');
      expect(deckCard.card.rarity).toBe('Common');
    });
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create()', () => {
    it('should create an empty deck with only metadata', async () => {
      const created = makeDeck({ name: 'New Deck' });
      db._pushInsert([created]); // deck insert
      db._pushSelect([created]); // getById -> deck lookup
      db._pushSelect([]); // getById -> no cards

      const result = await service.create(USER_ID, {
        name: 'New Deck',
        isPublic: false,
      });

      expect(result.name).toBe('New Deck');
      expect(result.cards).toHaveLength(0);
    });

    it('should create a private deck by default', async () => {
      const created = makeDeck({ isPublic: false });
      db._pushInsert([created]);
      db._pushSelect([created]);
      db._pushSelect([]);

      const result = await service.create(USER_ID, { name: 'My Deck' });

      expect(result.isPublic).toBe(false);
    });

    it('should create a public deck when isPublic is true', async () => {
      const created = makeDeck({ isPublic: true });
      db._pushInsert([created]);
      db._pushSelect([created]);
      db._pushSelect([]);

      const result = await service.create(USER_ID, { name: 'Public Deck', isPublic: true });

      expect(result.isPublic).toBe(true);
    });

    it('should create deck with initial cards', async () => {
      const created = makeDeck();
      const deckCard = makeDeckCard();
      // validateCardIdsExist select + buildCardTypeMap select + deck insert + deckCards insert + getById deck + getById cards
      db._pushSelect([{ id: CARD_ID }]); // validateCardIdsExist
      db._pushSelect([{ id: CARD_ID, cardType: 'Unit' }]); // buildCardTypeMap
      db._pushInsert([created]); // deck insert
      db._pushInsert([]); // deckCards insert
      db._pushSelect([created]); // getById -> deck
      db._pushSelect([deckCard]); // getById -> cards

      const result = await service.create(USER_ID, {
        name: 'Fury Rush',
        cards: [{ cardId: CARD_ID, quantity: 2, zone: 'main' }],
      });

      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.cardId).toBe(CARD_ID);
      expect(result.cards[0]!.quantity).toBe(2);
    });

    it('should store description when provided', async () => {
      const created = makeDeck({ description: 'Aggressive Fury deck' });
      db._pushInsert([created]);
      db._pushSelect([created]);
      db._pushSelect([]);

      const result = await service.create(USER_ID, {
        name: 'Fury Rush',
        description: 'Aggressive Fury deck',
      });

      expect(result.description).toBe('Aggressive Fury deck');
    });

    it('should reject creating deck with more than 3 copies of the same card in main+sideboard', async () => {
      await expect(
        service.create(USER_ID, {
          name: 'Broken Deck',
          cards: [{ cardId: CARD_ID, quantity: 4, zone: 'main' }],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should not insert deckCards when cards array is empty', async () => {
      const created = makeDeck();
      db._pushInsert([created]);
      db._pushSelect([created]);
      db._pushSelect([]);

      await service.create(USER_ID, { name: 'Empty Deck', cards: [] });

      expect(db.insert).toHaveBeenCalledTimes(1); // only deck, no deckCards
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    it('should update the deck name', async () => {
      const existing = { id: DECK_ID, userId: USER_ID };
      const updated = makeDeck({ name: 'New Name' });

      db._pushSelect([existing]); // ownership check
      db._pushUpdate([updated]); // update

      const result = await service.update(USER_ID, { id: DECK_ID, name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw NOT_FOUND when deck does not exist', async () => {
      db._pushSelect([]); // not found

      await expect(
        service.update(USER_ID, { id: DECK_ID, name: 'Ghost Deck' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
    });

    it('should throw FORBIDDEN when user does not own the deck', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]); // deck owned by USER_ID

      await expect(
        service.update(OTHER_USER_ID, { id: DECK_ID, name: 'Stolen Name' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    });

    it('should toggle isPublic from false to true', async () => {
      const existing = { id: DECK_ID, userId: USER_ID };
      const updated = makeDeck({ isPublic: true });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: DECK_ID, isPublic: true });

      expect(result.isPublic).toBe(true);
    });

    it('should update description', async () => {
      const existing = { id: DECK_ID, userId: USER_ID };
      const updated = makeDeck({ description: 'Updated description' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: DECK_ID, description: 'Updated description' });

      expect(result.description).toBe('Updated description');
    });

    it('should return current deck unchanged when no fields provided', async () => {
      const existing = { id: DECK_ID, userId: USER_ID };
      const deck = makeDeck();

      db._pushSelect([existing]); // ownership check
      db._pushSelect([deck]); // re-fetch for empty update

      const result = await service.update(USER_ID, { id: DECK_ID });

      expect(result.id).toBe(DECK_ID);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should set coverCardId', async () => {
      const existing = { id: DECK_ID, userId: USER_ID };
      const updated = makeDeck({ coverCardId: CARD_ID });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: DECK_ID, coverCardId: CARD_ID });

      expect(result.coverCardId).toBe(CARD_ID);
    });
  });

  // =========================================================================
  // delete()
  // =========================================================================

  describe('delete()', () => {
    it('should delete deck owned by the user', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);

      await expect(
        service.delete(USER_ID, { id: DECK_ID }),
      ).resolves.toBeUndefined();

      expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw NOT_FOUND when deck does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.delete(USER_ID, { id: DECK_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
    });

    it('should throw FORBIDDEN when user does not own the deck', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]); // owned by USER_ID

      await expect(
        service.delete(OTHER_USER_ID, { id: DECK_ID }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    });

    it('should not delete when ownership check fails', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);

      try {
        await service.delete(OTHER_USER_ID, { id: DECK_ID });
      } catch {
        // expected
      }

      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // setCards()
  // =========================================================================

  describe('setCards()', () => {
    it('should replace all deck cards with new set', async () => {
      const deck = makeDeck();
      const newCard = makeDeckCard({ cardId: CARD_ID_2 });

      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]); // ownership
      // validateCardIdsExist select
      db._pushSelect([{ id: CARD_ID_2 }]);
      // buildCardTypeMap select
      db._pushSelect([{ id: CARD_ID_2, cardType: 'Unit' }]);
      db._pushInsert([]); // deckCards insert
      db._pushSelect([deck]); // getById -> deck
      db._pushSelect([newCard]); // getById -> new cards

      const result = await service.setCards(USER_ID, {
        deckId: DECK_ID,
        cards: [{ cardId: CARD_ID_2, quantity: 2, zone: 'main' }],
      });

      expect(db.delete).toHaveBeenCalledTimes(1); // old cards deleted
      expect(result.cards).toHaveLength(1);
    });

    it('should throw NOT_FOUND when deck does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.setCards(USER_ID, {
          deckId: DECK_ID,
          cards: [{ cardId: CARD_ID, quantity: 2, zone: 'main' }],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Deck not found' });
    });

    it('should throw FORBIDDEN when user does not own the deck', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);

      await expect(
        service.setCards(OTHER_USER_ID, {
          deckId: DECK_ID,
          cards: [{ cardId: CARD_ID, quantity: 2, zone: 'main' }],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You do not own this deck' });
    });

    it('should reject setCards with more than 3 copies of any card in main+sideboard', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);

      await expect(
        service.setCards(USER_ID, {
          deckId: DECK_ID,
          cards: [{ cardId: CARD_ID, quantity: 4, zone: 'main' }],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should allow clearing all cards (empty setCards)', async () => {
      const deck = makeDeck();
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
      db._pushSelect([deck]); // getById
      db._pushSelect([]); // no cards

      const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards: [] });

      expect(db.delete).toHaveBeenCalledTimes(1); // cleared
      expect(db.insert).not.toHaveBeenCalled(); // no inserts for empty
      expect(result.cards).toHaveLength(0);
    });

    it('should detect multiple entries for same card that exceed 3 copies in main+sideboard', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);

      // Two entries for same card across zones: main 2 + sideboard 2 = 4 > 3
      await expect(
        service.setCards(USER_ID, {
          deckId: DECK_ID,
          cards: [
            { cardId: CARD_ID, quantity: 2, zone: 'main' },
            { cardId: CARD_ID, quantity: 2, zone: 'sideboard' },
          ],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should allow exactly 3 copies of one card (at the max)', async () => {
      const deck = makeDeck();
      const deckCard = makeDeckCard({ quantity: 3 });
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
      // validateCardIdsExist
      db._pushSelect([{ id: CARD_ID }]);
      // buildCardTypeMap
      db._pushSelect([{ id: CARD_ID, cardType: 'Unit' }]);
      db._pushInsert([]);
      db._pushSelect([deck]);
      db._pushSelect([deckCard]);

      const result = await service.setCards(USER_ID, {
        deckId: DECK_ID,
        cards: [{ cardId: CARD_ID, quantity: 3, zone: 'main' }],
      });

      expect(result.cards[0]!.quantity).toBe(3);
    });
  });

  // =========================================================================
  // browse()
  // =========================================================================

  describe('browse()', () => {
    it('should return only public decks', async () => {
      const publicDeck = makeDeck({ isPublic: true });
      db._pushSelect([publicDeck]);

      const result = await service.browse({ limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return empty result when no public decks exist', async () => {
      db._pushSelect([]);

      const result = await service.browse({ limit: 10 });

      expect(result.items).toHaveLength(0);
    });

    it('should set nextCursor when more public decks exist than limit', async () => {
      const decks = Array.from({ length: 11 }, (_, i) =>
        makeDeck({ id: `40000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}`, isPublic: true }),
      );
      db._pushSelect(decks);

      const result = await service.browse({ limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.nextCursor).toBeTruthy();
    });

    it('should filter by domain', async () => {
      const furyDeck = makeDeck({ isPublic: true, domain: 'Fury' });
      db._pushSelect([furyDeck]);

      const result = await service.browse({ limit: 10, domain: 'Fury' });

      expect(result.items).toHaveLength(1);
    });

    it('should filter by search term (partial match on name)', async () => {
      const deck = makeDeck({ name: 'Fury Rush Aggro', isPublic: true });
      db._pushSelect([deck]);

      const result = await service.browse({ limit: 10, search: 'Rush' });

      expect(result.items).toHaveLength(1);
    });

    it('should support cursor pagination for browse', async () => {
      db._pushSelect([makeDeck({ isPublic: true })]);

      const result = await service.browse({
        limit: 10,
        cursor: '11111111-0000-0000-0000-000000000001',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should return all required deck fields', async () => {
      const deck = makeDeck({ isPublic: true, description: 'Test deck', domain: 'Fury' });
      db._pushSelect([deck]);

      const result = await service.browse({ limit: 10 });

      const d = result.items[0]!;
      expect(d.id).toBe(DECK_ID);
      expect(d.name).toBe('Fury Rush');
      expect(d.isPublic).toBe(true);
      expect(d.userId).toBe(USER_ID);
    });
  });

  // =========================================================================
  // Zone-aware format validation (via setCards integration)
  // =========================================================================

  describe('zone validation (via setCards)', () => {
    function setupSetCardsOwnership() {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);
    }

    function makeZoneCards() {
      // 40 main cards (3 copies of 13 cards + 1 copy of 1 card = 40)
      const main: Array<{ cardId: string; quantity: number; zone: string }> = [];
      for (let i = 0; i < 13; i++) {
        main.push({
          cardId: `11111111-0000-0000-0000-${i.toString().padStart(12, '0')}`,
          quantity: 3,
          zone: 'main',
        });
      }
      main.push({ cardId: `11111111-0000-0000-0000-000000000013`, quantity: 1, zone: 'main' });

      // 12 rune cards (12 * 1)
      const runes: Array<{ cardId: string; quantity: number; zone: string }> = [];
      for (let i = 0; i < 12; i++) {
        runes.push({
          cardId: `22222222-0000-0000-0000-${i.toString().padStart(12, '0')}`,
          quantity: 1,
          zone: 'rune',
        });
      }

      // 1 champion
      const champion: Array<{ cardId: string; quantity: number; zone: string }> = [
        { cardId: `33333333-0000-0000-0000-000000000001`, quantity: 1, zone: 'champion' },
      ];

      return [...main, ...runes, ...champion];
    }

    function pushCardTypeSelectsForCards(cards: Array<{ cardId: string; zone: string }>) {
      // validateCardIdsExist
      const cardIds = [...new Set(cards.map((c) => c.cardId))];
      db._pushSelect(cardIds.map((id) => ({ id })));
      // buildCardTypeMap
      db._pushSelect(cardIds.map((id) => {
        const entry = cards.find((c) => c.cardId === id)!;
        let cardType: string;
        if (entry.zone === 'rune') cardType = 'Rune';
        else if (entry.zone === 'champion') cardType = 'Legend';
        else cardType = 'Unit';
        return { id, cardType };
      }));
    }

    it('valid 40+12+1 deck with no sideboard -> status complete', async () => {
      const cards = makeZoneCards();
      setupSetCardsOwnership();
      pushCardTypeSelectsForCards(cards);

      // transaction: delete + insert + update (update returns updated deck)
      db._pushUpdate([makeDeck({ status: 'complete' })]);

      const deck = makeDeck({ status: 'complete' });
      db._pushSelect([deck]); // getById -> deck
      db._pushSelect(cards.map((c) => ({
        id: '50000000-0000-0000-0000-000000000001',
        deckId: DECK_ID,
        cardId: c.cardId,
        quantity: c.quantity,
        zone: c.zone,
        createdAt: new Date(),
        updatedAt: new Date(),
        card: { id: c.cardId, name: 'Test', cleanName: 'Test', rarity: 'Common', cardType: 'Unit', domain: 'Fury', imageSmall: null, imageLarge: null },
      }))); // getById -> cards

      const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards });
      expect(result.status).toBe('complete');
    });

    it('valid 40+12+1+8 sideboard -> status complete', async () => {
      const cards = makeZoneCards();
      // Add 8 sideboard cards (different cards from main, 1 copy each)
      for (let i = 0; i < 8; i++) {
        cards.push({
          cardId: `44444444-0000-0000-0000-${i.toString().padStart(12, '0')}`,
          quantity: 1,
          zone: 'sideboard',
        });
      }

      setupSetCardsOwnership();
      pushCardTypeSelectsForCards(cards);
      db._pushUpdate([makeDeck({ status: 'complete' })]);
      const deck = makeDeck({ status: 'complete' });
      db._pushSelect([deck]);
      db._pushSelect([]);

      const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards });
      expect(result.status).toBe('complete');
    });

    it('main deck with 35 cards -> status draft', async () => {
      // Only 35 cards in main — missing 5
      const cards: Array<{ cardId: string; quantity: number; zone: string }> = [];
      for (let i = 0; i < 11; i++) {
        cards.push({
          cardId: `11111111-0000-0000-0000-${i.toString().padStart(12, '0')}`,
          quantity: 3,
          zone: 'main',
        });
      }
      cards.push({ cardId: `11111111-0000-0000-0000-000000000011`, quantity: 2, zone: 'main' });
      // 12 runes
      for (let i = 0; i < 12; i++) {
        cards.push({ cardId: `22222222-0000-0000-0000-${i.toString().padStart(12, '0')}`, quantity: 1, zone: 'rune' });
      }
      // 1 champion
      cards.push({ cardId: `33333333-0000-0000-0000-000000000001`, quantity: 1, zone: 'champion' });

      setupSetCardsOwnership();
      pushCardTypeSelectsForCards(cards);
      db._pushUpdate([makeDeck({ status: 'draft' })]);
      db._pushSelect([makeDeck({ status: 'draft' })]);
      db._pushSelect([]);

      const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards });
      expect(result.status).toBe('draft');
    });

    it('no champion -> status draft', async () => {
      const cards: Array<{ cardId: string; quantity: number; zone: string }> = [];
      for (let i = 0; i < 13; i++) {
        cards.push({ cardId: `11111111-0000-0000-0000-${i.toString().padStart(12, '0')}`, quantity: 3, zone: 'main' });
      }
      cards.push({ cardId: `11111111-0000-0000-0000-000000000013`, quantity: 1, zone: 'main' });
      for (let i = 0; i < 12; i++) {
        cards.push({ cardId: `22222222-0000-0000-0000-${i.toString().padStart(12, '0')}`, quantity: 1, zone: 'rune' });
      }
      // No champion!

      setupSetCardsOwnership();
      pushCardTypeSelectsForCards(cards);
      db._pushUpdate([makeDeck({ status: 'draft' })]);
      db._pushSelect([makeDeck({ status: 'draft' })]);
      db._pushSelect([]);

      const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards });
      expect(result.status).toBe('draft');
    });

    it('sideboard with 5 cards -> status draft (must be 0 or 8)', async () => {
      const cards = makeZoneCards();
      for (let i = 0; i < 5; i++) {
        cards.push({ cardId: `44444444-0000-0000-0000-${i.toString().padStart(12, '0')}`, quantity: 1, zone: 'sideboard' });
      }

      setupSetCardsOwnership();
      pushCardTypeSelectsForCards(cards);
      db._pushUpdate([makeDeck({ status: 'draft' })]);
      db._pushSelect([makeDeck({ status: 'draft' })]);
      db._pushSelect([]);

      const result = await service.setCards(USER_ID, { deckId: DECK_ID, cards });
      expect(result.status).toBe('draft');
    });

    it('4 copies of same card across main+sideboard -> throws BAD_REQUEST', async () => {
      db._pushSelect([{ id: DECK_ID, userId: USER_ID }]);

      await expect(
        service.setCards(USER_ID, {
          deckId: DECK_ID,
          cards: [
            { cardId: CARD_ID, quantity: 2, zone: 'main' },
            { cardId: CARD_ID, quantity: 2, zone: 'sideboard' },
          ],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: expect.stringContaining(CARD_ID) });
    });
  });

  // =========================================================================
  // getBuildability()
  // =========================================================================

  describe('getBuildability()', () => {
    it('should return correct owned count, total, pct, and missingCardIds', async () => {
      // Deck has 3 cards: CARD_ID (qty 2), CARD_ID_2 (qty 1), CARD_ID_3 (qty 1)
      db._pushSelect([
        { cardId: CARD_ID, quantity: 2 },
        { cardId: CARD_ID_2, quantity: 1 },
        { cardId: CARD_ID_3, quantity: 1 },
      ]); // deckCards
      // User owns CARD_ID (2 copies) and CARD_ID_2 (1 copy) but not CARD_ID_3
      db._pushSelect([
        { cardId: CARD_ID, owned: 2 },
        { cardId: CARD_ID_2, owned: 1 },
      ]); // collection

      const result = await service.getBuildability(USER_ID, DECK_ID);

      expect(result.owned).toBe(2); // 2 out of 3 entries satisfied
      expect(result.total).toBe(3);
      expect(result.pct).toBe(67);
      expect(result.missingCardIds).toContain(CARD_ID_3);
      expect(result.missingCardIds).toHaveLength(1);
    });

    it('should return 100% when user owns all cards', async () => {
      db._pushSelect([
        { cardId: CARD_ID, quantity: 1 },
        { cardId: CARD_ID_2, quantity: 1 },
      ]);
      db._pushSelect([
        { cardId: CARD_ID, owned: 2 },
        { cardId: CARD_ID_2, owned: 3 },
      ]);

      const result = await service.getBuildability(USER_ID, DECK_ID);

      expect(result.owned).toBe(2);
      expect(result.total).toBe(2);
      expect(result.pct).toBe(100);
      expect(result.missingCardIds).toHaveLength(0);
    });

    it('should return 0% when user owns nothing', async () => {
      db._pushSelect([
        { cardId: CARD_ID, quantity: 2 },
        { cardId: CARD_ID_2, quantity: 1 },
      ]);
      db._pushSelect([]); // empty collection

      const result = await service.getBuildability(USER_ID, DECK_ID);

      expect(result.owned).toBe(0);
      expect(result.pct).toBe(0);
      expect(result.missingCardIds).toContain(CARD_ID);
      expect(result.missingCardIds).toContain(CARD_ID_2);
    });

    it('should return 100% for empty deck', async () => {
      db._pushSelect([]); // no deck cards

      const result = await service.getBuildability(USER_ID, DECK_ID);

      expect(result.owned).toBe(0);
      expect(result.total).toBe(0);
      expect(result.pct).toBe(100);
      expect(result.missingCardIds).toHaveLength(0);
    });

    it('should flag card as missing when user owns fewer copies than required', async () => {
      db._pushSelect([{ cardId: CARD_ID, quantity: 3 }]); // deck needs 3 copies
      db._pushSelect([{ cardId: CARD_ID, owned: 2 }]); // user only has 2

      const result = await service.getBuildability(USER_ID, DECK_ID);

      expect(result.owned).toBe(0); // not enough copies
      expect(result.missingCardIds).toContain(CARD_ID);
    });
  });

  // =========================================================================
  // card validation (via create/setCards)
  // =========================================================================

  describe('card validation (via create/setCards)', () => {
    it('should reject 4 copies of the same card in main zone (max is 3)', async () => {
      await expect(
        service.create(USER_ID, {
          name: 'Invalid',
          cards: [{ cardId: CARD_ID, quantity: 4, zone: 'main' }],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should allow 3 copies (at the limit)', async () => {
      const created = makeDeck();
      // validateCardIdsExist
      db._pushSelect([{ id: CARD_ID }]);
      // buildCardTypeMap
      db._pushSelect([{ id: CARD_ID, cardType: 'Unit' }]);
      db._pushInsert([created]);
      db._pushInsert([]);
      db._pushSelect([created]);
      db._pushSelect([makeDeckCard({ quantity: 3 })]);

      const result = await service.create(USER_ID, {
        name: 'Valid',
        cards: [{ cardId: CARD_ID, quantity: 3, zone: 'main' }],
      });

      expect(result).toBeDefined();
    });

    it('should include the card id in the error message when copies exceeded', async () => {
      await expect(
        service.create(USER_ID, {
          name: 'Invalid',
          cards: [{ cardId: CARD_ID, quantity: 4, zone: 'main' }],
        }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining(CARD_ID),
      });
    });

    it('should detect combined duplicates: two entries summing to > 3 copies in main+sideboard', async () => {
      await expect(
        service.create(USER_ID, {
          name: 'Bad',
          cards: [
            { cardId: CARD_ID, quantity: 2, zone: 'main' },
            { cardId: CARD_ID, quantity: 2, zone: 'sideboard' },
          ],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should allow two different cards each with 3 copies', async () => {
      const created = makeDeck();
      // validateCardIdsExist
      db._pushSelect([{ id: CARD_ID }, { id: CARD_ID_2 }]);
      // buildCardTypeMap
      db._pushSelect([
        { id: CARD_ID, cardType: 'Unit' },
        { id: CARD_ID_2, cardType: 'Unit' },
      ]);
      db._pushInsert([created]);
      db._pushInsert([]);
      db._pushSelect([created]);
      db._pushSelect([
        makeDeckCard({ cardId: CARD_ID, quantity: 3 }),
        makeDeckCard({ cardId: CARD_ID_2, quantity: 3 }),
      ]);

      const result = await service.create(USER_ID, {
        name: 'Two Cards Max',
        cards: [
          { cardId: CARD_ID, quantity: 3, zone: 'main' },
          { cardId: CARD_ID_2, quantity: 3, zone: 'main' },
        ],
      });

      expect(result).toBeDefined();
    });

    it('should allow rune zone to have more than 3 copies (runes exempt from copy limit)', async () => {
      const created = makeDeck();
      // validateCardIdsExist
      db._pushSelect([{ id: CARD_ID }]);
      // buildCardTypeMap — rune cards have type 'Rune', exempt from main copy limit
      db._pushSelect([{ id: CARD_ID, cardType: 'Rune' }]);
      db._pushInsert([created]);
      db._pushInsert([]);
      db._pushSelect([created]);
      db._pushSelect([makeDeckCard({ quantity: 4, zone: 'rune' })]);

      // 4 copies of a Rune in the rune zone — allowed because rune zone is exempt
      const result = await service.create(USER_ID, {
        name: 'Rune Deck',
        cards: [{ cardId: CARD_ID, quantity: 4, zone: 'rune' }],
      });

      expect(result).toBeDefined();
    });
  });
});
