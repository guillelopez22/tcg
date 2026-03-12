import { describe, it, expect } from 'vitest';
import { computeAnalytics } from '../../packages/shared/src/utils/compute-analytics';

interface AnalyticsCard {
  energyCost: number | null;
  domain: string | null;
  quantity: number;
}

describe('computeAnalytics()', () => {
  it('groups energy costs into correct buckets (0-7, 8+)', () => {
    const cards: AnalyticsCard[] = [
      { energyCost: 1, domain: 'Fury', quantity: 1 },
      { energyCost: 2, domain: 'Fury', quantity: 1 },
      { energyCost: 2, domain: 'Fury', quantity: 1 },
      { energyCost: 3, domain: 'Fury', quantity: 1 },
      { energyCost: 5, domain: 'Fury', quantity: 1 },
      { energyCost: 8, domain: 'Fury', quantity: 1 },
      { energyCost: 10, domain: 'Fury', quantity: 1 },
    ];

    const result = computeAnalytics(cards);

    expect(result.energyCurve[1]).toBe(1);
    expect(result.energyCurve[2]).toBe(2);
    expect(result.energyCurve[3]).toBe(1);
    expect(result.energyCurve[5]).toBe(1);
    expect(result.energyCurve['8+']).toBe(2); // 8 and 10 both in 8+ bucket
  });

  it('aggregates domain distribution with null mapped to "Neutral"', () => {
    const cards: AnalyticsCard[] = [
      { energyCost: 1, domain: 'Fire', quantity: 1 },
      { energyCost: 2, domain: 'Fire', quantity: 1 },
      { energyCost: 3, domain: 'Water', quantity: 1 },
      { energyCost: 4, domain: null, quantity: 1 },
    ];

    const result = computeAnalytics(cards);

    expect(result.domainDistribution['Fire']).toBe(2);
    expect(result.domainDistribution['Water']).toBe(1);
    expect(result.domainDistribution['Neutral']).toBe(1);
  });

  it('handles cards with null energyCost (treated as 0 in curve)', () => {
    const cards: AnalyticsCard[] = [
      { energyCost: null, domain: 'Fury', quantity: 1 },
      { energyCost: null, domain: 'Fury', quantity: 1 },
    ];

    const result = computeAnalytics(cards);

    expect(result.energyCurve[0]).toBe(2);
  });

  it('handles empty card array — returns empty distributions', () => {
    const result = computeAnalytics([]);

    expect(Object.keys(result.energyCurve)).toHaveLength(0);
    expect(Object.keys(result.domainDistribution)).toHaveLength(0);
  });

  it('multiplies quantities > 1 in counts', () => {
    const cards: AnalyticsCard[] = [
      { energyCost: 2, domain: 'Fury', quantity: 3 },
    ];

    const result = computeAnalytics(cards);

    expect(result.energyCurve[2]).toBe(3);
    expect(result.domainDistribution['Fury']).toBe(3);
  });

  it('groups energy costs 0-7 individually and 8+ as single bucket', () => {
    const cards: AnalyticsCard[] = [
      { energyCost: 0, domain: null, quantity: 1 },
      { energyCost: 7, domain: null, quantity: 1 },
      { energyCost: 8, domain: null, quantity: 1 },
      { energyCost: 15, domain: null, quantity: 1 },
    ];

    const result = computeAnalytics(cards);

    expect(result.energyCurve[0]).toBe(1);
    expect(result.energyCurve[7]).toBe(1);
    expect(result.energyCurve['8+']).toBe(2);
    expect(result.energyCurve[8]).toBeUndefined();
    expect(result.energyCurve[15]).toBeUndefined();
  });
});
