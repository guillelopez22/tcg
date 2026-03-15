'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const PIE_COLORS = ['#f87171', '#4ade80', '#60a5fa', '#fb923c', '#c084fc', '#facc15', '#94a3b8'];

interface DeckAnalyticsProps {
  energyCurveData: { cost: string; count: number }[];
  domainPieData: { name: string; value: number }[];
}

export function DeckAnalyticsMini({ energyCurveData, domainPieData }: DeckAnalyticsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">Analytics</p>
      <div className="flex gap-3 items-end">
        {/* Energy curve bar chart */}
        <div className="flex-1">
          <p className="text-[10px] text-zinc-600 mb-1">Energy curve</p>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={energyCurveData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="cost" tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Bar dataKey="count" fill="#7c3aed" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Domain donut */}
        {domainPieData.length > 0 && (
          <div className="flex-shrink-0">
            <p className="text-[10px] text-zinc-600 mb-1">Domains</p>
            <PieChart width={80} height={80}>
              <Pie
                data={domainPieData}
                cx={35}
                cy={35}
                innerRadius={20}
                outerRadius={35}
                dataKey="value"
                strokeWidth={0}
              >
                {domainPieData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '6px', fontSize: '10px' }}
                itemStyle={{ color: '#d4d4d8' }}
              />
            </PieChart>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auto-complete preview modal (inlined here since it's analytics-adjacent)
// ---------------------------------------------------------------------------

const REASON_TAG_COLORS: Record<string, string> = {
  'Meta pick': 'bg-purple-900/50 text-purple-300 border-purple-700/50',
  'Curve filler': 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  'Domain match': 'bg-green-900/50 text-green-300 border-green-700/50',
  'Owned': 'bg-rift-900/50 text-rift-300 border-rift-700/50',
  'Synergy': 'bg-amber-900/50 text-amber-300 border-amber-700/50',
};

function getReasonTagColor(tag: string): string {
  for (const [key, cls] of Object.entries(REASON_TAG_COLORS)) {
    if (tag.startsWith(key)) return cls;
  }
  return 'bg-zinc-800/50 text-zinc-300 border-zinc-700/50';
}

interface AutoCompletePreviewCard {
  cardId: string;
  name: string;
  reasonTag: string;
}

interface AutoCompletePreviewProps {
  zoneLabel: string;
  cards: AutoCompletePreviewCard[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function AutoCompletePreviewPanel({ zoneLabel, cards, onConfirm, onCancel }: AutoCompletePreviewProps) {
  return (
    <div className="lg-card border-rift-700/40 px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          Fill {cards.length} {zoneLabel} slots?
        </h3>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 p-0.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto">
        {cards.map((card) => {
          const tagColor = getReasonTagColor(card.reasonTag);
          return (
            <li key={card.cardId} className="flex items-center gap-2">
              <span className="text-sm text-white flex-1 truncate">{card.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${tagColor}`}>
                {card.reasonTag}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2">
        <button onClick={onConfirm} className="lg-btn-primary flex-1 py-2 text-sm">
          Confirm
        </button>
        <button onClick={onCancel} className="lg-btn-ghost flex-1 py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
