"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDeckFormat = void 0;
const card_constants_1 = require("../constants/card.constants");
function validateDeckFormat(entries, cardTypeMap) {
    const errors = [];
    const zoneTotals = {
        main: 0,
        rune: 0,
        champion: 0,
        sideboard: 0,
    };
    const mainSideboardCopies = new Map();
    const allCopies = new Map();
    for (const entry of entries) {
        const zone = entry.zone || 'main';
        zoneTotals[zone] = (zoneTotals[zone] || 0) + entry.quantity;
        if (zone === 'main' || zone === 'sideboard') {
            mainSideboardCopies.set(entry.cardId, (mainSideboardCopies.get(entry.cardId) || 0) + entry.quantity);
        }
        allCopies.set(entry.cardId, (allCopies.get(entry.cardId) || 0) + entry.quantity);
    }
    if (zoneTotals['main'] !== card_constants_1.MAIN_DECK_SIZE) {
        errors.push(`Main: ${zoneTotals['main']}/${card_constants_1.MAIN_DECK_SIZE}`);
    }
    if (zoneTotals['rune'] !== card_constants_1.RUNE_DECK_SIZE) {
        errors.push(`Runes: ${zoneTotals['rune']}/${card_constants_1.RUNE_DECK_SIZE}`);
    }
    if (zoneTotals['champion'] !== card_constants_1.CHAMPION_COUNT) {
        errors.push(`Need 1 champion`);
    }
    if (zoneTotals['sideboard'] !== 0 && zoneTotals['sideboard'] !== card_constants_1.SIDEBOARD_SIZE) {
        errors.push(`Sideboard: ${zoneTotals['sideboard']} (must be 0 or ${card_constants_1.SIDEBOARD_SIZE})`);
    }
    for (const [cardId, total] of mainSideboardCopies) {
        const cardType = cardTypeMap.get(cardId) || null;
        const isSignature = cardType !== null && card_constants_1.SIGNATURE_TYPES.includes(cardType);
        if (isSignature && total > card_constants_1.MAX_SIGNATURE_COPIES) {
            errors.push(`Signature card limit: 1 copy (cardId: ${cardId})`);
        } else if (!isSignature && total > card_constants_1.MAX_COPIES_PER_CARD) {
            errors.push(`Too many copies of cardId: ${cardId} (${total}/${card_constants_1.MAX_COPIES_PER_CARD})`);
        }
    }
    return errors;
}
exports.validateDeckFormat = validateDeckFormat;
