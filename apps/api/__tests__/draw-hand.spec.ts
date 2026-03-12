import { describe, it, expect } from 'vitest';
import { drawHand } from '@la-grieta/shared';

describe('drawHand', () => {
  it('returns 3 cards when pool has only 3 (smaller than hand size)', () => {
    const pool = [
      { cardId: 'a', quantity: 1, name: 'Card A', imageSmall: null },
      { cardId: 'b', quantity: 1, name: 'Card B', imageSmall: null },
      { cardId: 'c', quantity: 1, name: 'Card C', imageSmall: null },
    ];
    const hand = drawHand(pool, 4);
    expect(hand).toHaveLength(3);
  });

  it('returns exactly 4 cards from a 40-card pool', () => {
    // Build a pool with 10 unique cards, 4 copies each = 40 total
    const pool = Array.from({ length: 10 }, (_, i) => ({
      cardId: `card-${i}`,
      quantity: 4,
      name: `Card ${i}`,
      imageSmall: null,
    }));
    const hand = drawHand(pool, 4);
    expect(hand).toHaveLength(4);
  });

  it('returns only HandCard objects with cardId, name, imageSmall keys', () => {
    const pool = [
      { cardId: 'a', quantity: 2, name: 'Card A', imageSmall: 'http://example.com/a.jpg' },
      { cardId: 'b', quantity: 2, name: 'Card B', imageSmall: null },
    ];
    const hand = drawHand(pool, 2);
    for (const card of hand) {
      expect(card).toHaveProperty('cardId');
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('imageSmall');
      expect(card).not.toHaveProperty('quantity');
      expect(card).not.toHaveProperty('zone');
    }
  });

  it('returns empty array when pool is empty', () => {
    const hand = drawHand([], 4);
    expect(hand).toHaveLength(0);
  });
});
