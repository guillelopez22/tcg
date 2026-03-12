import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { WishlistService } from '../src/modules/wishlist/wishlist.service';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Drizzle chain mock for WishlistService.
 *
 * Call patterns:
 *   toggle (check):   db.select({id}).from(wishlists).where(...).limit(1)
 *   toggle (delete):  db.delete(wishlists).where(...)
 *   toggle (insert):  db.insert(wishlists).values({...}).returning()
 *   update (select):  db.select().from(wishlists).where(...).limit(1)
 *   update (update):  db.update(wishlists).set({...}).where(...).returning()
 *   list:             db.select({...}).from(wishlists).innerJoin(...).where(...).orderBy(...).limit(n+1)
 *   getForCard:       db.select({...}).from(wishlists).where(...).limit(...)
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
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
    _pushInsert: (...rows: unknown[][]) => { insertResults.push(...rows); },
    _pushUpdate: (...rows: unknown[][]) => { updateResults.push(...rows); },
  };

  return mockDb;
}

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------

function makeMockRedis() {
  return {
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const OTHER_USER_ID = 'b2c3d4e5-0000-0000-0000-000000000002';
const CARD_ID = '10000000-0000-0000-0000-000000000001';
const CARD_ID_2 = '10000000-0000-0000-0000-000000000002';
const WISHLIST_ID = '40000000-0000-0000-0000-000000000001';
const WISHLIST_ID_2 = '40000000-0000-0000-0000-000000000002';
const SET_ID = '30000000-0000-0000-0000-000000000001';

function makeWishlistEntry(overrides: Partial<{
  id: string;
  userId: string;
  cardId: string;
  type: string;
  preferredVariant: string | null;
  maxPrice: string | null;
  askingPrice: string | null;
  isPublic: boolean;
}> = {}) {
  return {
    id: overrides.id ?? WISHLIST_ID,
    userId: overrides.userId ?? USER_ID,
    cardId: overrides.cardId ?? CARD_ID,
    type: overrides.type ?? 'want',
    preferredVariant: overrides.preferredVariant ?? null,
    maxPrice: overrides.maxPrice ?? null,
    askingPrice: overrides.askingPrice ?? null,
    isPublic: overrides.isPublic ?? false,
    createdAt: new Date('2026-03-10T00:00:00Z'),
    updatedAt: new Date('2026-03-10T00:00:00Z'),
  };
}

function makeWishlistEntryWithCard(overrides: Partial<{
  id: string;
  userId: string;
  cardId: string;
  type: string;
}> = {}) {
  const base = makeWishlistEntry(overrides);
  return {
    ...base,
    // Flat card columns
    card_id: overrides.cardId ?? CARD_ID,
    card_name: 'Blazing Scorcher',
    card_imageSmall: 'https://cdn.example.com/small.jpg',
    card_imageLarge: 'https://cdn.example.com/large.jpg',
    card_rarity: 'Common',
    card_setId: SET_ID,
    card_setSlug: 'origins',
    card_setName: 'Origins',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WishlistService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;
  let service: WishlistService;

  beforeEach(() => {
    db = makeMockDb();
    redis = makeMockRedis();
    service = new WishlistService(db as never, redis as never);
  });

  // =========================================================================
  // toggle()
  // =========================================================================

  describe('toggle()', () => {
    it('should add card to wantlist when not already present, returning {added: true}', async () => {
      db._pushSelect([]); // not on wantlist
      db._pushInsert([makeWishlistEntry({ type: 'want' })]); // insert

      const result = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });

      expect(result.added).toBe(true);
      expect(db.insert).toHaveBeenCalledTimes(1);
      expect(db.delete).not.toHaveBeenCalled();
    });

    it('should remove card from wantlist when already present, returning {added: false}', async () => {
      db._pushSelect([{ id: WISHLIST_ID }]); // on wantlist

      const result = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });

      expect(result.added).toBe(false);
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should work independently for want and trade types (same card on both)', async () => {
      // Add to wantlist
      db._pushSelect([]); // not on wantlist
      db._pushInsert([makeWishlistEntry({ type: 'want' })]);

      const wantResult = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });
      expect(wantResult.added).toBe(true);

      // Add to tradelist (same card)
      db._pushSelect([]); // not on tradelist (checked separately)
      db._pushInsert([makeWishlistEntry({ id: WISHLIST_ID_2, type: 'trade' })]);

      const tradeResult = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'trade' });
      expect(tradeResult.added).toBe(true);
    });

    it('should toggle idempotently: on → off → on', async () => {
      // First toggle: add
      db._pushSelect([]);
      db._pushInsert([makeWishlistEntry()]);
      const first = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });
      expect(first.added).toBe(true);

      // Second toggle: remove
      db._pushSelect([{ id: WISHLIST_ID }]);
      const second = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });
      expect(second.added).toBe(false);

      // Third toggle: add again
      db._pushSelect([]);
      db._pushInsert([makeWishlistEntry()]);
      const third = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });
      expect(third.added).toBe(true);
    });

    it('should toggle trade type independently from want type', async () => {
      // Want is on
      db._pushSelect([{ id: WISHLIST_ID }]);
      const wantOff = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'want' });
      expect(wantOff.added).toBe(false);

      // Trade is not on (checked separately)
      db._pushSelect([]);
      db._pushInsert([makeWishlistEntry({ id: WISHLIST_ID_2, type: 'trade' })]);
      const tradeOn = await service.toggle(USER_ID, { cardId: CARD_ID, type: 'trade' });
      expect(tradeOn.added).toBe(true);
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update()', () => {
    it('should update preferredVariant on a wantlist entry', async () => {
      const existing = makeWishlistEntry({ type: 'want' });
      const updated = makeWishlistEntry({ preferredVariant: 'alt_art' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: WISHLIST_ID, preferredVariant: 'alt_art' });

      expect(result!.preferredVariant).toBe('alt_art');
    });

    it('should update maxPrice on a wantlist entry', async () => {
      const existing = makeWishlistEntry({ type: 'want' });
      const updated = makeWishlistEntry({ maxPrice: '25.00' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: WISHLIST_ID, maxPrice: '25.00' });

      expect(result!.maxPrice).toBe('25.00');
    });

    it('should update askingPrice on a tradelist entry', async () => {
      const existing = makeWishlistEntry({ type: 'trade' });
      const updated = makeWishlistEntry({ type: 'trade', askingPrice: '15.00' });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: WISHLIST_ID, askingPrice: '15.00' });

      expect(result!.askingPrice).toBe('15.00');
    });

    it('should set isPublic to true', async () => {
      const existing = makeWishlistEntry({ isPublic: false });
      const updated = makeWishlistEntry({ isPublic: true });

      db._pushSelect([existing]);
      db._pushUpdate([updated]);

      const result = await service.update(USER_ID, { id: WISHLIST_ID, isPublic: true });

      expect(result!.isPublic).toBe(true);
    });

    it('should throw NOT_FOUND when entry does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.update(USER_ID, { id: WISHLIST_ID, maxPrice: '10.00' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Wishlist entry not found' });
    });

    it('should throw NOT_FOUND when user does not own the entry', async () => {
      db._pushSelect([]);

      await expect(
        service.update(OTHER_USER_ID, { id: WISHLIST_ID, maxPrice: '10.00' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Wishlist entry not found' });
    });
  });

  // =========================================================================
  // list()
  // =========================================================================

  describe('list()', () => {
    it('should return wantlist entries with joined card data', async () => {
      const entries = [makeWishlistEntryWithCard({ type: 'want' })];
      db._pushSelect(entries);

      const result = await service.list(USER_ID, { type: 'want', limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.type).toBe('want');
      expect(result.items[0]!.card).toBeDefined();
    });

    it('should return tradelist entries when type=trade', async () => {
      const entries = [makeWishlistEntryWithCard({ type: 'trade' })];
      db._pushSelect(entries);

      const result = await service.list(USER_ID, { type: 'trade', limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.type).toBe('trade');
    });

    it('should return empty result when user has no entries of that type', async () => {
      db._pushSelect([]);

      const result = await service.list(USER_ID, { type: 'want', limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should paginate with nextCursor when results exceed limit', async () => {
      const entries = Array.from({ length: 21 }, (_, i) =>
        makeWishlistEntryWithCard({ id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000` }),
      );
      db._pushSelect(entries);

      const result = await service.list(USER_ID, { type: 'want', limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBeTruthy();
    });

    it('should include card name and images in results', async () => {
      db._pushSelect([makeWishlistEntryWithCard()]);

      const result = await service.list(USER_ID, { type: 'want', limit: 20 });

      const entry = result.items[0]!;
      expect(entry.card.name).toBe('Blazing Scorcher');
      expect(entry.card.imageSmall).toBe('https://cdn.example.com/small.jpg');
    });
  });

  // =========================================================================
  // getForCard()
  // =========================================================================

  describe('getForCard()', () => {
    it('should return {onWantlist: false, onTradelist: false} when card not on either list', async () => {
      db._pushSelect([]); // no entries

      const result = await service.getForCard(USER_ID, CARD_ID);

      expect(result.onWantlist).toBe(false);
      expect(result.onTradelist).toBe(false);
      expect(result.wantEntry).toBeUndefined();
      expect(result.tradeEntry).toBeUndefined();
    });

    it('should return {onWantlist: true} when card is on wantlist', async () => {
      db._pushSelect([makeWishlistEntry({ type: 'want' })]);

      const result = await service.getForCard(USER_ID, CARD_ID);

      expect(result.onWantlist).toBe(true);
      expect(result.wantEntry).toBeDefined();
      expect(result.wantEntry!.type).toBe('want');
    });

    it('should return {onTradelist: true} when card is on tradelist', async () => {
      db._pushSelect([makeWishlistEntry({ type: 'trade' })]);

      const result = await service.getForCard(USER_ID, CARD_ID);

      expect(result.onTradelist).toBe(true);
      expect(result.tradeEntry).toBeDefined();
      expect(result.tradeEntry!.type).toBe('trade');
    });

    it('should return both true when card is on both wantlist and tradelist', async () => {
      db._pushSelect([
        makeWishlistEntry({ id: WISHLIST_ID, type: 'want' }),
        makeWishlistEntry({ id: WISHLIST_ID_2, type: 'trade' }),
      ]);

      const result = await service.getForCard(USER_ID, CARD_ID);

      expect(result.onWantlist).toBe(true);
      expect(result.onTradelist).toBe(true);
      expect(result.wantEntry).toBeDefined();
      expect(result.tradeEntry).toBeDefined();
    });
  });
});
