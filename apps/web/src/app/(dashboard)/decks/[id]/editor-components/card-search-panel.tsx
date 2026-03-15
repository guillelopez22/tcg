'use client';

import Image from 'next/image';
import { CARD_RARITIES, CARD_DOMAINS, type DeckZone } from '@la-grieta/shared';
import { RARITY_COLORS, DOMAIN_COLORS } from '@/lib/design-tokens';
import type { RefObject } from 'react';
import { ZONE_LABELS, ZONE_LIMITS, getCopyLimit, type DeckEntry } from '../use-deck-editor';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

type CardItem = inferRouterOutputs<AppRouter>['card']['list']['items'][number];
type SuggestionItem = inferRouterOutputs<AppRouter>['deck']['suggest'][number];
type SetItem = inferRouterOutputs<AppRouter>['card']['sets'][number];

const FALLBACK_RARITY = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' };

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

interface CardSearchPanelProps {
  // panel mode
  searchPanel: 'search' | 'suggested';
  setSearchPanel: (p: 'search' | 'suggested') => void;
  // search state
  search: string;
  setSearch: (s: string) => void;
  setSlug: string;
  setSetSlug: (s: string) => void;
  rarity: string;
  setRarity: (s: string) => void;
  domain: string;
  setDomain: (s: string) => void;
  setsData: SetItem[] | undefined;
  searchCards: CardItem[];
  isSearchLoading: boolean;
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  loadMoreRef: RefObject<HTMLDivElement>;
  // suggestions
  suggestions: SuggestionItem[];
  isSuggestLoading: boolean;
  suggestMode: 'owned_first' | 'best_fit';
  setSuggestMode: (m: 'owned_first' | 'best_fit') => void;
  refetchSuggestions: () => void;
  expandedReason: string | null;
  setExpandedReason: (id: string | null) => void;
  // ownership
  ownershipMap: Map<string, number>;
  // zone context
  activeZone: DeckZone;
  zoneCounts: Record<DeckZone, number>;
  // entry helpers
  getTotalCopies: (id: string) => number;
  getQuantityInZone: (id: string, zone: DeckZone) => number;
  addedCardId: string | null;
  // actions
  onAddCard: (card: CardItem) => void;
  onAddSuggestion: (s: SuggestionItem) => void;
}

export function CardSearchPanel({
  searchPanel, setSearchPanel,
  search, setSearch,
  setSlug, setSetSlug,
  rarity, setRarity,
  domain, setDomain,
  setsData,
  searchCards, isSearchLoading,
  hasNextPage, isFetchingNextPage, loadMoreRef,
  suggestions, isSuggestLoading,
  suggestMode, setSuggestMode,
  refetchSuggestions,
  expandedReason, setExpandedReason,
  ownershipMap,
  activeZone, zoneCounts,
  getTotalCopies, getQuantityInZone,
  addedCardId,
  onAddCard, onAddSuggestion,
}: CardSearchPanelProps) {
  return (
    <div className="lg:flex-1 space-y-3 min-w-0">
      {/* Panel toggle */}
      <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-lg">
        <button
          onClick={() => setSearchPanel('search')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            searchPanel === 'search'
              ? 'bg-surface-card text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setSearchPanel('suggested')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
            searchPanel === 'suggested'
              ? 'bg-surface-card text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Suggested
        </button>
      </div>

      {/* Search panel */}
      {searchPanel === 'search' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="search"
              placeholder="Search cards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lg-input col-span-2"
              aria-label="Search cards by name"
            />
            <select value={setSlug} onChange={(e) => setSetSlug(e.target.value)} className="lg-select w-full" aria-label="Filter by set">
              <option value="">All Sets</option>
              {setsData?.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
            </select>
            <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="lg-select w-full" aria-label="Filter by rarity">
              <option value="">All Rarities</option>
              {CARD_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="lg-select w-full" aria-label="Filter by domain">
              <option value="">All Domains</option>
              {CARD_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="text-xs text-zinc-500 flex items-center">
              Zone: <span className="text-zinc-300 ml-1 font-medium">{ZONE_LABELS[activeZone]}</span>
              {activeZone === 'rune' && <span className="ml-1 text-zinc-600">(runes only)</span>}
              {activeZone === 'legend' && <span className="ml-1 text-zinc-600">(legends only)</span>}
              {activeZone === 'champion' && <span className="ml-1 text-zinc-600">(champion units only)</span>}
              {activeZone === 'battlefield' && <span className="ml-1 text-zinc-600">(battlefields only)</span>}
            </div>
          </div>

          <div className="lg-card overflow-hidden max-h-[420px] overflow-y-auto">
            {isSearchLoading && (
              <div role="status" className="flex justify-center py-8">
                <span className="sr-only">Loading cards</span>
                <div className="lg-spinner" aria-hidden />
              </div>
            )}
            {!isSearchLoading && searchCards.length === 0 && (
              <p className="text-center py-8 lg-text-muted">No cards found.</p>
            )}
            <ul className="divide-y divide-surface-border">
              {searchCards.map((card) => {
                const qty = getQuantityInZone(card.id, activeZone);
                const copies = getTotalCopies(card.id);
                const zoneCount = zoneCounts[activeZone];
                const atMax = (activeZone === 'main' || activeZone === 'sideboard') && copies >= getCopyLimit(card.cardType ?? null);
                const zoneFull = zoneCount >= ZONE_LIMITS[activeZone];
                const disabled = atMax;
                const rarityColors = RARITY_COLORS[card.rarity] ?? FALLBACK_RARITY;
                const cardDomain = card.domain?.split(';')[0] ?? null;
                const domainColor = cardDomain ? DOMAIN_COLORS[cardDomain] : null;
                const border = domainColor?.border ?? rarityColors.border;
                const justAdded = addedCardId === card.id;
                const owned = ownershipMap.get(card.id) ?? 0;
                return (
                  <li key={card.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-shrink-0">
                      {card.imageSmall ? (
                        <div className={`relative w-8 h-11 rounded overflow-hidden border-2 ${border}`}>
                          <Image src={card.imageSmall} alt={card.name} fill sizes="32px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-11 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                          <span className="text-zinc-600 text-xs" aria-hidden>?</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{card.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {cardDomain && domainColor ? (
                          <span className={`lg-badge ${domainColor.text} ${domainColor.bg}`}>{cardDomain}</span>
                        ) : (
                          <span className={`lg-badge ${rarityColors.text} ${rarityColors.bg}`}>{card.rarity}</span>
                        )}
                        {qty > 0 && <span className="text-xs text-zinc-500">x{qty}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          owned > 0 ? 'text-rift-400 bg-rift-950/50' : 'text-zinc-600 bg-zinc-900/50'
                        }`}>
                          Own: {owned}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddCard(card)}
                      disabled={disabled}
                      aria-label={`Add ${card.name} to ${ZONE_LABELS[activeZone]}`}
                      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                        justAdded
                          ? 'border-rift-500 text-rift-400 bg-rift-950'
                          : disabled
                            ? 'border-surface-border text-zinc-600 cursor-not-allowed'
                            : zoneFull
                              ? 'border-amber-700/50 text-amber-400 hover:bg-amber-900/20'
                              : 'border-surface-border text-zinc-400 hover:border-rift-500 hover:text-rift-400'
                      }`}
                      title={zoneFull ? `${ZONE_LABELS[activeZone]} is full — click to swap` : undefined}
                    >
                      {justAdded ? '✓' : zoneFull ? '⇄' : '+'}
                    </button>
                  </li>
                );
              })}
            </ul>
            {hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isFetchingNextPage && (
                  <div role="status" className="lg-spinner-sm"><span className="sr-only">Loading more</span></div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Suggestions panel */}
      {searchPanel === 'suggested' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-lg flex-1">
              <button
                onClick={() => setSuggestMode('owned_first')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                  suggestMode === 'owned_first'
                    ? 'bg-surface-card text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Owned first
              </button>
              <button
                onClick={() => setSuggestMode('best_fit')}
                className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
                  suggestMode === 'best_fit'
                    ? 'bg-surface-card text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Best fit
              </button>
            </div>
            <button
              onClick={() => void refetchSuggestions()}
              aria-label="Refresh suggestions"
              className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors rounded-lg hover:bg-surface-elevated"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <div className="lg-card overflow-hidden max-h-[420px] overflow-y-auto">
            {isSuggestLoading && (
              <div role="status" className="flex justify-center py-8">
                <span className="sr-only">Loading suggestions</span>
                <div className="lg-spinner" aria-hidden />
              </div>
            )}
            {!isSuggestLoading && suggestions.length === 0 && (
              <p className="text-center py-8 lg-text-muted">No suggestions available.</p>
            )}
            <ul className="divide-y divide-surface-border">
              {suggestions.map((suggestion) => {
                const rarityColors = RARITY_COLORS[suggestion.card.rarity] ?? FALLBACK_RARITY;
                const cardDomain = suggestion.card.domain?.split(';')[0] ?? null;
                const domainColor = cardDomain ? DOMAIN_COLORS[cardDomain] : null;
                const border = domainColor?.border ?? rarityColors.border;
                const owned = ownershipMap.get(suggestion.cardId) ?? 0;
                const isExpanded = expandedReason === suggestion.cardId;
                const tagColor = getReasonTagColor(suggestion.reasonTag);
                return (
                  <li key={suggestion.cardId} className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {suggestion.card.imageSmall ? (
                          <div className={`relative w-8 h-11 rounded overflow-hidden border-2 ${border}`}>
                            <Image src={suggestion.card.imageSmall} alt={suggestion.card.name} fill sizes="32px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-11 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                            <span className="text-zinc-600 text-xs" aria-hidden>?</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{suggestion.card.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {cardDomain && domainColor ? (
                            <span className={`lg-badge ${domainColor.text} ${domainColor.bg}`}>{cardDomain}</span>
                          ) : (
                            <span className={`lg-badge ${rarityColors.text} ${rarityColors.bg}`}>{suggestion.card.rarity}</span>
                          )}
                          <button
                            onClick={() => setExpandedReason(isExpanded ? null : suggestion.cardId)}
                            className={`text-xs px-1.5 py-0.5 rounded border font-medium transition-opacity ${tagColor} ${isExpanded ? 'ring-1 ring-current' : 'hover:opacity-80'}`}
                          >
                            {suggestion.reasonTag}
                          </button>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            owned > 0 ? 'text-rift-400 bg-rift-950/50' : 'text-zinc-600 bg-zinc-900/50'
                          }`}>
                            Own: {owned}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onAddSuggestion(suggestion)}
                        aria-label={`Add ${suggestion.card.name} to deck`}
                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border text-zinc-400 hover:border-rift-500 hover:text-rift-400 text-sm font-bold transition-colors"
                      >
                        +
                      </button>
                    </div>
                    {isExpanded && (
                      <p className="mt-2 text-xs text-zinc-400 pl-11">{suggestion.reasonDetail}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
