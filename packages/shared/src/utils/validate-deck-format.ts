import {
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  CHAMPION_COUNT,
  SIDEBOARD_SIZE,
  SIGNATURE_TYPES,
} from '../constants/card.constants';

export interface DeckFormatEntry {
  cardId: string;
  quantity: number;
  zone: string;
}

/**
 * Pure function — no Node or browser API dependencies.
 * Usable by both the server (deck.service.ts) and client (deck-card-editor.tsx).
 *
 * @param entries   Flat list of deck card entries with zone info.
 * @param cardTypeMap  Map from cardId to cardType string (or null for unknown).
 * @returns Array of human-readable error strings. Empty array means the deck is valid.
 */
export function validateDeckFormat(
  entries: DeckFormatEntry[],
  cardTypeMap: Map<string, string | null>,
): string[] {
  const errors: string[] = [];

  // Aggregate totals per zone
  const zoneTotals: Record<string, number> = {
    main: 0,
    rune: 0,
    champion: 0,
    sideboard: 0,
  };

  // Aggregate quantities per cardId (for copy-limit checking)
  // Rune zone is excluded from the 3-copy limit check (runes can repeat)
  const mainSideboardCopies: Map<string, number> = new Map();
  const allCopies: Map<string, number> = new Map();

  for (const entry of entries) {
    const zone = entry.zone ?? 'main';
    zoneTotals[zone] = (zoneTotals[zone] ?? 0) + entry.quantity;

    // Track copies across main + sideboard for the copy-limit rules
    if (zone === 'main' || zone === 'sideboard') {
      mainSideboardCopies.set(
        entry.cardId,
        (mainSideboardCopies.get(entry.cardId) ?? 0) + entry.quantity,
      );
    }

    allCopies.set(
      entry.cardId,
      (allCopies.get(entry.cardId) ?? 0) + entry.quantity,
    );
  }

  // Zone size checks
  if (zoneTotals['main'] !== MAIN_DECK_SIZE) {
    errors.push(`Main: ${zoneTotals['main']}/${MAIN_DECK_SIZE}`);
  }

  if (zoneTotals['rune'] !== RUNE_DECK_SIZE) {
    errors.push(`Runes: ${zoneTotals['rune']}/${RUNE_DECK_SIZE}`);
  }

  if (zoneTotals['champion'] !== CHAMPION_COUNT) {
    errors.push(`Need 1 champion`);
  }

  if (zoneTotals['sideboard'] !== 0 && zoneTotals['sideboard'] !== SIDEBOARD_SIZE) {
    errors.push(`Sideboard: ${zoneTotals['sideboard']} (must be 0 or ${SIDEBOARD_SIZE})`);
  }

  // Copy-limit checks (main + sideboard only)
  for (const [cardId, total] of mainSideboardCopies) {
    const cardType = cardTypeMap.get(cardId) ?? null;
    const isSignature = cardType !== null && (SIGNATURE_TYPES as readonly string[]).includes(cardType);

    if (isSignature && total > MAX_SIGNATURE_COPIES) {
      const cardName = cardId; // Caller can enrich errors if needed
      errors.push(`Signature card limit: 1 copy (cardId: ${cardName})`);
    } else if (!isSignature && total > MAX_COPIES_PER_CARD) {
      errors.push(`Too many copies of cardId: ${cardId} (${total}/${MAX_COPIES_PER_CARD})`);
    }
  }

  return errors;
}
