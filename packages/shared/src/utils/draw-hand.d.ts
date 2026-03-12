export interface HandCard {
    cardId: string;
    name: string;
    imageSmall: string | null;
}
/**
 * Draws a random opening hand from a pool of deck cards.
 *
 * CALLER CONTRACT: Only pass main-deck cards (zone === 'main').
 * Filtering by zone is the caller's responsibility.
 *
 * @param deckCards - Array of cards with cardId, quantity, name, and imageSmall.
 * @param handSize  - Number of cards to draw (default 4).
 * @returns         - Array of HandCard objects.
 */
export declare function drawHand(deckCards: Array<{
    cardId: string;
    quantity: number;
    name: string;
    imageSmall: string | null;
}>, handSize?: number): HandCard[];
