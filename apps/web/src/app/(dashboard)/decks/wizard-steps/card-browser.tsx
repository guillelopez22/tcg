'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { MAIN_CARD_TYPES } from '../wizard-types';
import { parseDomains, isSignatureCard } from '../wizard-helpers';
import { CardThumbnail } from './wizard-shared';
import type { LegendCard, CardItem, DeckEntry, BrowserTab } from '../wizard-types';

interface CardBrowserProps {
  legend: LegendCard;
  entries: DeckEntry[];
  onAdd: (card: CardItem) => void;
  activeTab: BrowserTab;
  onTabChange: (tab: BrowserTab) => void;
}

export function CardBrowser({ legend, entries, onAdd, activeTab, onTabChange }: CardBrowserProps) {
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

  const EXCLUDED_FROM_MAIN = new Set(['Legend', 'Rune', 'Battlefield', 'Token']);

  const allCards = useMemo(() => {
    const seen = new Set<string>();
    const merged: CardItem[] = [];
    for (const c of [...(q1.data?.items ?? []), ...(q2.data?.items ?? [])]) {
      if (seen.has(c.id)) continue;
      if ((activeTab === 'main' || activeTab === 'sideboard') && !cardType && EXCLUDED_FROM_MAIN.has(c.cardType ?? '')) continue;
      if (isSignatureCard(c.cardType) && c.domain !== legend.domain) continue;
      seen.add(c.id);
      merged.push(c);
    }
    return merged;
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
