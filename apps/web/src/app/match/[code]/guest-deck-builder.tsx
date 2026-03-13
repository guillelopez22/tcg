'use client';

// Guest deck builder for the match flow — same legend-first, domain-filtered
// build UX as the main deck wizard, but outputs a TempDeck (no API creation).
// Persists to sessionStorage so guests don't lose progress on refresh.

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
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

export interface TempDeckEntry {
  cardId: string;
  quantity: number;
  zone: DeckZone;
  card: {
    id: string;
    name: string;
    rarity: string;
    cardType: string | null;
    domain: string | null;
    imageSmall: string | null;
  };
}

export interface TempDeck {
  matchCode: string;
  entries: TempDeckEntry[];
  battlefieldCardIds: string[];
}

interface GuestDeckBuilderProps {
  matchCode: string;
  onDeckReady: (deck: TempDeck) => void;
}

interface DeckEntry {
  card: CardItem;
  quantity: number;
  zone: DeckZone;
}

type BuilderStep = 'legend' | 'build';
type BrowserTab = 'main' | 'rune' | 'battlefield';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FALLBACK_DOMAIN = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700' };
const MAIN_CARD_TYPES = ['Unit', 'Champion Unit', 'Spell', 'Gear', 'Signature Unit', 'Signature Spell', 'Signature Gear'] as const;
const EXCLUDED_FROM_MAIN = new Set(['Legend', 'Rune', 'Battlefield', 'Token']);
const STORAGE_KEY_PREFIX = 'lagrieta_temp_deck_';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDomains(domain: string | null): [string, string] | [string] {
  if (!domain) return [''];
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

function toTempEntry(entry: DeckEntry): TempDeckEntry {
  return {
    cardId: entry.card.id,
    quantity: entry.quantity,
    zone: entry.zone,
    card: {
      id: entry.card.id,
      name: entry.card.name,
      rarity: entry.card.rarity ?? 'Common',
      cardType: entry.card.cardType,
      domain: entry.card.domain,
      imageSmall: entry.card.imageSmall,
    },
  };
}

// Session storage persistence
function saveTempDeck(matchCode: string, entries: DeckEntry[], legend: LegendCard | null) {
  if (typeof window === 'undefined') return;
  try {
    const tempEntries = entries.map(toTempEntry);
    sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${matchCode}`,
      JSON.stringify({ entries: tempEntries, legend }),
    );
  } catch { /* sessionStorage may be unavailable */ }
}

function loadTempDeck(matchCode: string): { entries: TempDeckEntry[]; legend: LegendCard | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${matchCode}`);
    if (!raw) return null;
    return JSON.parse(raw) as { entries: TempDeckEntry[]; legend: LegendCard | null };
  } catch { return null; }
}

export function clearTempDeck(matchCode: string) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${matchCode}`); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DomainBadge({ domain }: { domain: string }) {
  return <span className={`lg-badge border text-[9px] ${getDomainBadge(domain)}`}>{domain}</span>;
}

function SectionHeader({ title, count, max, valid, extra }: {
  title: string; count: number; max: number; valid: boolean; extra?: string;
}) {
  const pct = Math.min(count / max, 1);
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{title}</span>
          {extra && <span className="lg-text-muted text-[10px]">{extra}</span>}
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

function EntryRow({ entry, onRemove, onRemoveFully }: {
  entry: DeckEntry;
  onRemove: (cardId: string) => void;
  onRemoveFully: (cardId: string) => void;
}) {
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
          onClick={() => zone === 'battlefield' ? onRemoveFully(card.id) : onRemove(card.id)}
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

// ---------------------------------------------------------------------------
// Card browser — queries by legend domains, tabbed for main/rune/battlefield
// ---------------------------------------------------------------------------

function CardBrowser({ legend, entries, onAdd, activeTab, onTabChange }: {
  legend: LegendCard;
  entries: DeckEntry[];
  onAdd: (card: CardItem) => void;
  activeTab: BrowserTab;
  onTabChange: (tab: BrowserTab) => void;
}) {
  const domains = parseDomains(legend.domain);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const cardType = activeTab === 'rune'
    ? 'Rune'
    : activeTab === 'battlefield'
      ? 'Battlefield'
      : typeFilter !== 'all' ? typeFilter : undefined;

  const q1 = trpc.card.list.useQuery(
    {
      domain: activeTab === 'battlefield' ? undefined : domains[0] || undefined,
      cardType,
      search: search || undefined,
      limit: 100,
    },
    { staleTime: 60_000, enabled: activeTab !== 'rune' || !!domains[0] },
  );

  const q2 = trpc.card.list.useQuery(
    {
      domain: domains[1] || undefined,
      cardType,
      search: search || undefined,
      limit: 100,
    },
    { staleTime: 60_000, enabled: !!domains[1] && activeTab !== 'battlefield' },
  );

  const allCards = useMemo(() => {
    const seen = new Set<string>();
    const merged: CardItem[] = [];
    for (const c of [...(q1.data?.items ?? []), ...(q2.data?.items ?? [])]) {
      if (seen.has(c.id)) continue;
      if (activeTab === 'main' && !cardType && EXCLUDED_FROM_MAIN.has(c.cardType ?? '')) continue;
      seen.add(c.id);
      merged.push(c);
    }
    return merged;
  }, [q1.data, q2.data, activeTab, cardType]);

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

      <div className="p-3 flex gap-2 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
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

      <div className="overflow-y-auto flex-1 p-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <div className="lg-spinner" />
            <span className="sr-only">Loading cards</span>
          </div>
        ) : allCards.length === 0 ? (
          <p className="lg-text-muted text-center py-8">No cards found</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {allCards.map((card) => {
              const entry = entryMap.get(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onAdd(card)}
                  aria-label={`Add ${card.name}`}
                  className={[
                    'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 text-left',
                    'hover:border-rift-500/60 focus-visible:ring-2 focus-visible:ring-rift-500',
                    entry ? 'border-rift-500 bg-rift-950/30' : 'border-surface-border bg-surface-card',
                  ].join(' ')}
                >
                  <div className="relative w-full aspect-[2/3] bg-zinc-900">
                    {card.imageSmall ? (
                      <Image src={card.imageSmall} alt={card.name} fill sizes="(max-width: 768px) 80px, 100px" className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-zinc-600 text-[10px] text-center px-1">{card.name}</span>
                      </div>
                    )}
                    {entry && entry.quantity > 0 && (
                      <div className="lg-badge-count">{entry.quantity}</div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] font-medium text-white line-clamp-2 leading-tight">{card.name}</p>
                    {card.cardType && (
                      <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{card.cardType}</p>
                    )}
                  </div>
                </button>
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

export function GuestDeckBuilder({ matchCode, onDeckReady }: GuestDeckBuilderProps) {
  // — All state at top (Rules of Hooks) —
  const [step, setStep] = useState<BuilderStep>('legend');
  const [selectedLegend, setSelectedLegend] = useState<LegendCard | null>(null);
  const [legendSearch, setLegendSearch] = useState('');
  const [legendDomainFilter, setLegendDomainFilter] = useState('all');
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [browserTab, setBrowserTab] = useState<BrowserTab>('main');

  // Fetch legends
  const { data: legendsData, isLoading: legendsLoading } = trpc.card.legends.useQuery(
    undefined,
    { staleTime: Infinity },
  );

  // Restore from sessionStorage on mount
  useEffect(() => {
    const saved = loadTempDeck(matchCode);
    if (saved && saved.entries.length > 0 && saved.legend) {
      setSelectedLegend(saved.legend);
      // Reconstruct DeckEntry from TempDeckEntry — card data is partial but sufficient
      const restored: DeckEntry[] = saved.entries.map((e) => ({
        card: e.card as unknown as CardItem,
        quantity: e.quantity,
        zone: e.zone,
      }));
      setEntries(restored);
      setStep('build');
    }
  }, [matchCode]);

  // Persist on changes
  useEffect(() => {
    if (entries.length > 0) {
      saveTempDeck(matchCode, entries, selectedLegend);
    }
  }, [entries, matchCode, selectedLegend]);

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

  const championEntry = entries.find((e) => e.zone === 'champion');
  const mainEntries = entries.filter((e) => e.zone === 'main' || e.zone === 'champion');
  const runeEntries = entries.filter((e) => e.zone === 'rune');
  const battlefieldEntries = entries.filter((e) => e.zone === 'battlefield');

  const mainCount = mainEntries.reduce((s, e) => s + e.quantity, 0);
  const runeCount = runeEntries.reduce((s, e) => s + e.quantity, 0);
  const battlefieldCount = battlefieldEntries.length;

  const validation = useMemo(() => {
    const hasChampion = !!championEntry;
    const mainOk = mainCount === MAIN_DECK_SIZE && hasChampion;
    const runeOk = runeCount === RUNE_DECK_SIZE;
    const bfOk = battlefieldCount === BATTLEFIELD_COUNT;
    return { mainOk, runeOk, bfOk, hasChampion, isValid: mainOk && runeOk && bfOk };
  }, [mainCount, runeCount, battlefieldCount, championEntry]);

  // — Entry mutation —

  const addCard = useCallback((card: CardItem) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.card.id === card.id);

      let zone: DeckZone = 'main';
      if (card.cardType === 'Rune') zone = 'rune';
      else if (card.cardType === 'Battlefield') zone = 'battlefield';
      else if (card.cardType === 'Champion Unit') {
        const hasChampion = prev.some((e) => e.zone === 'champion');
        zone = hasChampion ? 'main' : 'champion';
      }

      // Battlefield: unique names only, max 3
      if (zone === 'battlefield') {
        const alreadyHave = prev.some((e) => e.zone === 'battlefield' && e.card.name === card.name);
        if (alreadyHave || prev.filter((e) => e.zone === 'battlefield').length >= BATTLEFIELD_COUNT) return prev;
        return [...prev, { card, quantity: 1, zone }];
      }

      // Runes: no per-card copy limit, only total (12)
      if (zone === 'rune') {
        const currentRuneTotal = prev.filter((e) => e.zone === 'rune').reduce((s, e) => s + e.quantity, 0);
        if (currentRuneTotal >= RUNE_DECK_SIZE) return prev;
        if (existing) {
          return prev.map((e) => e.card.id === card.id ? { ...e, quantity: e.quantity + 1 } : e);
        }
        return [...prev, { card, quantity: 1, zone }];
      }

      // Main deck: per-card copy limits
      const maxCopies = isSignatureCard(card.cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;
      if (existing) {
        if (existing.quantity >= maxCopies) return prev;
        return prev.map((e) => e.card.id === card.id ? { ...e, quantity: e.quantity + 1 } : e);
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

  // — Ready handler —

  function handleReady() {
    const tempEntries = entries.map(toTempEntry);
    const battlefieldCardIds = entries
      .filter((e) => e.card.cardType === 'Battlefield')
      .map((e) => e.card.id);
    onDeckReady({ matchCode, entries: tempEntries, battlefieldCardIds });
  }

  // — Legend step —

  if (step === 'legend') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Pick your Legend</h2>
          <p className="lg-text-secondary text-sm">Your Legend defines the deck's domains.</p>
        </div>

        <div className="flex gap-2">
          <input
            type="search"
            value={legendSearch}
            onChange={(e) => setLegendSearch(e.target.value)}
            placeholder="Search legends..."
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

        <div className="max-h-[50vh] overflow-y-auto">
          {legendsLoading ? (
            <div className="flex items-center justify-center py-12" role="status">
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
                      'relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 text-left',
                      isSelected
                        ? 'border-rift-500 ring-2 ring-rift-500/40'
                        : 'border-surface-border hover:border-rift-500/50',
                    ].join(' ')}
                  >
                    <div className="relative w-full aspect-[2/3] bg-zinc-900">
                      {legend.imageSmall ? (
                        <Image src={legend.imageSmall} alt={legend.name} fill sizes="(max-width: 768px) 45vw, 30vw" className="object-cover" />
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

        {selectedLegend && (
          <div className="lg-card p-3 flex items-center gap-3 bg-rift-950/50 border-rift-700/50">
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

        <button
          type="button"
          onClick={() => {
            if (!selectedLegend) return;
            // Add legend to entries if not already
            setEntries((prev) => {
              const hasLegend = prev.some((e) => e.zone === 'legend');
              if (hasLegend) return prev;
              return [...prev, { card: selectedLegend as unknown as CardItem, quantity: 1, zone: 'legend' }];
            });
            setStep('build');
          }}
          disabled={!selectedLegend}
          className="lg-btn-primary w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Build Deck
        </button>
      </div>
    );
  }

  // — Build step (same layout as deck wizard) —

  if (!selectedLegend) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Build Your Deck</h2>
        <button
          type="button"
          onClick={() => setStep('legend')}
          className="text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Change Legend
        </button>
      </div>

      {/* Split layout: deck sections + card browser */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-0 border border-surface-border rounded-xl overflow-hidden bg-surface-card" style={{ minHeight: '60vh' }}>
        {/* Left — deck sections */}
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
                extra={!validation.hasChampion ? '(needs Champion)' : undefined}
              />
              {mainEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No cards yet</p>
              ) : (
                <div className="space-y-1">
                  {mainEntries.map((e) => (
                    <EntryRow key={e.card.id} entry={e} onRemove={removeCard} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>

            {/* Rune Deck */}
            <div>
              <SectionHeader title="Rune Deck" count={runeCount} max={RUNE_DECK_SIZE} valid={validation.runeOk} />
              {runeEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No runes yet</p>
              ) : (
                <div className="space-y-1">
                  {runeEntries.map((e) => (
                    <EntryRow key={e.card.id} entry={e} onRemove={removeCard} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>

            {/* Battlefields */}
            <div>
              <SectionHeader title="Battlefields" count={battlefieldCount} max={BATTLEFIELD_COUNT} valid={validation.bfOk} />
              {battlefieldEntries.length === 0 ? (
                <p className="lg-text-muted text-center py-3">No battlefields yet</p>
              ) : (
                <div className="space-y-1">
                  {battlefieldEntries.map((e) => (
                    <EntryRow key={e.card.id} entry={e} onRemove={removeCardFully} onRemoveFully={removeCardFully} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — card browser */}
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

      {/* Ready button */}
      <button
        type="button"
        onClick={handleReady}
        disabled={!validation.isValid}
        className="lg-btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {validation.isValid ? 'Deck Ready — Continue' : 'Complete your deck to continue'}
      </button>
    </div>
  );
}
