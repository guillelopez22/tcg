'use client';

// Deck creation wizard — 5-step flow:
// 1. Name deck  2. Pick legend  3. Choose method  4. Build (main / rune / battlefield)  5. Review & create
// Rendering: client-only (modal, interactive state machine)

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { DOMAIN_COLORS } from '@/lib/design-tokens';
import {
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  BATTLEFIELD_COUNT,
  SIDEBOARD_SIZE,
  SIGNATURE_TYPES,
  type DeckZone,
} from '@la-grieta/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouterOutput = inferRouterOutputs<AppRouter>;
type LegendCard = RouterOutput['card']['legends'][number];
type CardItem = RouterOutput['card']['list']['items'][number];

type Step = 'name' | 'legend' | 'method' | 'build' | 'review';
type BuildMethod = 'manual' | 'import' | 'auto';
type ImportTab = 'text' | 'url' | 'code';

interface DeckEntry {
  card: CardItem;
  quantity: number;
  zone: DeckZone;
}

interface DeckWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FALLBACK_DOMAIN = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700' };

const MAIN_CARD_TYPES = ['Unit', 'Champion Unit', 'Spell', 'Gear', 'Signature Unit', 'Signature Spell', 'Signature Gear'] as const;

const STEPS: { id: Step; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'legend', label: 'Legend' },
  { id: 'method', label: 'Method' },
  { id: 'build', label: 'Build' },
  { id: 'review', label: 'Review' },
];

// Rarity priority for auto-build: prefer common/uncommon to fill slots
const RARITY_PRIORITY: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Epic: 3,
  Showcase: 4,
  'Alternate Art': 5,
  Overnumbered: 6,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function parseDomains(domain: string | null): [string, string] | [string] {
  if (!domain) return [''];
  // Domain data uses ";" separator (e.g. "Calm;Mind", "Fury;Chaos")
  const parts = domain.split(/[;/]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [''];
  return parts as [string, string] | [string];
}

function isSignatureCard(cardType: string | null | undefined): boolean {
  return SIGNATURE_TYPES.includes((cardType ?? '') as (typeof SIGNATURE_TYPES)[number]);
}

function getDomainBadge(domain: string): string {
  const colors = DOMAIN_COLORS[domain] ?? FALLBACK_DOMAIN;
  return `${colors.text} ${colors.bg} ${colors.border}`;
}

function rarityScore(rarity: string | null | undefined): number {
  if (!rarity) return 99;
  return RARITY_PRIORITY[rarity] ?? 99;
}

// ---------------------------------------------------------------------------
// Auto-build algorithm
// Given all available cards for a legend's domains, produce a complete deck.
// Returns DeckEntry[] (without the legend entry — caller adds that separately).
// ---------------------------------------------------------------------------

function autoBuildEntries(
  legend: LegendCard,
  domainCards: CardItem[],
): DeckEntry[] {
  const legendDomains = parseDomains(legend.domain);
  const legendDomain = legend.domain;

  const entries: DeckEntry[] = [];

  // Helpers
  const addEntry = (card: CardItem, qty: number, zone: DeckZone) => {
    entries.push({ card, quantity: qty, zone });
  };

  // Exclude legends, tokens, and the legend itself
  const EXCLUDED = new Set(['Legend', 'Token']);
  const eligible = domainCards.filter(
    (c) => !EXCLUDED.has(c.cardType ?? '') && c.id !== legend.id,
  );

  // Sort by rarity ascending (commons first — better for a starter deck)
  const sorted = [...eligible].sort((a, b) => rarityScore(a.rarity) - rarityScore(b.rarity));

  // ---- 1. Champion Unit (goes to champion zone) ----
  const championCandidates = sorted.filter((c) => c.cardType === 'Champion Unit');
  let champion: CardItem | null = null;
  if (championCandidates.length > 0) {
    champion = championCandidates[0]!;
    addEntry(champion, 1, 'champion');
  }

  // ---- 2. Rune deck (12 runes) ----
  const runeCandidates = sorted.filter((c) => c.cardType === 'Rune');
  let runeTotal = 0;
  const runeAdded = new Set<string>();
  for (const card of runeCandidates) {
    if (runeTotal >= RUNE_DECK_SIZE) break;
    const qty = Math.min(3, RUNE_DECK_SIZE - runeTotal);
    addEntry(card, qty, 'rune');
    runeAdded.add(card.id);
    runeTotal += qty;
  }

  // ---- 3. Battlefields (3 unique) ----
  const bfCandidates = sorted.filter((c) => c.cardType === 'Battlefield');
  const bfAdded = new Set<string>();
  for (const card of bfCandidates) {
    if (bfAdded.size >= BATTLEFIELD_COUNT) break;
    // Unique by name
    if ([...bfAdded].some((id) => eligible.find((c) => c.id === id)?.name === card.name)) continue;
    addEntry(card, 1, 'battlefield');
    bfAdded.add(card.id);
  }

  // ---- 4. Main deck (40 cards) ----
  // Priority order: signature cards for this legend → units → spells/gear
  // Signature cards: must match legend's exact domain pair, max 1 copy each
  const signatureCandidates = sorted.filter(
    (c) => isSignatureCard(c.cardType) && c.domain === legendDomain,
  );
  const mainExcluded = new Set(['Rune', 'Battlefield', 'Legend', 'Token', 'Champion Unit']);
  const mainCandidates = sorted.filter(
    (c) => !mainExcluded.has(c.cardType ?? '') && !isSignatureCard(c.cardType),
  );

  let mainTotal = 0;
  const mainAdded = new Map<string, number>(); // cardId -> quantity

  // Add signatures first (1 copy each)
  for (const card of signatureCandidates) {
    if (mainTotal >= MAIN_DECK_SIZE) break;
    addEntry(card, 1, 'main');
    mainAdded.set(card.id, 1);
    mainTotal += 1;
  }

  // Fill remaining main deck slots
  // Balance domains: interleave cards from both domains
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

  // Interleaved fill: take turns from each domain pool
  const fillPools = domain1Cards.length > 0 ? [domain0Cards, domain1Cards] : [domain0Cards];
  let poolIdx = 0;
  const seenInFill = new Set<string>(mainAdded.keys());

  // We'll do multiple passes until main deck is full
  let progress = true;
  while (mainTotal < MAIN_DECK_SIZE && progress) {
    progress = false;
    for (let pass = 0; pass < fillPools.length && mainTotal < MAIN_DECK_SIZE; pass++) {
      const pool = fillPools[(poolIdx + pass) % fillPools.length]!;
      for (const card of pool) {
        if (mainTotal >= MAIN_DECK_SIZE) break;
        if (seenInFill.has(card.id)) {
          // Try to add another copy
          const existing = mainAdded.get(card.id) ?? 0;
          const maxCopies = isSignatureCard(card.cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;
          if (existing < maxCopies) {
            // Find the entry and increment
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-surface-border">
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={[
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                active ? 'bg-rift-600 text-white' : done ? 'bg-rift-900 text-rift-400' : 'bg-surface-elevated text-zinc-500',
              ].join(' ')}
            >
              {done ? '✓' : idx + 1}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-white' : 'text-zinc-500'}`}>{step.label}</span>
            {idx < STEPS.length - 1 && <div className="w-6 h-px bg-surface-border" />}
          </div>
        );
      })}
    </div>
  );
}

interface DomainBadgeProps {
  domain: string;
}
function DomainBadge({ domain }: DomainBadgeProps) {
  return (
    <span className={`lg-badge border ${getDomainBadge(domain)}`}>{domain}</span>
  );
}

interface CardThumbnailProps {
  card: CardItem | LegendCard;
  onClick?: () => void;
  selected?: boolean;
  count?: number;
  disabled?: boolean;
  actionLabel?: string;
}
function CardThumbnail({ card, onClick, selected, count, disabled, actionLabel }: CardThumbnailProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={actionLabel ?? card.name}
      className={[
        'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 text-left',
        'hover:border-rift-500/60 focus-visible:ring-2 focus-visible:ring-rift-500',
        selected ? 'border-rift-500 bg-rift-950/30' : 'border-surface-border bg-surface-card',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <div className="relative w-full aspect-[2/3] bg-zinc-900">
        {card.imageSmall ? (
          <Image
            src={card.imageSmall}
            alt={card.name}
            fill
            sizes="(max-width: 768px) 80px, 100px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-zinc-600 text-[10px] text-center px-1">{card.name}</span>
          </div>
        )}
        {count !== undefined && count > 0 && (
          <div className="lg-badge-count">{count}</div>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-[10px] font-medium text-white line-clamp-2 leading-tight">{card.name}</p>
        {'cardType' in card && card.cardType && (
          <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{card.cardType}</p>
        )}
      </div>
    </button>
  );
}

interface SectionHeaderProps {
  title: string;
  count: number;
  max: number;
  valid: boolean;
  extra?: string;
}
function SectionHeader({ title, count, max, valid, extra }: SectionHeaderProps) {
  const pct = Math.min(count / max, 1);
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          {extra && <span className="lg-text-muted">{extra}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${count > max ? 'text-red-400' : valid ? 'text-green-400' : 'text-zinc-400'}`}>
            {count}/{max}
          </span>
          {valid && <span className="text-green-400 text-xs">✓</span>}
        </div>
      </div>
      <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${count > max ? 'bg-red-500' : count === max ? 'bg-green-500' : 'bg-rift-500'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card browser (used in step 4 — Build)
// ---------------------------------------------------------------------------

type BrowserTab = 'main' | 'rune' | 'battlefield' | 'sideboard';

interface CardBrowserProps {
  legend: LegendCard;
  entries: DeckEntry[];
  onAdd: (card: CardItem) => void;
  activeTab: BrowserTab;
  onTabChange: (tab: BrowserTab) => void;
}

function CardBrowser({ legend, entries, onAdd, activeTab, onTabChange }: CardBrowserProps) {
  const domains = parseDomains(legend.domain);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const cardType = activeTab === 'rune'
    ? 'Rune'
    : activeTab === 'battlefield'
      ? 'Battlefield'
      : typeFilter !== 'all' ? typeFilter : undefined; // main + sideboard share card types

  // Query first domain
  const q1 = trpc.card.list.useQuery(
    {
      domain: activeTab === 'battlefield' ? undefined : domains[0] || undefined,
      cardType,
      search: search || undefined,
      limit: 100,
    },
    { staleTime: 60_000, enabled: activeTab !== 'rune' || !!domains[0] },
  );

  // Query second domain for rune / main tabs (when legend has two domains)
  const q2 = trpc.card.list.useQuery(
    {
      domain: domains[1] || undefined,
      cardType,
      search: search || undefined,
      limit: 100,
    },
    { staleTime: 60_000, enabled: !!domains[1] && activeTab !== 'battlefield' },
  );

  const EXCLUDED_FROM_MAIN = new Set(['Legend', 'Rune', 'Battlefield', 'Token']);

  const allCards = useMemo(() => {
    const seen = new Set<string>();
    const merged: CardItem[] = [];
    for (const c of [...(q1.data?.items ?? []), ...(q2.data?.items ?? [])]) {
      if (seen.has(c.id)) continue;
      // When browsing "main" with no type filter, exclude non-main card types
      if ((activeTab === 'main' || activeTab === 'sideboard') && !cardType && EXCLUDED_FROM_MAIN.has(c.cardType ?? '')) continue;
      // Signature cards must match the legend's exact domain pair (not just one domain)
      if (isSignatureCard(c.cardType) && c.domain !== legend.domain) continue;
      seen.add(c.id);
      merged.push(c);
    }
    return merged;
  }, [q1.data, q2.data, activeTab, cardType, legend.domain]);

  const entryMap = useMemo(() => {
    const m = new Map<string, DeckEntry>();
    for (const e of entries) m.set(e.card.id, e);
    return m;
  }, [entries]);

  const isLoading = q1.isLoading || q2.isLoading;

  const tabs: { id: BrowserTab; label: string }[] = [
    { id: 'main', label: 'Main Deck' },
    { id: 'rune', label: 'Runes' },
    { id: 'battlefield', label: 'Battlefields' },
    { id: 'sideboard', label: 'Sideboard' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-surface-border shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { onTabChange(t.id); setSearch(''); setTypeFilter('all'); }}
            className={t.id === activeTab ? 'lg-tab-active' : 'lg-tab-inactive'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="p-3 flex gap-2 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="lg-input text-xs py-2"
          aria-label="Search cards"
        />
        {activeTab === 'main' && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="lg-select text-xs shrink-0"
            aria-label="Filter by card type"
          >
            <option value="all">All types</option>
            {MAIN_CARD_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-y-auto flex-1 p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <div className="lg-spinner" />
            <span className="sr-only">Loading cards</span>
          </div>
        ) : allCards.length === 0 ? (
          <p className="lg-text-muted text-center py-8">No cards found</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {allCards.map((card) => {
              const entry = entryMap.get(card.id);
              return (
                <CardThumbnail
                  key={card.id}
                  card={card}
                  count={entry?.quantity}
                  onClick={() => onAdd(card)}
                  actionLabel={`Add ${card.name}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG icons for method cards
// ---------------------------------------------------------------------------

function IconBuildManually() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconImport() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0-4-4m4 4 4-4" />
      <path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function IconAutoWand() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 4-1 1 1 1 1-1-1-1ZM3 20l9-9M5 6 4 7l1 1 1-1-1-1ZM7 2l-1 1 1 1 1-1-1-1Z" />
      <path d="m20 8-1 1 1 1 1-1-1-1ZM18 4l-1 1 1 1 1-1-1-1Z" />
      <path d="M12 8a4 4 0 0 1 4 4" />
      <path d="M6 18a4 4 0 0 1 4-4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DeckWizard({ isOpen, onClose, onCreated }: DeckWizardProps) {
  const router = useRouter();

  // — All state at the top (Rules of Hooks) —
  const [step, setStep] = useState<Step>('name');
  const [deckName, setDeckName] = useState('');
  const [legendSearch, setLegendSearch] = useState('');
  const [legendDomainFilter, setLegendDomainFilter] = useState('all');
  const [selectedLegend, setSelectedLegend] = useState<LegendCard | null>(null);
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [browserTab, setBrowserTab] = useState<BrowserTab>('main');
  const [nameError, setNameError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Method step state
  const [buildMethod, setBuildMethod] = useState<BuildMethod | null>(null);

  // Import inline state
  const [importTab, setImportTab] = useState<ImportTab>('text');
  const [importText, setImportText] = useState('');
  const [importName, setImportName] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');

  // Auto-build state
  const [isAutoBuilding, setIsAutoBuilding] = useState(false);

  // Fetch legends once
  const { data: legendsData, isLoading: legendsLoading } = trpc.card.legends.useQuery(
    undefined,
    { staleTime: Infinity, enabled: isOpen },
  );

  // Fetch domain cards for auto-build (domain 1)
  const legendDomains = useMemo(() => parseDomains(selectedLegend?.domain ?? null), [selectedLegend]);

  const autoBuildQ1 = trpc.card.list.useQuery(
    { domain: legendDomains[0] || undefined, limit: 100 },
    {
      staleTime: 60_000,
      enabled: isOpen && buildMethod === 'auto' && !!legendDomains[0],
    },
  );

  const autoBuildQ2 = trpc.card.list.useQuery(
    { domain: legendDomains[1] || undefined, limit: 100 },
    {
      staleTime: 60_000,
      enabled: isOpen && buildMethod === 'auto' && !!legendDomains[1],
    },
  );

  // Battlefield cards have no domain — need a separate query
  const autoBuildBfQ = trpc.card.list.useQuery(
    { cardType: 'Battlefield', limit: 50 },
    {
      staleTime: 60_000,
      enabled: isOpen && buildMethod === 'auto',
    },
  );

  // tRPC mutations for import
  const importFromTextMutation = trpc.deck.importFromText.useMutation({
    onSuccess(result) {
      if (result.resolved.length === 0) {
        setImportError('No cards could be matched from the pasted text.');
        return;
      }
      applyImportResult(result.resolved, result.deckName);
    },
    onError(err) {
      setImportError(err.message || 'Import failed. Please check your deck list.');
    },
  });

  const importFromUrlMutation = trpc.deck.importFromUrl.useMutation({
    onSuccess(result) {
      if (result.resolved.length === 0) {
        setImportError('No cards could be matched from that URL.');
        return;
      }
      applyImportResult(result.resolved, result.deckName);
    },
    onError(err) {
      setImportError(err.message || 'Failed to fetch deck from URL.');
    },
  });

  const utils = trpc.useUtils();

  const createDeck = trpc.deck.create.useMutation({
    onSuccess: (deck) => {
      toast.success(`"${deck.name}" created!`);
      onCreated();
      handleClose();
      router.push(`/decks/${deck.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create deck');
    },
  });

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen && step === 'name') {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen, step]);

  // Auto-build: when queries are ready and we're in auto mode, run the algorithm
  useEffect(() => {
    if (!isAutoBuilding) return;
    if (!selectedLegend) return;

    const q1Done = autoBuildQ1.isSuccess;
    const q2Done = !legendDomains[1] || autoBuildQ2.isSuccess;
    const bfDone = autoBuildBfQ.isSuccess;

    if (!q1Done || !q2Done || !bfDone) return;

    const allDomainCards = [
      ...(autoBuildQ1.data?.items ?? []),
      ...(autoBuildQ2.data?.items ?? []),
      ...(autoBuildBfQ.data?.items ?? []),
    ];

    // Deduplicate
    const seen = new Set<string>();
    const deduped: CardItem[] = [];
    for (const c of allDomainCards) {
      if (!seen.has(c.id)) { seen.add(c.id); deduped.push(c); }
    }

    const legendEntry: DeckEntry = {
      card: selectedLegend as unknown as CardItem,
      quantity: 1,
      zone: 'legend',
    };

    const built = autoBuildEntries(selectedLegend, deduped);
    setEntries([legendEntry, ...built]);
    setIsAutoBuilding(false);
    setStep('review');
  }, [isAutoBuilding, autoBuildQ1.isSuccess, autoBuildQ2.isSuccess, autoBuildBfQ.isSuccess, autoBuildQ1.data, autoBuildQ2.data, autoBuildBfQ.data, selectedLegend, legendDomains]);

  // Reset when modal closes
  const handleClose = useCallback(() => {
    setStep('name');
    setDeckName('');
    setLegendSearch('');
    setLegendDomainFilter('all');
    setSelectedLegend(null);
    setEntries([]);
    setBrowserTab('main');
    setNameError('');
    setBuildMethod(null);
    setImportTab('text');
    setImportText('');
    setImportName('');
    setImportUrl('');
    setImportCode('');
    setImportError('');
    setIsAutoBuilding(false);
    onClose();
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // — Derived data —

  const filteredLegends = useMemo(() => {
    const all = legendsData ?? [];
    return all.filter((l) => {
      const matchesSearch = !legendSearch || l.name.toLowerCase().includes(legendSearch.toLowerCase());
      const matchesDomain = legendDomainFilter === 'all' || (l.domain ?? '').includes(legendDomainFilter);
      return matchesSearch && matchesDomain;
    });
  }, [legendsData, legendSearch, legendDomainFilter]);

  // Partition entries by zone category
  const legendEntry = entries.find((e) => e.zone === 'legend');
  const championEntry = entries.find((e) => e.zone === 'champion');
  const mainEntries = entries.filter((e) => e.zone === 'main');
  const runeEntries = entries.filter((e) => e.zone === 'rune');
  const battlefieldEntries = entries.filter((e) => e.zone === 'battlefield');
  const sideboardEntries = entries.filter((e) => e.zone === 'sideboard');

  const mainCount = mainEntries.reduce((s, e) => s + e.quantity, 0);
  const runeCount = runeEntries.reduce((s, e) => s + e.quantity, 0);
  const battlefieldCount = battlefieldEntries.length;
  const sideboardCount = sideboardEntries.reduce((s, e) => s + e.quantity, 0);

  // Validation
  const validation = useMemo(() => {
    const hasChampion = !!championEntry;
    const mainOk = mainCount === MAIN_DECK_SIZE && hasChampion;
    const runeOk = runeCount === RUNE_DECK_SIZE;
    const bfOk = battlefieldCount === BATTLEFIELD_COUNT;
    const sideboardOk = sideboardCount <= SIDEBOARD_SIZE;
    // All signature cards must match the legend's domain
    const legendDomain = legendEntry?.card.domain ?? null;
    const signaturesOk = entries
      .filter((e) => isSignatureCard(e.card.cardType))
      .every((e) => e.card.domain === legendDomain);
    return {
      mainOk,
      runeOk,
      bfOk,
      sideboardOk,
      hasChampion,
      isValid: mainOk && runeOk && bfOk && sideboardOk && signaturesOk,
    };
  }, [mainCount, runeCount, battlefieldCount, sideboardCount, championEntry, entries, legendEntry]);

  // — Entry mutation helpers —

  const addCard = useCallback((card: CardItem) => {
    setEntries((prev) => {
      // Signature cards must match the legend's exact domain pair
      if (isSignatureCard(card.cardType)) {
        const legend = prev.find((e) => e.zone === 'legend');
        if (!legend || card.domain !== legend.card.domain) return prev;
      }

      // Determine target zone FIRST, then find existing entry in that zone
      let zone: DeckZone = browserTab === 'sideboard' ? 'sideboard' : 'main';
      if (card.cardType === 'Rune') zone = 'rune';
      else if (card.cardType === 'Battlefield') zone = 'battlefield';
      else if (card.cardType === 'Champion Unit') {
        const hasChampion = prev.some((e) => e.zone === 'champion');
        zone = hasChampion ? zone : 'champion'; // keep sideboard if on sideboard tab
      }

      // Champion zone: only 1 card allowed
      if (zone === 'champion') {
        const existing = prev.find((e) => e.zone === 'champion');
        if (existing) return prev;
        return [...prev, { card, quantity: 1, zone }];
      }

      // Battlefield: unique names only, max 3
      if (zone === 'battlefield') {
        const alreadyHave = prev.some((e) => e.zone === 'battlefield' && e.card.name === card.name);
        if (alreadyHave || prev.filter((e) => e.zone === 'battlefield').length >= BATTLEFIELD_COUNT) return prev;
        return [...prev, { card, quantity: 1, zone }];
      }

      // Runes: no per-card copy limit, only total rune count (12)
      if (zone === 'rune') {
        const currentRuneTotal = prev.filter((e) => e.zone === 'rune').reduce((s, e) => s + e.quantity, 0);
        if (currentRuneTotal >= RUNE_DECK_SIZE) return prev;
        const existing = prev.find((e) => e.card.id === card.id && e.zone === 'rune');
        if (existing) {
          return prev.map((e) => e.card.id === card.id && e.zone === 'rune' ? { ...e, quantity: e.quantity + 1 } : e);
        }
        return [...prev, { card, quantity: 1, zone }];
      }

      // Main / sideboard: enforce size limits
      if (zone === 'sideboard') {
        const currentSideboardTotal = prev
          .filter((e) => e.zone === 'sideboard')
          .reduce((s, e) => s + e.quantity, 0);
        if (currentSideboardTotal >= SIDEBOARD_SIZE) return prev;
      } else {
        const currentMainTotal = prev
          .filter((e) => e.zone === 'main')
          .reduce((s, e) => s + e.quantity, 0);
        if (currentMainTotal >= MAIN_DECK_SIZE) return prev;
      }

      // Per-card copy limits (count across main + sideboard for this card)
      const totalCopies = prev
        .filter((e) => e.card.id === card.id && (e.zone === 'main' || e.zone === 'sideboard'))
        .reduce((s, e) => s + e.quantity, 0);
      if (totalCopies >= MAX_COPIES_PER_CARD) return prev;

      const existing = prev.find((e) => e.card.id === card.id && e.zone === zone);
      if (existing) {
        return prev.map((e) => e.card.id === card.id && e.zone === zone ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { card, quantity: 1, zone }];
    });
  }, [browserTab]);

  const removeCard = useCallback((cardId: string) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.card.id === cardId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((e) => e.card.id !== cardId);
      return prev.map((e) => e.card.id === cardId ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }, []);

  const removeCardFully = useCallback((cardId: string) => {
    setEntries((prev) => prev.filter((e) => e.card.id !== cardId));
  }, []);

  // Convert import resolved list into DeckEntry format and jump to review
  function applyImportResult(
    resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>,
    importedDeckName: string,
  ) {
    // We need full CardItem objects. The import API only returns cardId/quantity/zone.
    // Fetch full card data for each resolved card via the card cache.
    // For now, build minimal CardItem-like objects from the resolved data.
    // The review step only needs id, name, imageSmall, cardType, domain for display.
    const newEntries: DeckEntry[] = resolved.map((r) => ({
      card: {
        id: r.cardId,
        name: r.name ?? r.cardId,
        imageSmall: r.imageSmall ?? null,
        // Minimal fields — review only displays name/image, build step is skipped
        externalId: '',
        number: '',
        code: '',
        cleanName: r.name ?? '',
        setId: '',
        rarity: '',
        cardType: null,
        domain: null,
        energyCost: null,
        powerCost: null,
        might: null,
        description: null,
        flavorText: null,
        imageLarge: null,
        tcgplayerId: null,
        tcgplayerUrl: null,
        set: { id: '', name: '', slug: '', releaseDate: null },
      } as unknown as CardItem,
      quantity: r.quantity,
      zone: (r.zone as DeckZone) ?? 'main',
    }));

    // Set deck name from import if user hasn't customised it
    if (!deckName.trim() || deckName === importedDeckName) {
      setDeckName(importedDeckName);
    }

    setEntries(newEntries);
    setStep('review');
  }

  // — Step navigation —

  const goNext = () => {
    if (step === 'name') {
      const trimmed = deckName.trim();
      if (!trimmed) { setNameError('Please enter a deck name'); return; }
      if (trimmed.length > 80) { setNameError('Name must be 80 characters or fewer'); return; }
      setNameError('');
      setStep('legend');
    } else if (step === 'legend') {
      if (!selectedLegend) return;
      // Add legend to entries if not already there
      setEntries((prev) => {
        const hasLegend = prev.some((e) => e.zone === 'legend');
        if (hasLegend) return prev;
        return [...prev, { card: selectedLegend as unknown as CardItem, quantity: 1, zone: 'legend' }];
      });
      setStep('method');
    } else if (step === 'build') {
      setStep('review');
    }
  };

  const goBack = () => {
    if (step === 'legend') setStep('name');
    else if (step === 'method') {
      setBuildMethod(null);
      setImportError('');
      setStep('legend');
    }
    else if (step === 'build') setStep('method');
    else if (step === 'review') {
      // Go back to build if user manually built, otherwise method
      if (buildMethod === 'manual') setStep('build');
      else setStep('method');
    }
  };

  // Method selection handlers
  const handlePickManual = () => {
    setBuildMethod('manual');
    setStep('build');
  };

  const handlePickImport = () => {
    setBuildMethod('import');
    // Stay on method step, but now show inline import UI
    // (renderMethod conditionally renders import UI when buildMethod === 'import')
  };

  const handlePickAuto = () => {
    setBuildMethod('auto');
    setIsAutoBuilding(true);
    // The useEffect watching autoBuildQ1/Q2 will run the algorithm and advance to review
  };

  const handleSubmitImport = () => {
    setImportError('');
    if (importTab === 'text') {
      if (!importText.trim()) { setImportError('Please paste a deck list.'); return; }
      importFromTextMutation.mutate({ text: importText, name: importName || deckName || undefined });
    } else if (importTab === 'url') {
      if (!importUrl.trim()) { setImportError('Please enter a URL.'); return; }
      importFromUrlMutation.mutate({ url: importUrl, name: importName || deckName || undefined });
    } else {
      // Share code
      if (!importCode.trim()) { setImportError('Please enter a share code.'); return; }
      void utils.deck.resolveShareCode.fetch({ code: importCode.trim() }).then((deck) => {
        const resolved = deck.cards.map((c) => ({
          cardId: c.card.id,
          quantity: c.quantity,
          zone: c.zone,
          name: c.card.name,
          imageSmall: c.card.imageSmall,
        }));
        applyImportResult(resolved, `Copy of ${deck.name}`);
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Share code not found.';
        setImportError(message);
      });
    }
  };

  // — Create deck —

  const handleCreate = () => {
    if (!selectedLegend) return;
    const cards = entries.map((e) => ({
      cardId: e.card.id,
      quantity: e.quantity,
      zone: e.zone,
    }));
    createDeck.mutate({
      name: deckName.trim(),
      isPublic: false,
      coverCardId: selectedLegend.id,
      cards,
    });
  };

  // — Render guard —

  if (!isOpen) return null;

  // — Step renderers —

  const renderName = () => (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="lg-page-title mb-1">Name your deck</h2>
        <p className="lg-text-secondary">Give your deck a name you'll recognise.</p>
      </div>
      <div className="lg-field">
        <label htmlFor="deck-name" className="lg-label">Deck name</label>
        <input
          id="deck-name"
          ref={nameInputRef}
          type="text"
          value={deckName}
          onChange={(e) => { setDeckName(e.target.value); if (nameError) setNameError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') goNext(); }}
          placeholder="e.g. Leona Aggro"
          maxLength={80}
          className="lg-input"
        />
        {nameError && <p className="text-xs text-red-400 mt-1" role="alert">{nameError}</p>}
        <p className="lg-hint">{deckName.length}/80</p>
      </div>
    </div>
  );

  const renderLegend = () => (
    <div className="flex flex-col gap-4 p-6 overflow-hidden h-full">
      <div>
        <h2 className="lg-page-title mb-1">Pick your Legend</h2>
        <p className="lg-text-secondary">Your Legend defines the deck's domains.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 shrink-0">
        <input
          type="search"
          value={legendSearch}
          onChange={(e) => setLegendSearch(e.target.value)}
          placeholder="Search legends…"
          className="lg-input text-sm"
          aria-label="Search legends"
        />
        <select
          value={legendDomainFilter}
          onChange={(e) => setLegendDomainFilter(e.target.value)}
          className="lg-select text-sm shrink-0"
          aria-label="Filter by domain"
        >
          <option value="all">All domains</option>
          {['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'].map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Legend grid */}
      <div className="overflow-y-auto flex-1">
        {legendsLoading ? (
          <div className="flex items-center justify-center py-16" role="status">
            <div className="lg-spinner" />
            <span className="sr-only">Loading legends</span>
          </div>
        ) : filteredLegends.length === 0 ? (
          <p className="lg-text-muted text-center py-8">No legends found</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredLegends.map((legend) => {
              const isSelected = selectedLegend?.id === legend.id;
              const domains = parseDomains(legend.domain);
              return (
                <button
                  key={legend.id}
                  type="button"
                  onClick={() => setSelectedLegend(legend)}
                  aria-pressed={isSelected}
                  className={[
                    'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 text-left group',
                    isSelected
                      ? 'border-rift-500 ring-2 ring-rift-500/40'
                      : 'border-surface-border hover:border-rift-500/50',
                  ].join(' ')}
                >
                  {/* Card image */}
                  <div className="relative w-full aspect-[2/3] bg-zinc-900">
                    {legend.imageSmall ? (
                      <Image
                        src={legend.imageSmall}
                        alt={legend.name}
                        fill
                        sizes="(max-width: 768px) 45vw, 30vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                        <span className="text-zinc-500 text-xs text-center px-2">{legend.name}</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-rift-600/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-rift-600 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">✓</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2 bg-surface-card">
                    <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1.5">{legend.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {domains.filter(Boolean).map((d) => (
                        <DomainBadge key={d} domain={d} />
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected summary */}
      {selectedLegend && (
        <div className="shrink-0 lg-card p-3 flex items-center gap-3 bg-rift-950/50 border-rift-700/50">
          {selectedLegend.imageSmall && (
            <div className="relative w-10 h-14 rounded overflow-hidden shrink-0">
              <Image src={selectedLegend.imageSmall} alt={selectedLegend.name} fill className="object-cover" sizes="40px" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{selectedLegend.name}</p>
            <div className="flex gap-1 mt-1">
              {parseDomains(selectedLegend.domain).filter(Boolean).map((d) => (
                <DomainBadge key={d} domain={d} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderMethod = () => {
    // If user picked Import, show the inline import UI
    if (buildMethod === 'import') {
      const isLoading = importFromTextMutation.isPending || importFromUrlMutation.isPending;
      const importTabs: { id: ImportTab; label: string }[] = [
        { id: 'text', label: 'Text Paste' },
        { id: 'url', label: 'URL' },
        { id: 'code', label: 'Share Code' },
      ];
      return (
        <div className="flex flex-col gap-4 p-6 overflow-y-auto">
          <div>
            <button
              type="button"
              onClick={() => { setBuildMethod(null); setImportError(''); }}
              className="lg-text-muted text-xs flex items-center gap-1 mb-3 hover:text-white transition-colors"
              aria-label="Back to method selection"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
              Back to method selection
            </button>
            <h2 className="lg-page-title mb-1">Import a Deck</h2>
            <p className="lg-text-secondary">Paste a deck list, provide a URL, or enter a share code.</p>
          </div>

          {/* Import tabs */}
          <div className="flex border-b border-surface-border shrink-0">
            {importTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setImportTab(t.id); setImportError(''); }}
                className={t.id === importTab ? 'lg-tab-active' : 'lg-tab-inactive'}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="space-y-3">
            {importTab === 'text' && (
              <>
                <div className="lg-field">
                  <label htmlFor="import-name" className="lg-label">Deck name (optional — overrides wizard name)</label>
                  <input
                    id="import-name"
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder={deckName || 'My Imported Deck'}
                    className="lg-input"
                  />
                </div>
                <div className="lg-field">
                  <label htmlFor="import-text" className="lg-label">Deck list</label>
                  <textarea
                    id="import-text"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={'3x Card Name\n2x Other Card\n...'}
                    className="lg-input min-h-[160px] resize-y font-mono text-sm"
                    aria-label="Paste deck list text"
                  />
                </div>
              </>
            )}

            {importTab === 'url' && (
              <>
                <div className="lg-field">
                  <label htmlFor="import-url-name" className="lg-label">Deck name (optional)</label>
                  <input
                    id="import-url-name"
                    type="text"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder={deckName || 'My Imported Deck'}
                    className="lg-input"
                  />
                </div>
                <div className="lg-field">
                  <label htmlFor="import-url" className="lg-label">Deck URL</label>
                  <input
                    id="import-url"
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitImport(); }}
                    placeholder="https://riftbound.gg/deck/..."
                    className="lg-input"
                    aria-label="Enter deck URL"
                  />
                </div>
              </>
            )}

            {importTab === 'code' && (
              <div className="lg-field">
                <label htmlFor="import-code" className="lg-label">Share code</label>
                <input
                  id="import-code"
                  type="text"
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitImport(); }}
                  placeholder="LG-a3Xk9m"
                  className="lg-input"
                  aria-label="Enter share code"
                />
              </div>
            )}

            {importError && (
              <p className="text-xs text-red-400" role="alert">{importError}</p>
            )}

            <button
              type="button"
              onClick={handleSubmitImport}
              disabled={isLoading}
              className="lg-btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading && (
                <div role="status" className="lg-spinner-sm">
                  <span className="sr-only">Importing</span>
                </div>
              )}
              {isLoading ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      );
    }

    // Auto-building loading state
    if (buildMethod === 'auto' && isAutoBuilding) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          <div role="status" className="lg-spinner">
            <span className="sr-only">Building deck</span>
          </div>
          <p className="text-sm text-white font-medium">Building your deck…</p>
          <p className="lg-text-muted text-xs text-center">
            Selecting cards from {legendDomains.filter(Boolean).join(' + ')} domain{legendDomains.filter(Boolean).length > 1 ? 's' : ''}.
          </p>
        </div>
      );
    }

    // Default: show 3 method cards
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="lg-page-title mb-1">How do you want to build?</h2>
          <p className="lg-text-secondary">Choose a starting point for your deck.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Build Manually */}
          <button
            type="button"
            onClick={handlePickManual}
            className={[
              'lg-card p-5 flex flex-col items-center gap-3 text-center transition-all duration-200',
              'hover:border-rift-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rift-900/30',
              'focus-visible:ring-2 focus-visible:ring-rift-500',
            ].join(' ')}
          >
            <div className="w-14 h-14 rounded-2xl bg-rift-900/50 border border-rift-700/50 flex items-center justify-center text-rift-400">
              <IconBuildManually />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Build Manually</p>
              <p className="text-xs text-zinc-500 leading-relaxed">Browse and add cards one by one to craft your ideal deck.</p>
            </div>
          </button>

          {/* Import a Deck */}
          <button
            type="button"
            onClick={handlePickImport}
            className={[
              'lg-card p-5 flex flex-col items-center gap-3 text-center transition-all duration-200',
              'hover:border-rift-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rift-900/30',
              'focus-visible:ring-2 focus-visible:ring-rift-500',
            ].join(' ')}
          >
            <div className="w-14 h-14 rounded-2xl bg-rift-900/50 border border-rift-700/50 flex items-center justify-center text-rift-400">
              <IconImport />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Import a Deck</p>
              <p className="text-xs text-zinc-500 leading-relaxed">Paste a deck list, enter a URL, or use a share code.</p>
            </div>
          </button>

          {/* Auto-Build */}
          <button
            type="button"
            onClick={handlePickAuto}
            className={[
              'lg-card p-5 flex flex-col items-center gap-3 text-center transition-all duration-200',
              'hover:border-rift-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rift-900/30',
              'focus-visible:ring-2 focus-visible:ring-rift-500',
            ].join(' ')}
          >
            <div className="w-14 h-14 rounded-2xl bg-rift-900/50 border border-rift-700/50 flex items-center justify-center text-rift-400">
              <IconAutoWand />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">Auto-Build for Me</p>
              <p className="text-xs text-zinc-500 leading-relaxed">Instantly fill a complete deck from your legend's domains. Review before saving.</p>
            </div>
          </button>
        </div>
      </div>
    );
  };

  const renderBuild = () => {
    if (!selectedLegend) return null;

    return (
      <div className="flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Left panel — deck sections */}
        <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border flex flex-col overflow-hidden">
          <div className="p-4 overflow-y-auto flex-1 space-y-5">

            {/* Legend + Champion */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">Legend & Champion</span>
                <span className={`text-xs ${validation.hasChampion ? 'text-green-400' : 'text-amber-400'}`}>
                  {validation.hasChampion ? '✓' : '!'} {championEntry ? '2/2' : '1/2'}
                </span>
              </div>
              <div className="space-y-1.5">
                {/* Legend (locked) */}
                <div className="flex items-center gap-2 lg-card p-2">
                  {selectedLegend.imageSmall && (
                    <div className="relative w-8 h-11 rounded overflow-hidden shrink-0">
                      <Image src={selectedLegend.imageSmall} alt={selectedLegend.name} fill className="object-cover" sizes="32px" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{selectedLegend.name}</p>
                    <div className="flex gap-1 mt-0.5">
                      {legendDomains.filter(Boolean).map((d) => (
                        <DomainBadge key={d} domain={d} />
                      ))}
                    </div>
                  </div>
                  <span className="lg-badge bg-zinc-800 text-zinc-400 text-[9px] ml-auto shrink-0">Legend</span>
                </div>

                {/* Champion (clickable to swap) */}
                {championEntry ? (
                  <button
                    type="button"
                    onClick={() => {
                      removeCardFully(championEntry.card.id);
                      setBrowserTab('main');
                    }}
                    className="w-full flex items-center gap-2 lg-card p-2 hover:border-rift-600/50 transition-colors text-left"
                    title="Click to remove and pick a different Champion Unit"
                  >
                    {championEntry.card.imageSmall && (
                      <div className="relative w-8 h-11 rounded overflow-hidden shrink-0">
                        <Image src={championEntry.card.imageSmall} alt={championEntry.card.name} fill className="object-cover" sizes="32px" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{championEntry.card.name}</p>
                      <p className="text-[10px] text-zinc-500">Champion Unit</p>
                    </div>
                    <span className="lg-badge bg-rift-900/50 text-rift-400 text-[9px] ml-auto shrink-0">Swap</span>
                  </button>
                ) : (
                  <div className="lg-card p-2 border-dashed">
                    <p className="text-xs text-amber-400 text-center">Add a Champion Unit from the card browser</p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Deck */}
            <div>
              <SectionHeader
                title="Main Deck"
                count={mainCount}
                max={MAIN_DECK_SIZE}
                valid={validation.mainOk}
              />
              {mainEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No cards yet</p>
              ) : (
                <div className="space-y-1">
                  {mainEntries.map((e) => (
                    <DeckEntryRow key={e.card.id} entry={e} onRemove={removeCard} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>

            {/* Rune Deck */}
            <div>
              <SectionHeader
                title="Rune Deck"
                count={runeCount}
                max={RUNE_DECK_SIZE}
                valid={validation.runeOk}
              />
              {runeEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No runes yet</p>
              ) : (
                <div className="space-y-1">
                  {runeEntries.map((e) => (
                    <DeckEntryRow key={e.card.id} entry={e} onRemove={removeCard} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>

            {/* Battlefields */}
            <div>
              <SectionHeader
                title="Battlefields"
                count={battlefieldCount}
                max={BATTLEFIELD_COUNT}
                valid={validation.bfOk}
              />
              {battlefieldEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No battlefields yet</p>
              ) : (
                <div className="space-y-1">
                  {battlefieldEntries.map((e) => (
                    <DeckEntryRow key={e.card.id} entry={e} onRemove={removeCardFully} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>

            {/* Sideboard */}
            <div>
              <SectionHeader
                title="Sideboard"
                count={sideboardCount}
                max={SIDEBOARD_SIZE}
                valid={validation.sideboardOk}
                extra="(optional)"
              />
              {sideboardEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No sideboard cards</p>
              ) : (
                <div className="space-y-1">
                  {sideboardEntries.map((e) => (
                    <DeckEntryRow key={e.card.id} entry={e} onRemove={removeCard} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — card browser */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          <CardBrowser
            legend={selectedLegend}
            entries={entries}
            onAdd={addCard}
            activeTab={browserTab}
            onTabChange={setBrowserTab}
          />
        </div>
      </div>
    );
  };

  const renderReview = () => {
    const validationMessages: string[] = [];
    if (!validation.mainOk) {
      if (!validation.hasChampion) validationMessages.push('Main deck requires exactly 1 Champion Unit');
      if (mainCount !== MAIN_DECK_SIZE) validationMessages.push(`Main deck: ${mainCount}/${MAIN_DECK_SIZE} cards`);
    }
    if (!validation.runeOk) validationMessages.push(`Rune deck: ${runeCount}/${RUNE_DECK_SIZE} runes`);
    if (!validation.bfOk) validationMessages.push(`Battlefields: ${battlefieldCount}/${BATTLEFIELD_COUNT}`);

    // Check signature cards match legend domain
    if (legendEntry) {
      for (const e of entries) {
        if (isSignatureCard(e.card.cardType) && e.card.domain !== legendEntry.card.domain) {
          validationMessages.push(`${e.card.name} doesn't match your Legend's domain`);
        }
      }
    }

    // Domain breakdown (main + rune)
    const domainCounts: Record<string, number> = {};
    for (const e of [...mainEntries, ...runeEntries]) {
      const domains = parseDomains(e.card.domain || null);
      for (const d of domains.filter(Boolean)) {
        domainCounts[d] = (domainCounts[d] ?? 0) + e.quantity;
      }
    }

    return (
      <div className="overflow-y-auto flex-1 p-6 space-y-6">
        <div>
          <h2 className="lg-page-title mb-1">Review your deck</h2>
          <p className="lg-text-secondary">"{deckName}" — {selectedLegend?.name}</p>
          {buildMethod === 'auto' && (
            <p className="text-xs text-rift-400 mt-1">Auto-built from {legendDomains.filter(Boolean).join(' + ')} cards. Edit in the Build step if needed.</p>
          )}
          {buildMethod === 'import' && (
            <p className="text-xs text-rift-400 mt-1">Imported deck. Verify the cards look correct before creating.</p>
          )}
        </div>

        {/* Validation messages */}
        {validationMessages.length > 0 && (
          <div className="lg-alert-error space-y-1" role="alert">
            {validationMessages.map((m) => (
              <p key={m} className="flex items-center gap-1.5">
                <span className="text-red-400">!</span> {m}
              </p>
            ))}
          </div>
        )}

        {/* Domain breakdown */}
        <div>
          <h3 className="lg-section-title mb-2">Domain breakdown</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(domainCounts).map(([domain, count]) => (
              <div key={domain} className={`lg-badge border ${getDomainBadge(domain)} gap-1`}>
                <span>{domain}</span>
                <span className="opacity-60">×{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sections summary */}
        {[
          { label: 'Legend & Champion', items: [legendEntry, championEntry].filter(Boolean) as DeckEntry[], max: 2, count: (legendEntry ? 1 : 0) + (championEntry ? 1 : 0) },
          { label: 'Main Deck', items: mainEntries, max: MAIN_DECK_SIZE, count: mainCount },
          { label: 'Rune Deck', items: runeEntries, max: RUNE_DECK_SIZE, count: runeCount },
          { label: 'Battlefields', items: battlefieldEntries, max: BATTLEFIELD_COUNT, count: battlefieldEntries.length },
          ...(sideboardEntries.length > 0 ? [{ label: 'Sideboard', items: sideboardEntries, max: SIDEBOARD_SIZE, count: sideboardCount }] : []),
        ].map(({ label, items, max, count }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="lg-section-title">{label}</h3>
              <span className="lg-text-muted">{count}/{max}</span>
            </div>
            {items.length === 0 ? (
              <p className="lg-text-muted">None added</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {items.map((e) => (
                  <div key={e.card.id} className="relative">
                    <div className="relative w-full aspect-[2/3] bg-zinc-900 rounded-lg overflow-hidden">
                      {e.card.imageSmall ? (
                        <Image
                          src={e.card.imageSmall}
                          alt={e.card.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-zinc-600 text-[9px] text-center px-1">{e.card.name}</span>
                        </div>
                      )}
                      {e.quantity > 1 && <div className="lg-badge-count">{e.quantity}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // — Layout —

  const canGoNext =
    (step === 'name' && deckName.trim().length > 0) ||
    (step === 'legend' && !!selectedLegend) ||
    (step === 'build');

  // Method step: footer Next/Back are hidden (actions are in the cards themselves)
  // Exception: when showing import UI inside method step, show a Back button in footer
  const showFooter = step !== 'method' || (buildMethod === 'import');
  // When showing the inline import UI, show only Back (submit is in the content)
  const footerOnlyBack = step === 'method' && buildMethod === 'import';

  const isTallStep = step === 'legend' || step === 'build' || step === 'review' ||
    (step === 'method' && buildMethod === 'import');

  return (
    <div
      className="lg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Create new deck"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className={[
          'w-full bg-surface-card border border-surface-border overflow-hidden flex flex-col',
          'rounded-t-2xl sm:rounded-2xl',
          isTallStep
            ? 'sm:max-w-4xl h-[92dvh] sm:h-[85dvh]'
            : 'sm:max-w-lg',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <span className="text-base font-semibold text-white">New Deck</span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close wizard"
            className="lg-btn-ghost p-1.5 rounded-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Step content */}
        <div className={`flex-1 overflow-hidden flex flex-col ${step === 'build' ? '' : 'overflow-y-auto'}`}>
          {step === 'name' && renderName()}
          {step === 'legend' && renderLegend()}
          {step === 'method' && renderMethod()}
          {step === 'build' && renderBuild()}
          {step === 'review' && renderReview()}
        </div>

        {/* Footer — hidden on method step (method cards are the actions) */}
        {showFooter && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border shrink-0 gap-3">
            <button
              type="button"
              onClick={step === 'name' ? handleClose : goBack}
              className="lg-btn-secondary"
            >
              {step === 'name' ? 'Cancel' : 'Back'}
            </button>

            {!footerOnlyBack && (
              step === 'review' ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={!validation.isValid || createDeck.isPending}
                  className="lg-btn-primary flex items-center gap-2"
                >
                  {createDeck.isPending ? (
                    <>
                      <div className="lg-spinner-sm" role="status" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    'Create Deck'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="lg-btn-primary"
                >
                  {step === 'build' ? 'Review' : 'Next'}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deck entry row (used in build + review panels)
// ---------------------------------------------------------------------------

interface DeckEntryRowProps {
  entry: DeckEntry;
  onRemove: (cardId: string) => void;
  onRemoveFully: (cardId: string) => void;
}

function DeckEntryRow({ entry, onRemove, onRemoveFully }: DeckEntryRowProps) {
  const { card, quantity, zone } = entry;
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-elevated group">
      {card.imageSmall && (
        <div className="relative w-7 h-10 rounded overflow-hidden shrink-0">
          <Image src={card.imageSmall} alt={card.name} fill className="object-cover" sizes="28px" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{card.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {zone === 'champion' && (
            <span className="lg-badge bg-rift-900/50 text-rift-300 border border-rift-700/50 text-[9px]">Champion</span>
          )}
          {card.domain && parseDomains(card.domain).filter(Boolean).map((d) => (
            <DomainBadge key={d} domain={d} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs font-bold text-white w-5 text-center">{quantity}</span>
        <button
          type="button"
          onClick={() => onRemove(card.id)}
          aria-label={`Remove one ${card.name}`}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-elevated transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
