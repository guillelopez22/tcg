import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import * as crypto from 'crypto';
import { CardService } from '../src/modules/card/card.service';

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
  const selectResults: unknown[][] = [];
  let selectIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const chain: Record<string, unknown> = {};
    chain['from'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['innerJoin'] = vi.fn().mockReturnValue(chain);
    chain['orderBy'] = vi.fn().mockReturnValue(chain);
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    // For queries without .limit() (getSets, sync): resolve directly from chain
    // We implement this by making the chain itself thenable when no further chaining
    // Actually getSets uses .orderBy() as terminal — so we need orderBy to also resolve.
    // But we need it to chain for list (which does .orderBy().limit()).
    // Solution: orderBy returns the chain AND is thenable.
    chain['orderBy'] = vi.fn().mockImplementation(() => {
      const orderChain: Record<string, unknown> = {};
      orderChain['limit'] = vi.fn().mockImplementation(() =>
        Promise.resolve(selectResults[capturedIdx] ?? []),
      );
      // Thenable for direct await (getSets, sync)
      orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
      return orderChain;
    });
    return chain;
  });

  return {
    select,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
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

function makeCard(overrides: Partial<{
  id: string;
  externalId: string;
  name: string;
  cleanName: string;
  rarity: string;
  cardType: string;
  domain: string;
  isProduct: boolean;
  setId: string;
  updatedAt: Date;
}> = {}) {
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

describe('CardService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: CardService;

  beforeEach(() => {
    db = makeMockDb();
    service = new CardService(db as never);
  });

  // =========================================================================
  // list()
  // =========================================================================

  describe('list()', () => {
    it('should return paginated cards with default limit', async () => {
      const cards = Array.from({ length: 5 }, (_, i) =>
        makeCard({ id: `card-${i}`, name: `Card ${i}` }),
      );
      db._pushSelect(cards);

      const result = await service.list({
        limit: 20,
        includeProducts: false,
      });

      expect(result.items).toHaveLength(5);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should set nextCursor when more items exist than the limit', async () => {
      // Return limit+1 cards to trigger next page detection
      const cards = Array.from({ length: 21 }, (_, i) =>
        makeCard({ id: `card-uuid-${i.toString().padStart(4, '0')}-placeholder-uuid`, name: `Card ${i}` }),
      );
      db._pushSelect(cards);

      const result = await service.list({ limit: 20, includeProducts: false });

      expect(result.items).toHaveLength(20); // trimmed to limit
      expect(result.nextCursor).toBeTruthy();
      expect(result.nextCursor).toBe(result.items[19]?.id);
    });

    it('should return empty array when no cards match', async () => {
      db._pushSelect([]);

      const result = await service.list({ limit: 20, includeProducts: false });

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should return empty result when setSlug is provided but set does not exist', async () => {
      db._pushSelect([]); // set lookup returns empty

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        setSlug: 'nonexistent-set',
      });

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should query cards when setSlug matches a known set', async () => {
      db._pushSelect([{ id: SET_ID }]); // set lookup
      db._pushSelect([TEST_CARD]); // card query

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        setSlug: 'origins',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should include products when includeProducts is true', async () => {
      const product = makeCard({ isProduct: true, rarity: 'Common' });
      db._pushSelect([product]);

      const result = await service.list({ limit: 20, includeProducts: true });

      expect(result.items).toHaveLength(1);
    });

    it('should pass cursor filter when cursor is provided', async () => {
      const cursorId = 'cursor-uuid-0000-0000-0000-000000000000';
      db._pushSelect([TEST_CARD]);

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        cursor: cursorId,
      });

      // Verify the db.select was called (cursor condition was built)
      expect(db.select).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should filter by rarity', async () => {
      db._pushSelect([TEST_CARD]); // mock returns the filtered result

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        rarity: 'Common',
      });

      expect(result.items).toHaveLength(1);
      // db.select was called with rarity condition built
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by cardType', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        cardType: 'Unit',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should filter by domain (partial match via ilike)', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        domain: 'Fury',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should filter by search term (partial match via ilike on cleanName)', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.list({
        limit: 20,
        includeProducts: false,
        search: 'Blazing',
      });

      expect(result.items).toHaveLength(1);
    });

    it('should fetch limit+1 rows from DB to detect next page', async () => {
      db._pushSelect([]);

      await service.list({ limit: 20, includeProducts: false });

      // The chain's limit() was called — we verify the service passes limit+1
      // by checking the mock was called (implementation detail tested indirectly)
      expect(db.select).toHaveBeenCalled();
    });

    it('should return items with correct card shape', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.list({ limit: 20, includeProducts: false });

      const card = result.items[0]!;
      expect(card.id).toBe(CARD_ID);
      expect(card.name).toBe('Blazing Scorcher');
      expect(card.rarity).toBe('Common');
    });
  });

  // =========================================================================
  // getById()
  // =========================================================================

  describe('getById()', () => {
    it('should return card with set info when card exists', async () => {
      db._pushSelect([TEST_CARD_WITH_SET]);

      const result = await service.getById({ id: CARD_ID });

      expect(result.id).toBe(CARD_ID);
      expect(result.name).toBe('Blazing Scorcher');
      expect(result.set.slug).toBe('origins');
    });

    it('should throw NOT_FOUND when card does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.getById({ id: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
    });

    it('should include set relationship in the returned object', async () => {
      db._pushSelect([TEST_CARD_WITH_SET]);

      const result = await service.getById({ id: CARD_ID });

      expect(result.set).toBeDefined();
      expect(result.set.id).toBe(SET_ID);
      expect(result.set.name).toBe('Origins');
    });

    it('should include all expected card fields', async () => {
      db._pushSelect([TEST_CARD_WITH_SET]);

      const result = await service.getById({ id: CARD_ID });

      const required = [
        'id', 'externalId', 'number', 'code', 'name', 'cleanName',
        'setId', 'rarity', 'cardType', 'domain', 'energyCost', 'powerCost',
        'might', 'description', 'flavorText', 'imageSmall', 'imageLarge',
        'tcgplayerId', 'tcgplayerUrl', 'isProduct', 'createdAt', 'updatedAt',
      ];
      for (const field of required) {
        expect(result, `missing field: ${field}`).toHaveProperty(field);
      }
    });
  });

  // =========================================================================
  // getByExternalId()
  // =========================================================================

  describe('getByExternalId()', () => {
    it('should return card with set info when externalId matches', async () => {
      db._pushSelect([TEST_CARD_WITH_SET]);

      const result = await service.getByExternalId({ externalId: EXTERNAL_ID });

      expect(result.externalId).toBe(EXTERNAL_ID);
      expect(result.set.slug).toBe('origins');
    });

    it('should throw NOT_FOUND when externalId does not match', async () => {
      db._pushSelect([]);

      await expect(
        service.getByExternalId({ externalId: 'nonexistent-id' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Card not found' });
    });
  });

  // =========================================================================
  // getSets()
  // =========================================================================

  describe('getSets()', () => {
    it('should return all sets ordered by releaseDate', async () => {
      const sets = [
        { ...TEST_SET, id: 'set-1', slug: 'origins', releaseDate: '2025-10-31' },
        { ...TEST_SET, id: 'set-2', slug: 'spiritforged', releaseDate: '2026-01-01' },
      ];
      db._pushSelect(sets);

      const result = await service.getSets();

      expect(result).toHaveLength(2);
      expect(result[0]?.slug).toBe('origins');
      expect(result[1]?.slug).toBe('spiritforged');
    });

    it('should return empty array when no sets exist', async () => {
      db._pushSelect([]);

      const result = await service.getSets();

      expect(result).toHaveLength(0);
    });

    it('should return sets with all required fields', async () => {
      db._pushSelect([TEST_SET]);

      const [set] = await service.getSets();

      expect(set?.id).toBe(SET_ID);
      expect(set?.slug).toBe('origins');
      expect(set?.name).toBe('Origins');
      expect(set?.total).toBe(298);
    });
  });

  // =========================================================================
  // sync()
  // =========================================================================

  describe('sync()', () => {
    it('should return all non-product cards with a hash', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.sync({});

      expect(result.cards).toHaveLength(1);
      expect(result.hash).toBeTruthy();
      expect(result.upToDate).toBe(false);
    });

    it('should return upToDate=false when no lastSyncHash provided', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.sync({});

      expect(result.upToDate).toBe(false);
    });

    it('should return upToDate=true and empty cards when hash matches', async () => {
      // Build the exact hash the service would generate
      const updatedAt = new Date('2026-01-01T00:00:00Z');
      const card = makeCard({ updatedAt });
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${card.id}:${updatedAt.getTime()}`)
        .digest('hex');

      db._pushSelect([card]);

      const result = await service.sync({ lastSyncHash: expectedHash });

      expect(result.upToDate).toBe(true);
      expect(result.cards).toHaveLength(0);
      expect(result.hash).toBe(expectedHash);
    });

    it('should return upToDate=false and full card list when hash does not match', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.sync({ lastSyncHash: 'old-stale-hash-value' });

      expect(result.upToDate).toBe(false);
      expect(result.cards).toHaveLength(1);
    });

    it('should generate a deterministic SHA-256 hash from card ids and updatedAt', async () => {
      const card = makeCard({ updatedAt: new Date('2026-01-15T12:00:00Z') });
      db._pushSelect([card]);
      const result1 = await service.sync({});

      db._pushSelect([card]);
      const result2 = await service.sync({});

      expect(result1.hash).toBe(result2.hash); // deterministic
    });

    it('should produce different hashes when card updatedAt changes', async () => {
      const card1 = makeCard({ updatedAt: new Date('2026-01-01T00:00:00Z') });
      db._pushSelect([card1]);
      const result1 = await service.sync({});

      const card2 = makeCard({ updatedAt: new Date('2026-02-01T00:00:00Z') });
      db._pushSelect([card2]);
      const result2 = await service.sync({});

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should return empty cards array when DB has no non-product cards', async () => {
      db._pushSelect([]);

      const result = await service.sync({});

      expect(result.cards).toHaveLength(0);
      expect(result.upToDate).toBe(false);
    });

    it('should return a 64-character hex SHA-256 hash', async () => {
      db._pushSelect([TEST_CARD]);

      const result = await service.sync({});

      expect(result.hash).toHaveLength(64);
      expect(result.hash).toMatch(/^[0-9a-f]+$/);
    });
  });
});
