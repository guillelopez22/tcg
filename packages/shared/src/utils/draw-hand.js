"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drawHand = void 0;
/**
 * Draws a random opening hand from a pool of deck cards.
 *
 * CALLER CONTRACT: Only pass main-deck cards (zone === 'main').
 */
function drawHand(deckCards, handSize = 4) {
    // Expand each card by its quantity into individual pool slots
    const pool = [];
    for (const card of deckCards) {
        for (let i = 0; i < card.quantity; i++) {
            pool.push({ cardId: card.cardId, name: card.name, imageSmall: card.imageSmall });
        }
    }
    // Fisher-Yates shuffle (in-place)
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
    }
    return pool.slice(0, Math.min(handSize, pool.length));
}
exports.drawHand = drawHand;
