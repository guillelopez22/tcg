// Pure helper functions for the deck wizard (no React imports)

import { SIGNATURE_TYPES } from '@la-grieta/shared';
import { DOMAIN_COLORS } from '@/lib/design-tokens';
import {
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  BATTLEFIELD_COUNT,
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
} from '@la-grieta/shared';
import type { DeckZone } from '@la-grieta/shared';
import { FALLBACK_DOMAIN, RARITY_PRIORITY } from './wizard-types';
import type { LegendCard, CardItem, DeckEntry } from './wizard-types';

export function parseDomains(domain: string | null): [string, string] | [string] {
  if (!domain) return [''];
  const parts = domain.split(/[;/]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [''];
  return parts as [string, string] | [string];
}

export function isSignatureCard(cardType: string | null | undefined): boolean {
  return SIGNATURE_TYPES.includes((cardType ?? '') as (typeof SIGNATURE_TYPES)[number]);
}

export function getDomainBadge(domain: string): string {
  const colors = DOMAIN_COLORS[domain] ?? FALLBACK_DOMAIN;
  return `${colors.text} ${colors.bg} ${colors.border}`;
}

export function rarityScore(rarity: string | null | undefined): number {
  if (!rarity) return 99;
  return RARITY_PRIORITY[rarity] ?? 99;
}

// ---------------------------------------------------------------------------
// Auto-build algorithm
// ---------------------------------------------------------------------------

export function autoBuildEntries(
  legend: LegendCard,
  domainCards: CardItem[],
): DeckEntry[] {
  const legendDomains = parseDomains(legend.domain);
  const legendDomain = legend.domain;

  const entries: DeckEntry[] = [];

  const addEntry = (card: CardItem, qty: number, zone: DeckZone) => {
    entries.push({ card, quantity: qty, zone });
  };

  const EXCLUDED = new Set(['Legend', 'Token']);
  const eligible = domainCards.filter(
    (c) => !EXCLUDED.has(c.cardType ?? '') && c.id !== legend.id,
  );

  const sorted = [...eligible].sort((a, b) => rarityScore(a.rarity) - rarityScore(b.rarity));

  // ---- 1. Champion Unit ----
  const championCandidates = sorted.filter((c) => c.cardType === 'Champion Unit');
  if (championCandidates.length > 0) {
    addEntry(championCandidates[0]!, 1, 'champion');
  }

  // ---- 2. Rune deck (12 runes) ----
  const runeCandidates = sorted.filter((c) => c.cardType === 'Rune');
  let runeTotal = 0;
  for (const card of runeCandidates) {
    if (runeTotal >= RUNE_DECK_SIZE) break;
    const qty = Math.min(3, RUNE_DECK_SIZE - runeTotal);
    addEntry(card, qty, 'rune');
    runeTotal += qty;
  }

  // ---- 3. Battlefields (3 unique) ----
  const bfCandidates = sorted.filter((c) => c.cardType === 'Battlefield');
  const bfAdded = new Set<string>();
  for (const card of bfCandidates) {
    if (bfAdded.size >= BATTLEFIELD_COUNT) break;
    if ([...bfAdded].some((id) => eligible.find((c) => c.id === id)?.name === card.name)) continue;
    addEntry(card, 1, 'battlefield');
    bfAdded.add(card.id);
  }

  // ---- 4. Main deck (40 cards) ----
  const signatureCandidates = sorted.filter(
    (c) => isSignatureCard(c.cardType) && c.domain === legendDomain,
  );
  const mainExcluded = new Set(['Rune', 'Battlefield', 'Legend', 'Token', 'Champion Unit']);
  const mainCandidates = sorted.filter(
    (c) => !mainExcluded.has(c.cardType ?? '') && !isSignatureCard(c.cardType),
  );

  let mainTotal = 0;
  const mainAdded = new Map<string, number>();

  for (const card of signatureCandidates) {
    if (mainTotal >= MAIN_DECK_SIZE) break;
    addEntry(card, 1, 'main');
    mainAdded.set(card.id, 1);
    mainTotal += 1;
  }

  const domain0Cards = mainCandidates.filter((c) =>
    parseDomains(c.domain || null).includes(legendDomains[0] as string),
  );
  const domain1Cards = legendDomains[1]
    ? mainCandidates.filter(
        (c) =>
          parseDomains(c.domain || null).includes(legendDomains[1] as string) &&
          !parseDomains(c.domain || null).includes(legendDomains[0] as string),
      )
    : [];

  const fillPools = domain1Cards.length > 0 ? [domain0Cards, domain1Cards] : [domain0Cards];
  let poolIdx = 0;
  const seenInFill = new Set<string>(mainAdded.keys());

  let progress = true;
  while (mainTotal < MAIN_DECK_SIZE && progress) {
    progress = false;
    for (let pass = 0; pass < fillPools.length && mainTotal < MAIN_DECK_SIZE; pass++) {
      const pool = fillPools[(poolIdx + pass) % fillPools.length]!;
      for (const card of pool) {
        if (mainTotal >= MAIN_DECK_SIZE) break;
        if (seenInFill.has(card.id)) {
          const existing = mainAdded.get(card.id) ?? 0;
          const maxCopies = isSignatureCard(card.cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;
          if (existing < maxCopies) {
            const entry = entries.find((e) => e.card.id === card.id && e.zone === 'main');
            if (entry) {
              entry.quantity += 1;
              mainAdded.set(card.id, existing + 1);
              mainTotal += 1;
              progress = true;
            }
          }
        } else {
          seenInFill.add(card.id);
          addEntry(card, 1, 'main');
          mainAdded.set(card.id, 1);
          mainTotal += 1;
          progress = true;
        }
      }
    }
    poolIdx = (poolIdx + 1) % fillPools.length;
  }

  return entries;
}
