/**
 * Pure function for computing deck analytics.
 * No Node or browser API dependencies — usable by server and client.
 */

export interface AnalyticsCard {
  energyCost: number | null;
  domain: string | null;
  quantity: number;
}

export interface DeckAnalytics {
  /** Map of energy cost bucket to card count (0-7 individually, '8+' for 8 and above) */
  energyCurve: Record<string | number, number>;
  /** Map of domain name to card count ('Neutral' for null domain) */
  domainDistribution: Record<string, number>;
}

/**
 * Compute energy curve and domain distribution from a list of deck cards.
 * Quantities are respected (a card with quantity 3 counts as 3).
 */
export function computeAnalytics(cards: AnalyticsCard[]): DeckAnalytics {
  const energyCurve: Record<string | number, number> = {};
  const domainDistribution: Record<string, number> = {};

  for (const card of cards) {
    const qty = card.quantity ?? 1;

    // Energy curve bucketing
    const cost = card.energyCost ?? 0;
    const bucket: string | number = cost >= 8 ? '8+' : cost;
    energyCurve[bucket] = (energyCurve[bucket] ?? 0) + qty;

    // Domain distribution
    const domain = card.domain ?? 'Neutral';
    domainDistribution[domain] = (domainDistribution[domain] ?? 0) + qty;
  }

  return { energyCurve, domainDistribution };
}
