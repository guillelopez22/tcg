'use client';

// Stats charts — recharts visualizations for value breakdown and rarity distribution.
// Both charts use ResponsiveContainer for mobile-first responsiveness.

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

interface SetValueEntry {
  setId: string;
  setName: string;
  totalValue: number;
}

interface RarityDistribution {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
}

interface SetValueChartProps {
  data: SetValueEntry[];
}

interface RarityChartProps {
  data: RarityDistribution;
}

const VALUE_CHART_COLOR = '#7c3aed';

const RARITY_COLORS: Record<string, string> = {
  Common: '#71717a',
  Uncommon: '#22c55e',
  Rare: '#3b82f6',
  Epic: '#a855f7',
};

export function SetValueChart({ data }: SetValueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
        No value data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: d.setName.replace('Origins: ', 'OPG: ').replace('Spiritforged', 'SF'),
    value: d.totalValue,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            color: '#f4f4f5',
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill={VALUE_CHART_COLOR} radius={[4, 4, 0, 0]} maxBarSize={60} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RarityChart({ data }: RarityChartProps) {
  const chartData = [
    { name: 'Common', value: data.common },
    { name: 'Uncommon', value: data.uncommon },
    { name: 'Rare', value: data.rare },
    { name: 'Epic', value: data.epic },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
        No cards in collection yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          paddingAngle={3}
          dataKey="value"
          label={({ name, value }: PieLabelRenderProps) => `${name ?? ''}: ${String(value ?? '')}`}
          labelLine={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={RARITY_COLORS[entry.name] ?? '#71717a'} />
          ))}
        </Pie>
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
          iconType="circle"
          iconSize={8}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            color: '#f4f4f5',
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
