import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { CollectionService } from '../src/modules/collection/collection.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Drizzle chain mock for CollectionService (per-copy model).
 *
 * Call patterns:
 *   add (card check):    db.select({id}).from(cards).where(...).limit(1)
 *   add (insert):        db.insert(collections).values({...}).returning()
 *   addBulk:             repeated add via tx — select + insert per entry
 *   update (select):     db.select().from(collections).where(...).limit(1)
 *   update (update):     db.update(collections).set({...}).where(...).returning()
 *   remove (select):     db.select({id}).from(collections).where(...).limit(1)
 *   remove (delete):     db.delete(collections).where(...)
 *   list (no setSlug):   db.select({...}).from(collections).innerJoin.innerJoin.where.orderBy.limit
 *   list (setSlug):      db.select({id}).from(sets).where.limit  +  collections query
 *   getByCard:           db.select({...}).from(collections).innerJoin.innerJoin.where.orderBy.limit
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
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    chain['groupBy'] = vi.fn().mockImplementation(() => ({
      then: (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled),
    }));
    chain['orderBy'] = vi.fn().mockImplementation(() => {
      const orderChain: Record<string, unknown> = {};
      orderChain['limit'] = vi.fn().mockImplementation(() =>
        Promise.resolve(selectResults[capturedIdx] ?? []),
      );
      orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
      return orderChain;
    });
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

// ---------------------------------------------------------------------------
// R2 mock
// ---------------------------------------------------------------------------

function makeMockR2() {
  return {
    generateUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://upload.example.com/presigned?sig=abc',
      publicUrl: 'https://uploads.lagrieta.app/collection/user123/uuid.jpg',
      key: 'collection/user123/uuid.jpg',
      expiresAt: Date.now() + 600_000,
    }),
  };
}

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------

function makeMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn().mockImplementation(async (key: string) => store.get(key) ?? null),
    setex: vi.fn().mockResolvedValue('OK'),
    _store: store,
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
const COLLECTION_ID_2 = '20000000-0000-0000-0000-000000000002';
const SET_ID = '30000000-0000-0000-0000-000000000001';

function makeCollectionEntry(overrides: Partial<{
  id: string;
  userId: string;
  cardId: string;
  variant: string;
  condition: string;
  purchasePrice: string | null;
  photoUrl: string | null;
  photoKey: string | null;
  notes: string | null;
}> = {}) {
  return {
    id: overrides.id ?? COLLECTION_ID,
    userId: overrides.userId ?? USER_ID,
    cardId: overrides.cardId ?? CARD_ID,
    variant: overrides.variant ?? 'normal',
    condition: overrides.condition ?? 'near_mint',
    purchasePrice: overrides.purchasePrice ?? null,
    photoUrl: overrides.photoUrl ?? null,
    photoKey: overrides.photoKey ?? null,
    notes: overrides.notes ?? null,
    createdAt: new Date('2026-03-10T00:00:00Z'),
    updatedAt: new Date('2026-03-10T00:00:00Z'),
  };
}

function makeCollectionEntryWithCard(overrides: Partial<{
  id: string;
  userId: string;
  cardId: string;
  variant: string;
  condition: string;
}> = {}) {
  const base = makeCollectionEntry(overrides);
  return {
    ...base,
    // Flat card columns (prefixed with card_)
    card_id: overrides.cardId ?? CARD_ID,
    card_externalId: 'origins-001',
    card_number: '001/298',
    card_code: '001/298',
    card_name: 'Blazing Scorcher',
    card_cleanName: 'Blazing Scorcher',
    card_setId: SET_ID,
    card_rarity: 'Common',
    card_cardType: 'Unit',
    card_domain: 'Fury',
    card_energyCost: 5,
    card_powerCost: 0,
    card_might: 5,
    card_description: 'ACCELERATE',
    card_flavorText: null,
    card_imageSmall: 'https://cdn.example.com/small.jpg',
    card_imageLarge: 'https://cdn.example.com/large.jpg',
    card_tcgplayerId: 652771,
    card_tcgplayerUrl: 'https://www.tcgplayer.com/product/652771',
    card_isProduct: false,
    card_createdAt: new Date('2026-01-01T00:00:00Z'),
    card_updatedAt: new Date('2026-01-01T00:00:00Z'),
    // Flat set columns (prefixed with set_)
    set_id: SET_ID,
    set_slug: 'origins',
    set_name: 'Origins',
    set_total: 298,
    set_releaseDate: '2025-10-31',
    set_description: null,
    set_tcgplayerGroupId: 12345,
    set_createdAt: new Date('2026-01-01T00:00:00Z'),
    set_updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;
  let r2: ReturnType<typeof makeMockR2>;
  let service: CollectionService;

  beforeEach(() => {
    db = makeMockDb();
    redis = makeMockRedis();
    r2 = makeMockR2();
    service = new CollectionService(db as never, redis as never, r2 as never);
  });

  // =========================================================================
  // add()
  // =========================================================================

  describe('add()', () => {
    it('should always insert a new row — no upsert logic', async () => {
      const entry = makeCollectionEntry();
      db._pushSelect([{ id: CARD_ID }]); // card exists
      db._pushInsert([entry]); // insert

      const result = await service.add(USER_ID, { cardId: CARD_ID, variant: 'normal', condition: 'near_mint' });

      expect(result.id).toBe(COLLECTION_ID);
      expect(result.cardId).toBe(CARD_ID);
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should create TWO separate rows when called twice for the same card', async () => {
      const entry1 = makeCollectionEntry({ id: COLLECTION_ID });
      const entry2 = makeCollectionEntry({ id: COLLECTION_ID_2 });

      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry1]);

      const result1 = await service.add(USER_ID, { cardId: CARD_ID });

      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry2]);

      const result2 = await service.add(USER_ID, { cardId: CARD_ID });

      expect(result1.id).not.toBe(result2.id);
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should throw NOT_FOUND when card does not exist', async () => {
      db._pushSelect([]); // card not found

      await expect(
        service.add(USER_ID, { cardId: CARD_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
    });

    it('should default variant to normal when not provided', async () => {
      const entry = makeCollectionEntry({ variant: 'normal' });
      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry]);

      const result = await service.add(USER_ID, { cardId: CARD_ID });

      expect(result.variant).toBe('normal');
    });

    it('should default condition to near_mint when not provided', async () => {
      const entry = makeCollectionEntry({ condition: 'near_mint' });
      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry]);

      const result = await service.add(USER_ID, { cardId: CARD_ID });

      expect(result.condition).toBe('near_mint');
    });

    it('should store the variant when provided', async () => {
      const entry = makeCollectionEntry({ variant: 'alt_art' });
      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry]);

      const result = await service.add(USER_ID, { cardId: CARD_ID, variant: 'alt_art' });

      expect(result.variant).toBe('alt_art');
    });

    it('should store notes when provided', async () => {
      const entry = makeCollectionEntry({ notes: 'Bought at GP San Jose' });
      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry]);

      const result = await service.add(USER_ID, { cardId: CARD_ID, notes: 'Bought at GP San Jose' });

      expect(result.notes).toBe('Bought at GP San Jose');
    });
  });

  // =========================================================================
  // addBulk()
  // =========================================================================

  describe('addBulk()', () => {
    it('should create one row per entry (not per quantity)', async () => {
      const entry1 = makeCollectionEntry({ id: COLLECTION_ID, cardId: CARD_ID });
      const entry2 = makeCollectionEntry({ id: COLLECTION_ID_2, cardId: CARD_ID_2 });

      db._pushSelect([{ id: CARD_ID }]);
      db._pushInsert([entry1]);
      db._pushSelect([{ id: CARD_ID_2 }]);
      db._pushInsert([entry2]);

      const result = await service.addBulk(USER_ID, {
        entries: [
          { cardId: CARD_ID, variant: 'normal', condition: 'near_mint' },
          { cardId: CARD_ID_2, variant: 'alt_art', condition: 'lightly_played' },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]!.cardId).toBe(CARD_ID);
      expect(result[1]!.cardId).toBe(CARD_ID_2);
    });

    it('should throw BAD_REQUEST when more than 50 entries are provided', async () => {
      const entries = Array.from({ length: 51 }, (_, i) => ({
        cardId: `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        variant: 'normal' as const,
        condition: 'near_mint' as const,
      }));

      await expect(
        service.addBulk(USER_ID, { entries }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should return empty array for empty entries list', async () => {
      const result = await service.addBulk(USER_ID, { entries: [] });
      expect(result).toHaveLength(0);
    });

    it('should throw NOT_FOUND and stop if any card does not exist', async () => {
      db._pushSelect([]); // first card not found

      await expect(
        service.addBulk(USER_ID, {
          entries: [{ cardId: CARD_ID, variant: 'normal', condition: 'near_mint' }],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
    });

    it('should process up to 50 entries', async () => {
      const entries = Array.from({ length: 10 }, (_, i) => {
        const cardId = `${(i + 1).toString().padStart(8, '0')}-0000-0000-0000-000000000000`;
        db._pushSelect([{ id: cardId }]);
        db._pushInsert([makeCollectionEntry({ cardId })]);
        return { cardId, variant: 'normal' as const, condition: 'near_mint' as const };
      });

      const result = await service.addBulk(USER_ID, { entries });
      expect(result).toHaveLength(10);
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    it('should update the variant of a specific copy', async () => {
      const existing = makeCollectionEntry({ variant: 'normal' });
      const updated = makeCollectionEntry({ variant: 'alt_art' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: COLLECTION_ID, variant: 'alt_art' });

      expect(result).not.toBeNull();
      expect(result!.variant).toBe('alt_art');
    });

    it('should update the purchasePrice of a specific copy', async () => {
      const existing = makeCollectionEntry();
      const updated = makeCollectionEntry({ purchasePrice: '12.50' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: COLLECTION_ID, purchasePrice: '12.50' });

      expect(result!.purchasePrice).toBe('12.50');
    });

    it('should update photoUrl and photoKey', async () => {
      const existing = makeCollectionEntry();
      const updated = makeCollectionEntry({
        photoUrl: 'https://uploads.lagrieta.app/collection/user/uuid.jpg',
        photoKey: 'collection/user/uuid.jpg',
      });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, {
        id: COLLECTION_ID,
        photoUrl: 'https://uploads.lagrieta.app/collection/user/uuid.jpg',
        photoKey: 'collection/user/uuid.jpg',
      });

      expect(result!.photoUrl).toBe('https://uploads.lagrieta.app/collection/user/uuid.jpg');
      expect(result!.photoKey).toBe('collection/user/uuid.jpg');
    });

    it('should update notes when provided', async () => {
      const existing = makeCollectionEntry({ notes: 'Old note' });
      const updated = makeCollectionEntry({ notes: 'New note' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: COLLECTION_ID, notes: 'New note' });

      expect(result!.notes).toBe('New note');
    });

    it('should throw NOT_FOUND when collection entry does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.update(USER_ID, { id: COLLECTION_ID, variant: 'alt_art' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
    });

    it('should throw NOT_FOUND when user does not own the collection entry', async () => {
      db._pushSelect([]); // not found (wrong userId in query)

      await expect(
        service.update(OTHER_USER_ID, { id: COLLECTION_ID, variant: 'alt_art' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
    });
  });

  // =========================================================================
  // remove()
  // =========================================================================

  describe('remove()', () => {
    it('should delete exactly one copy row owned by the user', async () => {
      db._pushSelect([{ id: COLLECTION_ID }]); // ownership verified

      await expect(
        service.remove(USER_ID, { id: COLLECTION_ID }),
      ).resolves.toBeUndefined();

      expect(db.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw NOT_FOUND when collection entry does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.remove(USER_ID, { id: COLLECTION_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
    });

    it('should throw NOT_FOUND when id belongs to another user', async () => {
      db._pushSelect([]); // not found for this userId

      await expect(
        service.remove(OTHER_USER_ID, { id: COLLECTION_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Collection entry not found' });
    });

    it('should not call delete when ownership check fails', async () => {
      db._pushSelect([]);

      try {
        await service.remove(OTHER_USER_ID, { id: COLLECTION_ID });
      } catch {
        // expected
      }

      expect(db.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // list()
  // =========================================================================

  describe('list()', () => {
    it('should return paginated collection entries with copy counts', async () => {
      const entries = [makeCollectionEntryWithCard()];
      db._pushSelect(entries);

      const result = await service.list(USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeUndefined();
      expect(result.items[0]!.userId).toBe(USER_ID);
    });

    it('should return empty result when user has no collection entries', async () => {
      db._pushSelect([]);

      const result = await service.list(USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should set nextCursor when there are more items than the limit', async () => {
      const entries = Array.from({ length: 21 }, (_, i) =>
        makeCollectionEntryWithCard({ id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000` }),
      );
      db._pushSelect(entries);

      const result = await service.list(USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBeTruthy();
    });

    it('should return empty result when setSlug filter matches no set', async () => {
      db._pushSelect([]); // set lookup returns empty

      const result = await service.list(USER_ID, { limit: 20, setSlug: 'nonexistent-set' });

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should filter by setSlug when set exists', async () => {
      db._pushSelect([{ id: SET_ID }]); // set lookup
      db._pushSelect([makeCollectionEntryWithCard()]); // collection query

      const result = await service.list(USER_ID, { limit: 20, setSlug: 'origins' });

      expect(result.items).toHaveLength(1);
      expect(db.select).toHaveBeenCalledTimes(2);
    });

    it('should filter by variant when provided', async () => {
      const entry = makeCollectionEntryWithCard({ variant: 'alt_art' });
      db._pushSelect([entry]);

      const result = await service.list(USER_ID, { limit: 20, variant: 'alt_art' });

      expect(result.items).toHaveLength(1);
    });

    it('should sort alphabetically by name when sortBy=name sortDir=asc', async () => {
      const entries = [
        makeCollectionEntryWithCard({ id: COLLECTION_ID }),
        makeCollectionEntryWithCard({ id: COLLECTION_ID_2, cardId: CARD_ID_2 }),
      ];
      db._pushSelect(entries);

      const result = await service.list(USER_ID, { limit: 20, sortBy: 'name', sortDir: 'asc' });

      expect(result.items).toHaveLength(2);
    });

    it('should include card details in each entry', async () => {
      db._pushSelect([makeCollectionEntryWithCard()]);

      const result = await service.list(USER_ID, { limit: 20 });

      const entry = result.items[0]!;
      expect(entry.card).toBeDefined();
      expect(entry.card.name).toBe('Blazing Scorcher');
      expect(entry.card.rarity).toBe('Common');
    });

    it('should use cursor for pagination', async () => {
      const cursorId = '11111111-0000-0000-0000-000000000001';
      db._pushSelect([makeCollectionEntryWithCard()]);

      const result = await service.list(USER_ID, { limit: 20, cursor: cursorId });

      expect(result.items).toHaveLength(1);
      expect(db.select).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getByCard()
  // =========================================================================

  describe('getByCard()', () => {
    it('should return all copies of a specific card for the user', async () => {
      const entries = [
        makeCollectionEntryWithCard({ id: COLLECTION_ID }),
        makeCollectionEntryWithCard({ id: COLLECTION_ID_2 }),
      ];
      db._pushSelect(entries);

      const result = await service.getByCard(USER_ID, { cardId: CARD_ID });

      expect(result).toHaveLength(2);
      expect(result[0]!.cardId).toBe(CARD_ID);
      expect(result[1]!.cardId).toBe(CARD_ID);
    });

    it('should return empty array when user has no copies of the card', async () => {
      db._pushSelect([]);

      const result = await service.getByCard(USER_ID, { cardId: CARD_ID });

      expect(result).toHaveLength(0);
    });

    it('should include card details in each copy', async () => {
      db._pushSelect([makeCollectionEntryWithCard()]);

      const result = await service.getByCard(USER_ID, { cardId: CARD_ID });

      expect(result[0]!.card.name).toBe('Blazing Scorcher');
    });
  });

  // =========================================================================
  // getUploadUrl()
  // =========================================================================

  describe('getUploadUrl()', () => {
    it('should return presigned URL from R2 with collection purpose', async () => {
      const result = await service.getUploadUrl(USER_ID, { contentType: 'image/jpeg' });

      expect(result.uploadUrl).toContain('presigned');
      expect(result.publicUrl).toContain('collection');
      expect(result.key).toContain('collection');
      expect(r2.generateUploadUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          purpose: 'collection',
          userId: USER_ID,
          contentType: 'image/jpeg',
        }),
      );
    });

    it('should pass expiresAt in the result', async () => {
      const result = await service.getUploadUrl(USER_ID, { contentType: 'image/jpeg' });

      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should throw BAD_REQUEST for disallowed content types', async () => {
      r2.generateUploadUrl.mockRejectedValueOnce(new Error('Content type "application/pdf" is not allowed'));

      await expect(
        service.getUploadUrl(USER_ID, { contentType: 'application/pdf' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // =========================================================================
  // stats()
  // =========================================================================

  describe('stats()', () => {
    it('should return zero stats when user has no collection entries', async () => {
      db._pushSelect([{ totalCards: 0, uniqueCards: 0 }]); // totals
      db._pushSelect([]); // no sets → early return

      const result = await service.stats(USER_ID);

      expect(result.totalCards).toBe(0);
      expect(result.uniqueCards).toBe(0);
      expect(result.setStats).toHaveLength(0);
    });

    it('should return correct totalCards and uniqueCards counts', async () => {
      db._pushSelect([{ totalCards: 10, uniqueCards: 7 }]); // aggregates
      db._pushSelect([]); // no sets → early return

      const result = await service.stats(USER_ID);

      expect(result.totalCards).toBe(10);
      expect(result.uniqueCards).toBe(7);
    });

    it('should compute completion percentage for each set', async () => {
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

      db._pushSelect([{ totalCards: 30, uniqueCards: 20 }]); // totals
      db._pushSelect([testSet]); // sets
      db._pushSelect([{ setId: SET_ID, count: 298 }]); // total cards per set
      db._pushSelect([{ setId: SET_ID, count: 149 }]); // owned cards per set

      const result = await service.stats(USER_ID);

      expect(result.setStats).toHaveLength(1);
      const setStat = result.setStats[0]!;
      expect(setStat.setSlug).toBe('origins');
      expect(setStat.totalCards).toBe(298);
      expect(setStat.ownedCards).toBe(149);
      expect(setStat.completionPercent).toBe(50);
    });

    it('should handle null totals gracefully', async () => {
      db._pushSelect([null]); // null row from aggregates
      db._pushSelect([]); // no sets → early return

      const result = await service.stats(USER_ID);

      expect(result.totalCards).toBe(0);
      expect(result.uniqueCards).toBe(0);
    });
  });
});
