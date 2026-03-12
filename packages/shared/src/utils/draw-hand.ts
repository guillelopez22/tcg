/**
 * drawHand — Pure utility for simulating an opening hand draw.
 *
 * CALLER CONTRACT: Only pass main-deck cards (zone === 'main').
 * Filtering by zone is the caller's responsibility.
 */

export interface HandCard {
  cardId: string;
  name: string;
  imageSmall: string | null;
}

/**
 * Draws a random opening hand from a pool of deck cards.
 *
 * @param deckCards - Array of cards with cardId, quantity, name, and imageSmall.
 *                   Each card is expanded by its quantity into individual pool entries.
 *                   Should only contain main-deck cards.
 * @param handSize  - Number of cards to draw (default 4). If the total pool is smaller
 *                   than handSize, all pool entries are returned (shuffled).
 * @returns         - Array of HandCard objects (no zone, no quantity).
 */
export function drawHand(
  deckCards: Array<{ cardId: string; quantity: number; name: string; imageSmall: string | null }>,
  handSize = 4,
): HandCard[] {
  // Expand each card by its quantity into individual pool slots
  const pool: HandCard[] = [];
  for (const card of deckCards) {
    for (let i = 0; i < card.quantity; i++) {
      pool.push({ cardId: card.cardId, name: card.name, imageSmall: card.imageSmall });
    }
  }

  // Fisher-Yates shuffle (in-place)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = temp;
  }

  return pool.slice(0, Math.min(handSize, pool.length));
}
