/**
 * Pure function for computing deck analytics.
 * No Node or browser API dependencies — usable by server and client.
 */
/**
 * Compute energy curve and domain distribution from a list of deck cards.
 * Quantities are respected (a card with quantity 3 counts as 3).
 */
export function computeAnalytics(cards) {
    const energyCurve = {};
    const domainDistribution = {};
    for (const card of cards) {
        const qty = card.quantity ?? 1;
        // Energy curve bucketing
        const cost = card.energyCost ?? 0;
        const bucket = cost >= 8 ? '8+' : cost;
        energyCurve[bucket] = (energyCurve[bucket] ?? 0) + qty;
        // Domain distribution
        const domain = card.domain ?? 'Neutral';
        domainDistribution[domain] = (domainDistribution[domain] ?? 0) + qty;
    }
    return { energyCurve, domainDistribution };
}
