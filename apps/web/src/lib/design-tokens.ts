export const RARITY_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  Common: { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' },
  Uncommon: { text: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-800', glow: 'hover:shadow-green-500/10' },
  Rare: { text: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-800', glow: 'hover:shadow-blue-500/20' },
  Epic: { text: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-800', glow: 'hover:shadow-purple-500/30' },
  Showcase: { text: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-800', glow: 'hover:shadow-amber-500/20' },
  'Alternate Art': { text: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-800', glow: 'hover:shadow-amber-500/20' },
  Overnumbered: { text: 'text-rose-400', bg: 'bg-rose-900/30', border: 'border-rose-800', glow: 'hover:shadow-rose-500/20' },
};

export const DOMAIN_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Fury: { text: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700' },
  Calm: { text: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700' },
  Mind: { text: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-700' },
  Body: { text: 'text-orange-400', bg: 'bg-orange-900/30', border: 'border-orange-700' },
  Chaos: { text: 'text-purple-400', bg: 'bg-purple-900/30', border: 'border-purple-700' },
  Order: { text: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700' },
};
