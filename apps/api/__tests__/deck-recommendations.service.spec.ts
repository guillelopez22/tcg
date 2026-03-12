import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckRecommendationsService } from '../src/modules/deck-recommendations/deck-recommendations.service';

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
    chain['leftJoin'] = vi.fn().mockReturnValue(chain);
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
    chain['then'] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(selectResults[capturedIdx] ?? []).then(onFulfilled);
    return chain;
  });

  const mockDb = {
    select,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
  };

  return mockDb;
}

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
const DECK_ID = '40000000-0000-0000-0000-000000000001';
const DECK_ID_2 = '40000000-0000-0000-0000-000000000002';
const DECK_ID_3 = '40000000-0000-0000-0000-000000000003';
const CARD_ID_1 = '10000000-0000-0000-0000-000000000001';
const CARD_ID_2 = '10000000-0000-0000-0000-000000000002';
const CARD_ID_3 = '10000000-0000-0000-0000-000000000003';
const CARD_ID_4 = '10000000-0000-0000-0000-000000000004';
const CARD_ID_5 = '10000000-0000-0000-0000-000000000005';
const CARD_ID_6 = '10000000-0000-0000-0000-000000000006';

function makeDeck(overrides: Partial<{
  id: string;
  name: string;
  description: string | null;
  coverCardId: string | null;
  domain: string | null;
}> = {}) {
  return {
    id: overrides.id ?? DECK_ID,
    name: overrides.name ?? 'Fury Rush',
    description: overrides.description ?? 'A fast Fury aggro deck',
    coverCardId: overrides.coverCardId ?? CARD_ID_1,
    domain: overrides.domain ?? 'Fury',
    isPublic: true,
    userId: 'system',
    createdAt: new Date('2026-03-10T00:00:00Z'),
    updatedAt: new Date('2026-03-10T00:00:00Z'),
  };
}

function makeDeckCard(deckId: string, cardId: string, qty = 2) {
  return {
    deckId,
    cardId,
    quantity: qty,
    card_id: cardId,
    card_name: cardId === CARD_ID_1 ? 'Blazing Scorcher' : `Card ${cardId.slice(-1)}`,
    card_domain: 'Fury',
    card_imageSmall: null,
    card_imageSmall_2: null,
  };
}

function makeCollectionEntry(cardId: string) {
  return {
    cardId,
    card_domain: 'Fury',
    card_description: 'ACCELERATE',
  };
}

function makeCardPrice(cardId: string, marketPrice: string | null = '2.50') {
  return {
    cardId,
    card_name: `Card ${cardId.slice(-1)}`,
    card_imageSmall: null,
    marketPrice,
    foilMarketPrice: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckRecommendationsService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;
  let service: DeckRecommendationsService;

  beforeEach(() => {
    db = makeMockDb();
    redis = makeMockRedis();
    service = new DeckRecommendationsService(db as never, redis as never);
  });

  describe('getRecommendations()', () => {
    it('should return empty array when no decks exist in DB', async () => {
      // User collection
      db._pushSelect([makeCollectionEntry(CARD_ID_1)]);
      // Public decks
      db._pushSelect([]);

      const result = await service.getRecommendations(USER_ID);

      expect(result).toEqual([]);
    });

    it('should return recommendations sorted by ownership percentage descending', async () => {
      // User collection — owns CARD_ID_1 and CARD_ID_2
      db._pushSelect([makeCollectionEntry(CARD_ID_1), makeCollectionEntry(CARD_ID_2)]);

      // Deck 1: 4 cards total, user owns 2 (50%)
      // Deck 2: 4 cards total, user owns 0 (0%)
      const deck1 = makeDeck({ id: DECK_ID, name: 'Deck High Ownership' });
      const deck2 = makeDeck({ id: DECK_ID_2, name: 'Deck Low Ownership' });
      db._pushSelect([deck1, deck2]);

      // Deck cards for deck1 — 2 owned, 2 missing
      db._pushSelect([
        makeDeckCard(DECK_ID, CARD_ID_1, 2),
        makeDeckCard(DECK_ID, CARD_ID_2, 2),
        makeDeckCard(DECK_ID, CARD_ID_3, 2),
        makeDeckCard(DECK_ID, CARD_ID_4, 2),
      ]);
      // Deck cards for deck2 — user owns none
      db._pushSelect([
        makeDeckCard(DECK_ID_2, CARD_ID_3, 2),
        makeDeckCard(DECK_ID_2, CARD_ID_4, 2),
        makeDeckCard(DECK_ID_2, CARD_ID_5, 2),
        makeDeckCard(DECK_ID_2, CARD_ID_6, 2),
      ]);
      // Missing card prices for deck1
      db._pushSelect([makeCardPrice(CARD_ID_3), makeCardPrice(CARD_ID_4)]);
      // Missing card prices for deck2
      db._pushSelect([makeCardPrice(CARD_ID_3), makeCardPrice(CARD_ID_4), makeCardPrice(CARD_ID_5), makeCardPrice(CARD_ID_6)]);

      const result = await service.getRecommendations(USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0]!.ownershipPct).toBeGreaterThanOrEqual(result[1]!.ownershipPct);
      expect(result[0]!.deckName).toBe('Deck High Ownership');
    });

    it('should include missing cards with market prices in each recommendation', async () => {
      db._pushSelect([makeCollectionEntry(CARD_ID_1)]);

      const deck = makeDeck({ id: DECK_ID });
      db._pushSelect([deck]);

      // Deck has 2 cards, user owns 1
      db._pushSelect([
        makeDeckCard(DECK_ID, CARD_ID_1, 2),
        makeDeckCard(DECK_ID, CARD_ID_2, 2),
      ]);
      // Missing card price
      db._pushSelect([makeCardPrice(CARD_ID_2, '5.00')]);

      const result = await service.getRecommendations(USER_ID);

      expect(result).toHaveLength(1);
      const rec = result[0]!;
      expect(rec.missingCards).toHaveLength(1);
      expect(rec.missingCards[0]!.marketPrice).toBe('5.00');
    });

    it('should include non-empty synergy reasoning for each recommendation', async () => {
      db._pushSelect([makeCollectionEntry(CARD_ID_1)]);

      const deck = makeDeck({ id: DECK_ID, domain: 'Fury' });
      db._pushSelect([deck]);

      db._pushSelect([makeDeckCard(DECK_ID, CARD_ID_1, 2)]);
      db._pushSelect([]); // no missing cards

      const result = await service.getRecommendations(USER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]!.synergyReasoning).toBeTruthy();
      expect(typeof result[0]!.synergyReasoning).toBe('string');
      expect(result[0]!.synergyReasoning.length).toBeGreaterThan(0);
    });

    it('should return at most 5 recommendations', async () => {
      db._pushSelect([makeCollectionEntry(CARD_ID_1)]);

      // 7 decks
      const decks = Array.from({ length: 7 }, (_, i) =>
        makeDeck({ id: `40000000-0000-0000-0000-${(i + 1).toString().padStart(12, '0')}` }),
      );
      db._pushSelect(decks);

      // Each deck has 1 card matching user's collection
      for (const deck of decks) {
        db._pushSelect([makeDeckCard(deck.id, CARD_ID_1, 2)]);
        db._pushSelect([]); // no missing cards
      }

      const result = await service.getRecommendations(USER_ID);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should include ownedCards array in each recommendation', async () => {
      db._pushSelect([makeCollectionEntry(CARD_ID_1), makeCollectionEntry(CARD_ID_2)]);

      const deck = makeDeck({ id: DECK_ID });
      db._pushSelect([deck]);

      db._pushSelect([
        makeDeckCard(DECK_ID, CARD_ID_1, 2),
        makeDeckCard(DECK_ID, CARD_ID_2, 2),
        makeDeckCard(DECK_ID, CARD_ID_3, 2),
      ]);
      db._pushSelect([makeCardPrice(CARD_ID_3)]);

      const result = await service.getRecommendations(USER_ID);

      expect(result).toHaveLength(1);
      const rec = result[0]!;
      expect(rec.ownedCards).toBeDefined();
      expect(Array.isArray(rec.ownedCards)).toBe(true);
    });

    it('should return empty array gracefully when user has no collection', async () => {
      db._pushSelect([]); // empty collection
      db._pushSelect([]); // no decks

      const result = await service.getRecommendations(USER_ID);

      expect(result).toEqual([]);
    });
  });
});
