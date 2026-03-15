// Shared types and constants for the deck wizard

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';
import type { DeckZone } from '@la-grieta/shared';

export type RouterOutput = inferRouterOutputs<AppRouter>;
export type LegendCard = RouterOutput['card']['legends'][number];
export type CardItem = RouterOutput['card']['list']['items'][number];

export type Step = 'name' | 'legend' | 'method' | 'build' | 'review';
export type BuildMethod = 'manual' | 'import' | 'auto';
export type ImportTab = 'text' | 'url' | 'code';
export type BrowserTab = 'main' | 'rune' | 'battlefield' | 'sideboard';

export interface DeckEntry {
  card: CardItem;
  quantity: number;
  zone: DeckZone;
}

export interface DeckWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const STEPS: { id: Step; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'legend', label: 'Legend' },
  { id: 'method', label: 'Method' },
  { id: 'build', label: 'Build' },
  { id: 'review', label: 'Review' },
];

export const FALLBACK_DOMAIN = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700' };

export const MAIN_CARD_TYPES = [
  'Unit', 'Champion Unit', 'Spell', 'Gear',
  'Signature Unit', 'Signature Spell', 'Signature Gear',
] as const;

export const RARITY_PRIORITY: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Showcase: 4,
  'Alternate Art': 5,
  Overnumbered: 6,
};
