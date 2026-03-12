'use client';

/**
 * DeckAnalytics — full analytics component for a deck.
 * Uses computeAnalytics from @la-grieta/shared (tested in deck-analytics.spec.ts).
 * Renders 5 sections: Energy Curve, Domain Distribution, Card Type Breakdown,
 * Rarity Distribution, Estimated Market Value.
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  type PieLabelRenderProps,
} from 'recharts';
import { computeAnalytics } from '@la-grieta/shared';

// Re-export for use by tests importing directly from this file
export { computeAnalytics };

interface DeckCard {
  quantity: number;
  card: {
    energyCost: number | null;
    domain: string | null;
    cardType: string | null;
    rarity: string;
  };
}

interface DeckAnalyticsProps {
  cards: DeckCard[];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '8px',
  color: '#f4f4f5',
  fontSize: 12,
} as const;

const ENERGY_COLOR = '#7c3aed';

const DOMAIN_HEX: Record<string, string> = {
  Fury: '#f87171',
  Calm: '#4ade80',
  Mind: '#60a5fa',
  Body: '#fb923c',
  Chaos: '#c084fc',
  Order: '#facc15',
  Neutral: '#71717a',
};

const RARITY_HEX: Record<string, string> = {
  Common: '#71717a',
  Uncommon: '#22c55e',
  Rare: '#3b82f6',
  Epic: '#a855f7',
  Showcase: '#f59e0b',
  'Alternate Art': '#f59e0b',
  Overnumbered: '#fb7185',
};

// Ordered energy cost buckets for the X axis
const ENERGY_BUCKETS = ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{children}</h3>;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">{message}</div>
  );
}

export function DeckAnalytics({ cards }: DeckAnalyticsProps) {
  // Build AnalyticsCard shape expected by computeAnalytics
  const analyticsCards = cards.map((entry) => ({
    energyCost: entry.card.energyCost,
    domain: entry.card.domain,
    quantity: entry.quantity,
  }));

  const { energyCurve, domainDistribution } = computeAnalytics(analyticsCards);

  // Energy curve chart data — all buckets shown even if 0
  const energyData = ENERGY_BUCKETS.map((bucket) => ({
    cost: bucket,
    count: energyCurve[bucket === '8+' ? '8+' : Number(bucket)] ?? 0,
  }));

  // Domain distribution chart data
  const domainData = Object.entries(domainDistribution)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Card type breakdown
  const cardTypeMap: Record<string, number> = {};
  for (const entry of cards) {
    const type = entry.card.cardType ?? 'Unknown';
    cardTypeMap[type] = (cardTypeMap[type] ?? 0) + entry.quantity;
  }
  const cardTypeData = Object.entries(cardTypeMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Rarity distribution
  const rarityMap: Record<string, number> = {};
  for (const entry of cards) {
    const rarity = entry.card.rarity ?? 'Unknown';
    rarityMap[rarity] = (rarityMap[rarity] ?? 0) + entry.quantity;
  }
  const rarityData = Object.entries(rarityMap)
    .map(([name, count]) => ({ name, count }))
    .filter((d) => d.count > 0);

  const totalCards = cards.reduce((sum, e) => sum + e.quantity, 0);

  if (totalCards === 0) {
    return (
      <div className="text-center py-8 text-zinc-500 text-sm">
        Add cards to this deck to see analytics.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Energy Curve */}
      <div>
        <SectionTitle>Energy Curve</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={energyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="cost"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" fill={ENERGY_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Domain Distribution */}
      <div>
        <SectionTitle>Domain Distribution</SectionTitle>
        {domainData.length === 0 ? (
          <EmptyChart message="No domain data" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={domainData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="count"
                label={({ name, value }: PieLabelRenderProps) =>
                  `${String(name ?? '')}: ${String(value ?? '')}`
                }
                labelLine={false}
              >
                {domainData.map((entry) => (
                  <Cell key={entry.name} fill={DOMAIN_HEX[entry.name] ?? '#71717a'} />
                ))}
              </Pie>
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
                iconType="circle"
                iconSize={8}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Card Type Breakdown */}
      <div>
        <SectionTitle>Card Type Breakdown</SectionTitle>
        {cardTypeData.length === 0 ? (
          <EmptyChart message="No type data" />
        ) : (
          <div className="space-y-2">
            {cardTypeData.map(({ name, count }) => {
              const pct = Math.round((count / totalCards) * 100);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-20 flex-shrink-0">{name}</span>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-12 text-right flex-shrink-0">
                    {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rarity Distribution */}
      <div>
        <SectionTitle>Rarity Distribution</SectionTitle>
        {rarityData.length === 0 ? (
          <EmptyChart message="No rarity data" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={rarityData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="count"
                label={({ name, value }: PieLabelRenderProps) =>
                  `${String(name ?? '')}: ${String(value ?? '')}`
                }
                labelLine={false}
              >
                {rarityData.map((entry) => (
                  <Cell key={entry.name} fill={RARITY_HEX[entry.name] ?? '#71717a'} />
                ))}
              </Pie>
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
                iconType="circle"
                iconSize={8}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Estimated Market Value */}
      <div>
        <SectionTitle>Estimated Market Value</SectionTitle>
        <p className="text-sm text-zinc-400">
          Price data unavailable — market value will appear here once pricing is integrated.
        </p>
      </div>
    </div>
  );
}
