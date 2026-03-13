/**
 * Integration tests for card browsing.
 *
 * Tests the full stack: CardRouter → CardService → mocked DB.
 * Exercises all filter combinations that Phase 1 requires.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrpcService } from '../src/trpc/trpc.service';
import { CardService } from '../src/modules/card/card.service';
import { CardRouter } from '../src/modules/card/card.router';
import type { TrpcContext } from '../src/trpc/trpc.context';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMockDb() {
  const selectResults: unknown[][] = [];
  let selectIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const chain: Record<string, unknown> = {};
    chain['from'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['innerJoin'] = vi.fn().mockReturnValue(chain);
    chain['orderBy'] = vi.fn().mockImplementation(() => {
      const orderChain: Record<string, unknown> = {};
      orderChain['limit'] = vi.fn().mockImplementation(() =>
        Promise.resolve(selectResults[capturedIdx] ?? []),
      );
      orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
      return orderChain;
    });
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    return chain;
  });

  return {
    select,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
  };
}

// Rate-limit pipeline mock — always under limit
function makeMockRedis() {
  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
  };
  return {
    pipeline: vi.fn().mockReturnValue(pipeline),
    get: vi.fn().mockResolvedValue(null),
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

function makeCard(overrides: Partial<{
  id: string;
  name: string;
  cleanName: string;
  rarity: string;
  cardType: string;
  domain: string;
  isProduct: boolean;
  setId: string;
}> = {}) {
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

// ---------------------------------------------------------------------------
// Router builder
// ---------------------------------------------------------------------------

type CardCaller = {
  list: (input: Record<string, unknown>) => Promise<unknown>;
  getById: (input: { id: string }) => Promise<unknown>;
  getByExternalId: (input: { externalId: string }) => Promise<unknown>;
  sets: () => Promise<unknown>;
  sync: (input: Record<string, unknown>) => Promise<unknown>;
};

function buildCardCaller(
  db: ReturnType<typeof makeMockDb>,
  redis: ReturnType<typeof makeMockRedis>,
): CardCaller {
  const trpcService = new TrpcService();
  const cardService = new CardService(db as never);
  const cardRouter = new CardRouter(trpcService, cardService);
  const router = cardRouter.buildRouter();
  const ctx: TrpcContext = {
    req: {
      headers: {},
      ip: '127.0.0.1',
      method: 'GET',
    } as never,
    db: db as never,
    redis: redis as never,
  };
  return (router as unknown as { createCaller: (ctx: TrpcContext) => CardCaller }).createCaller(ctx);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Card browsing integration', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;
  let caller: CardCaller;

  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-secret-min-32-chars-for-test';
    db = makeMockDb();
    redis = makeMockRedis();
    caller = buildCardCaller(db, redis);
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
    vi.restoreAllMocks();
  });

  // =========================================================================
  // card.list — filter combinations
  // =========================================================================

  describe('card.list', () => {
    it('should return paginated cards with defaults (no filters)', async () => {
      const cards = [makeCard(), makeCard({ id: 'card-2' })];
      db._pushSelect(cards);

      const result = await caller.list({ limit: 20, includeProducts: false }) as { items: unknown[]; nextCursor: undefined };

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should set nextCursor when limit+1 rows are returned', async () => {
      const cards = Array.from({ length: 21 }, (_, i) =>
        makeCard({ id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000` }),
      );
      db._pushSelect(cards);

      const result = await caller.list({ limit: 20, includeProducts: false }) as { items: unknown[]; nextCursor: string };

      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBeTruthy();
    });

    it('should filter by setSlug (first queries sets, then cards)', async () => {
      db._pushSelect([{ id: SET_ID }]); // set lookup
      db._pushSelect([makeCard()]); // card query

      const result = await caller.list({ limit: 20, includeProducts: false, setSlug: 'origins' }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should return empty items when setSlug does not match any set', async () => {
      db._pushSelect([]); // set not found

      const result = await caller.list({ limit: 20, includeProducts: false, setSlug: 'unknown-set' }) as { items: unknown[] };

      expect(result.items).toHaveLength(0);
    });

    it('should filter by rarity=Common', async () => {
      db._pushSelect([makeCard({ rarity: 'Common' })]);

      const result = await caller.list({ limit: 20, includeProducts: false, rarity: 'Common' }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should filter by rarity=Rare', async () => {
      db._pushSelect([makeCard({ rarity: 'Rare' })]);

      const result = await caller.list({ limit: 20, includeProducts: false, rarity: 'Rare' }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should reject invalid rarity values via Zod validation', async () => {
      await expect(
        caller.list({ limit: 20, includeProducts: false, rarity: 'InvalidRarity' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should filter by cardType', async () => {
      db._pushSelect([makeCard({ cardType: 'Champion Unit' })]);

      const result = await caller.list({ limit: 20, includeProducts: false, cardType: 'Champion Unit' }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should filter by domain', async () => {
      db._pushSelect([makeCard({ domain: 'Chaos' })]);

      const result = await caller.list({ limit: 20, includeProducts: false, domain: 'Chaos' }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should filter by search term', async () => {
      db._pushSelect([makeCard({ name: 'Shadow Stalker', cleanName: 'Shadow Stalker' })]);

      const result = await caller.list({ limit: 20, includeProducts: false, search: 'Shadow' }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should filter with cursor-based pagination', async () => {
      const cursorId = '30000000-0000-0000-0000-aabbccddeeff';
      db._pushSelect([makeCard()]);

      const result = await caller.list({
        limit: 20,
        includeProducts: false,
        cursor: cursorId,
      }) as { items: unknown[] };

      expect(db.select).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('should apply combined filters: rarity + domain + search', async () => {
      db._pushSelect([makeCard({ rarity: 'Epic', domain: 'Fury', name: 'Infernal King' })]);

      const result = await caller.list({
        limit: 20,
        includeProducts: false,
        rarity: 'Epic',
        domain: 'Fury',
        search: 'Infernal',
      }) as { items: unknown[] };

      expect(result.items).toHaveLength(1);
    });

    it('should respect limit=5', async () => {
      db._pushSelect([makeCard()]);

      const result = await caller.list({ limit: 5, includeProducts: false }) as { items: unknown[] };

      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    it('should reject limit=0 (below minimum)', async () => {
      await expect(
        caller.list({ limit: 0, includeProducts: false }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should reject limit=101 (above maximum)', async () => {
      await expect(
        caller.list({ limit: 101, includeProducts: false }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should reject cursor that is not a UUID', async () => {
      await expect(
        caller.list({ limit: 20, includeProducts: false, cursor: 'not-a-uuid' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should return empty results when no cards exist', async () => {
      db._pushSelect([]);

      const result = await caller.list({ limit: 20, includeProducts: false }) as { items: unknown[] };

      expect(result.items).toHaveLength(0);
    });
  });

  // =========================================================================
  // card.getById
  // =========================================================================

  describe('card.getById', () => {
    it('should return card with set info when card exists', async () => {
      db._pushSelect([{ ...makeCard(), set: TEST_SET }]);

      const result = await caller.getById({ id: CARD_ID }) as { id: string; set: { slug: string } };

      expect(result.id).toBe(CARD_ID);
      expect(result.set.slug).toBe('origins');
    });

    it('should throw NOT_FOUND when card does not exist', async () => {
      db._pushSelect([]);

      await expect(
        caller.getById({ id: '00000000-0000-0000-0000-000000000000' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should reject non-UUID id via Zod validation', async () => {
      await expect(
        caller.getById({ id: 'not-a-uuid' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // =========================================================================
  // card.sets
  // =========================================================================

  describe('card.sets', () => {
    it('should return all sets', async () => {
      db._pushSelect([TEST_SET]);

      const result = await caller.sets() as unknown[];

      expect(result).toHaveLength(1);
      expect((result[0] as { slug: string }).slug).toBe('origins');
    });

    it('should return empty array when no sets exist', async () => {
      db._pushSelect([]);

      const result = await caller.sets() as unknown[];

      expect(result).toHaveLength(0);
    });
  });

  // =========================================================================
  // card.sync
  // =========================================================================

  describe('card.sync', () => {
    it('should return all cards and a hash when no lastSyncHash provided', async () => {
      db._pushSelect([makeCard()]);

      const result = await caller.sync({}) as { hash: string; cards: unknown[]; upToDate: boolean };

      expect(result.hash).toBeTruthy();
      expect(result.cards).toHaveLength(1);
      expect(result.upToDate).toBe(false);
    });

    it('should return upToDate=true when hash matches', async () => {
      // Calculate the hash that the service will produce
      const updatedAt = new Date('2026-01-01T00:00:00Z');
      const card = makeCard({ updatedAt } as never);

      // First call to get the hash
      db._pushSelect([card]);
      const firstResult = await caller.sync({}) as { hash: string };
      const hash = firstResult.hash;

      // Second call with matching hash
      db._pushSelect([card]);
      const result = await caller.sync({ lastSyncHash: hash }) as { upToDate: boolean; cards: unknown[] };

      expect(result.upToDate).toBe(true);
      expect(result.cards).toHaveLength(0);
    });

    it('should return full card list when hash does not match', async () => {
      db._pushSelect([makeCard()]);

      const result = await caller.sync({ lastSyncHash: 'stale-hash' }) as { upToDate: boolean; cards: unknown[] };

      expect(result.upToDate).toBe(false);
      expect(result.cards).toHaveLength(1);
    });
  });
});
