import {
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  LEGEND_COUNT,
  CHAMPION_COUNT,
  BATTLEFIELD_COUNT,
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
 * @param domainMap  Optional map from cardId to domain string. When provided,
 *                   signature cards are validated against the legend's domain.
 * @returns Array of human-readable error strings. Empty array means the deck is valid.
 */
export function validateDeckFormat(
  entries: DeckFormatEntry[],
  cardTypeMap: Map<string, string | null>,
  domainMap?: Map<string, string | null>,
): string[] {
  const errors: string[] = [];

  // Aggregate totals per zone
  const zoneTotals: Record<string, number> = {
    main: 0,
    rune: 0,
    legend: 0,
    champion: 0,
    battlefield: 0,
    sideboard: 0,
  };

  // Aggregate quantities per cardId (for copy-limit checking)
  // Rune zone is excluded from the 3-copy limit check (runes can repeat)
  const mainSideboardCopies: Map<string, number> = new Map();

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
  }

  // Main zone must be exactly 40. Sideboard is optional (0-8).
  const mainZoneCount = zoneTotals['main'] ?? 0;
  const sideboardZoneCount = zoneTotals['sideboard'] ?? 0;
  if (mainZoneCount !== MAIN_DECK_SIZE) {
    errors.push(`Main deck: ${mainZoneCount}/${MAIN_DECK_SIZE}`);
  }
  if (sideboardZoneCount > SIDEBOARD_SIZE) {
    errors.push(`Sideboard: ${sideboardZoneCount}/${SIDEBOARD_SIZE}`);
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

  // Copy-limit checks (main + sideboard only) — all cards share the same 3-copy limit
  for (const [cardId, total] of mainSideboardCopies) {
    if (total > MAX_COPIES_PER_CARD) {
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
        const isSignature = cardType !== null && (SIGNATURE_TYPES as readonly string[]).includes(cardType);
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
