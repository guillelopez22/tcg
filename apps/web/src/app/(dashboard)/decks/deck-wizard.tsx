'use client';

// Deck creation wizard — 4-step flow:
// 1. Name deck  2. Pick legend  3. Build (main / rune / battlefield)  4. Review & create
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

type Step = 'name' | 'legend' | 'build' | 'review';

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
  { id: 'build', label: 'Build' },
  { id: 'review', label: 'Review' },
];

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
// Card browser (used in step 3)
// ---------------------------------------------------------------------------

type BrowserTab = 'main' | 'rune' | 'battlefield';

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

  // Determine which domain to query based on tab
  const queryDomain = activeTab === 'rune'
    ? domains[0] // will load both domains separately
    : activeTab === 'battlefield'
      ? undefined
      : domains[0];

  const cardType = activeTab === 'rune'
    ? 'Rune'
    : activeTab === 'battlefield'
      ? 'Battlefield'
      : typeFilter !== 'all' ? typeFilter : undefined;

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
      if (activeTab === 'main' && !cardType && EXCLUDED_FROM_MAIN.has(c.cardType ?? '')) continue;
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

  // Fetch legends once
  const { data: legendsData, isLoading: legendsLoading } = trpc.card.legends.useQuery(
    undefined,
    { staleTime: Infinity, enabled: isOpen },
  );

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

  const legendDomains = useMemo(() => parseDomains(selectedLegend?.domain ?? null), [selectedLegend]);

  // Partition entries by zone category
  const legendEntry = entries.find((e) => e.zone === 'legend');
  const championEntry = entries.find((e) => e.zone === 'champion');
  const mainEntries = entries.filter((e) => e.zone === 'main' || e.zone === 'champion');
  const runeEntries = entries.filter((e) => e.zone === 'rune');
  const battlefieldEntries = entries.filter((e) => e.zone === 'battlefield');

  const mainCount = mainEntries.reduce((s, e) => s + e.quantity, 0);
  const runeCount = runeEntries.reduce((s, e) => s + e.quantity, 0);
  const battlefieldCount = battlefieldEntries.length;

  // Validation
  const validation = useMemo(() => {
    const hasChampion = !!championEntry;
    const mainOk = mainCount === MAIN_DECK_SIZE && hasChampion;
    const runeOk = runeCount === RUNE_DECK_SIZE;
    const bfOk = battlefieldCount === BATTLEFIELD_COUNT;
    // All signature cards must match the legend's domain
    const legendDomain = legendEntry?.card.domain ?? null;
    const signaturesOk = entries
      .filter((e) => isSignatureCard(e.card.cardType))
      .every((e) => e.card.domain === legendDomain);
    return {
      mainOk,
      runeOk,
      bfOk,
      hasChampion,
      isValid: mainOk && runeOk && bfOk && signaturesOk,
    };
  }, [mainCount, runeCount, battlefieldCount, championEntry, entries, legendEntry]);

  // — Entry mutation helpers —

  const addCard = useCallback((card: CardItem) => {
    setEntries((prev) => {
      // Signature cards must match the legend's exact domain pair
      if (isSignatureCard(card.cardType)) {
        const legend = prev.find((e) => e.zone === 'legend');
        if (!legend || card.domain !== legend.card.domain) return prev;
      }

      // Determine target zone FIRST, then find existing entry in that zone
      let zone: DeckZone = 'main';
      if (card.cardType === 'Rune') zone = 'rune';
      else if (card.cardType === 'Battlefield') zone = 'battlefield';
      else if (card.cardType === 'Champion Unit') {
        const hasChampion = prev.some((e) => e.zone === 'champion');
        zone = hasChampion ? 'main' : 'champion';
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

      // Main deck: enforce size limit
      const currentMainTotal = prev
        .filter((e) => e.zone === 'main')
        .reduce((s, e) => s + e.quantity, 0);
      if (currentMainTotal >= MAIN_DECK_SIZE) return prev;

      // Per-card copy limits (count across main zone only for this card)
      const maxCopies = isSignatureCard(card.cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;
      const existing = prev.find((e) => e.card.id === card.id && e.zone === 'main');
      if (existing) {
        if (existing.quantity >= maxCopies) return prev;
        return prev.map((e) => e.card.id === card.id && e.zone === 'main' ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { card, quantity: 1, zone }];
    });
  }, []);

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
      setStep('build');
    } else if (step === 'build') {
      setStep('review');
    }
  };

  const goBack = () => {
    if (step === 'legend') setStep('name');
    else if (step === 'build') setStep('legend');
    else if (step === 'review') setStep('build');
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

  const renderBuild = () => {
    if (!selectedLegend) return null;

    return (
      <div className="flex flex-col lg:flex-row h-full overflow-hidden">
        {/* Left panel — deck sections */}
        <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-surface-border flex flex-col overflow-hidden">
          <div className="p-4 overflow-y-auto flex-1 space-y-5">

            {/* Legend (locked) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">Legend</span>
                <span className="text-xs text-green-400">✓ 1/1</span>
              </div>
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
                <span className="lg-badge bg-zinc-800 text-zinc-400 text-[9px] ml-auto shrink-0">Locked</span>
              </div>
            </div>

            {/* Main Deck */}
            <div>
              <SectionHeader
                title="Main Deck"
                count={mainCount}
                max={MAIN_DECK_SIZE}
                valid={validation.mainOk}
                extra={!validation.hasChampion ? '(needs Champion Unit)' : undefined}
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
          { label: 'Legend', items: legendEntry ? [legendEntry] : [], max: 1, count: 1 },
          { label: 'Main Deck', items: mainEntries, max: MAIN_DECK_SIZE, count: mainCount },
          { label: 'Rune Deck', items: runeEntries, max: RUNE_DECK_SIZE, count: runeCount },
          { label: 'Battlefields', items: battlefieldEntries, max: BATTLEFIELD_COUNT, count: battlefieldEntries.length },
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

  const isTallStep = step === 'legend' || step === 'build' || step === 'review';

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
          {step === 'build' && renderBuild()}
          {step === 'review' && renderReview()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-border shrink-0 gap-3">
          <button
            type="button"
            onClick={step === 'name' ? handleClose : goBack}
            className="lg-btn-secondary"
          >
            {step === 'name' ? 'Cancel' : 'Back'}
          </button>

          {step === 'review' ? (
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
          )}
        </div>
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
