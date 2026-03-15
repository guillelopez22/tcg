import { MAX_COPIES_PER_CARD, MAX_SIGNATURE_COPIES, MAIN_DECK_SIZE, RUNE_DECK_SIZE, LEGEND_COUNT, CHAMPION_COUNT, BATTLEFIELD_COUNT, SIDEBOARD_SIZE, SIGNATURE_TYPES, } from '../constants/card.constants';
/**
 * Pure function — no Node or browser API dependencies.
 * Usable by both the server (deck.service.ts) and client (deck-card-editor.tsx).
 *
 * @param entries   Flat list of deck card entries with zone info.
 * @param cardTypeMap  Map from cardId to cardType string (or null for unknown).
 * @param domainMap  Optional map from cardId to domain string. When provided,
 *                   signature cards are validated against the legend's domain.
 * @returns Array of human-readable error strings. Empty array means the deck is valid.
 */
export function validateDeckFormat(entries, cardTypeMap, domainMap) {
    const errors = [];
    // Aggregate totals per zone
    const zoneTotals = {
        main: 0,
        rune: 0,
        legend: 0,
        champion: 0,
        battlefield: 0,
        sideboard: 0,
    };
    // Aggregate quantities per cardId (for copy-limit checking)
    // Rune zone is excluded from the 3-copy limit check (runes can repeat)
    const mainSideboardCopies = new Map();
    for (const entry of entries) {
        const zone = entry.zone ?? 'main';
        zoneTotals[zone] = (zoneTotals[zone] ?? 0) + entry.quantity;
        // Track copies across main + sideboard for the copy-limit rules
        if (zone === 'main' || zone === 'sideboard') {
            mainSideboardCopies.set(entry.cardId, (mainSideboardCopies.get(entry.cardId) ?? 0) + entry.quantity);
        }
    }
    // Main deck = main + sideboard. Champion is a separate zone (1 card).
    // We accept 40 (no sideboard) or 48 (40 + 8 sideboard).
    const mainPool = (zoneTotals['main'] ?? 0) + (zoneTotals['sideboard'] ?? 0);
    const mainWithoutSideboard = MAIN_DECK_SIZE;
    const mainWithSideboard = MAIN_DECK_SIZE + SIDEBOARD_SIZE;
    if (mainPool !== mainWithoutSideboard && mainPool !== mainWithSideboard) {
        errors.push(`Main deck: ${mainPool}/${mainWithoutSideboard} (or ${mainWithSideboard} with sideboard)`);
    }
    // Legend: exactly 1
    if (zoneTotals['legend'] !== LEGEND_COUNT) {
        errors.push(`Need 1 legend`);
    }
    // Champion: exactly 1 (part of main deck but tracked separately)
    if (zoneTotals['champion'] !== CHAMPION_COUNT) {
        errors.push(`Need 1 champion`);
    }
    // Runes: exactly 12
    if (zoneTotals['rune'] !== RUNE_DECK_SIZE) {
        errors.push(`Runes: ${zoneTotals['rune']}/${RUNE_DECK_SIZE}`);
    }
    // Battlefields: exactly 3
    if (zoneTotals['battlefield'] !== BATTLEFIELD_COUNT) {
        errors.push(`Battlefields: ${zoneTotals['battlefield']}/${BATTLEFIELD_COUNT}`);
    }
    // Copy-limit checks (main + sideboard only)
    for (const [cardId, total] of mainSideboardCopies) {
        const cardType = cardTypeMap.get(cardId) ?? null;
        const isSignature = cardType !== null && SIGNATURE_TYPES.includes(cardType);
        if (isSignature && total > MAX_SIGNATURE_COPIES) {
            errors.push(`Signature card limit: 1 copy (cardId: ${cardId})`);
        }
        else if (!isSignature && total > MAX_COPIES_PER_CARD) {
            errors.push(`Too many copies of cardId: ${cardId} (${total}/${MAX_COPIES_PER_CARD})`);
        }
    }
    // Signature cards must match the legend's domain
    if (domainMap) {
        const legendEntry = entries.find((e) => e.zone === 'legend');
        const legendDomain = legendEntry ? domainMap.get(legendEntry.cardId) : null;
        if (legendDomain) {
            for (const entry of entries) {
                const cardType = cardTypeMap.get(entry.cardId) ?? null;
                const isSignature = cardType !== null && SIGNATURE_TYPES.includes(cardType);
                if (!isSignature) continue;
                const cardDomain = domainMap.get(entry.cardId);
                if (cardDomain && cardDomain !== legendDomain) {
                    errors.push(`Signature card doesn't match legend's domain (cardId: ${entry.cardId})`);
                }
            }
        }
    }
    return errors;
}
