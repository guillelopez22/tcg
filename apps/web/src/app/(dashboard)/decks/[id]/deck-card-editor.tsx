'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { trpc } from '@/lib/trpc';
import {
  CARD_RARITIES,
  CARD_TYPES,
  CARD_DOMAINS,
  DECK_ZONES,
  type DeckZone,
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  CHAMPION_COUNT,
  SIDEBOARD_SIZE,
  SIGNATURE_TYPES,
  getZoneForCardType,
  validateDeckFormat,
  computeAnalytics,
} from '@la-grieta/shared';
import { RARITY_COLORS, DOMAIN_COLORS } from '@/lib/design-tokens';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

// ---------------------------------------------------------------------------
// Constants and types
// ---------------------------------------------------------------------------

const FALLBACK_RARITY = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' };

const ZONE_LABELS: Record<DeckZone, string> = {
  main: 'Main',
  rune: 'Runes',
  champion: 'Champion',
  sideboard: 'Sideboard',
};

const ZONE_LIMITS: Record<DeckZone, number> = {
  main: MAIN_DECK_SIZE,
  rune: RUNE_DECK_SIZE,
  champion: CHAMPION_COUNT,
  sideboard: SIDEBOARD_SIZE,
};

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

type CardItem = inferRouterOutputs<AppRouter>['card']['list']['items'][number];
type DeckCard = inferRouterOutputs<AppRouter>['deck']['getById']['cards'][number];

interface DeckEntry {
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
    energyCost?: number | null;
  };
}

interface SwapPrompt {
  zone: DeckZone;
  incomingCard: CardItem;
}

interface AutoCompletePreview {
  zone: DeckZone;
  cards: Array<{
    cardId: string;
    name: string;
    imageSmall: string | null;
    rarity: string;
    reasonTag: string;
    quantity: number;
  }>;
}

// ---------------------------------------------------------------------------
// useDebounce
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DeckCardEditorProps {
  deckId: string;
  initialCards: DeckCard[];
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeckCardEditor({ deckId, initialCards, onClose, onSaved }: DeckCardEditorProps) {
  // --------------------------------------------------
  // State
  // --------------------------------------------------

  const [activeZone, setActiveZone] = useState<DeckZone>('main');
  const [searchPanel, setSearchPanel] = useState<'search' | 'suggested'>('search');
  const [suggestMode, setSuggestMode] = useState<'owned_first' | 'best_fit'>('owned_first');
  const [expandedReason, setExpandedReason] = useState<string | null>(null);
  const [swapPrompt, setSwapPrompt] = useState<SwapPrompt | null>(null);
  const [autoCompletePreview, setAutoCompletePreview] = useState<AutoCompletePreview | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addedCardId, setAddedCardId] = useState<string | null>(null);

  // Build initial entries from initialCards
  const [entries, setEntries] = useState<DeckEntry[]>(() =>
    initialCards.map((dc): DeckEntry => ({
      cardId: dc.cardId,
      quantity: dc.quantity,
      zone: ((dc as DeckCard & { zone?: string }).zone ?? getZoneForCardType(dc.card.cardType)) as DeckZone,
      card: {
        id: dc.card.id,
        name: dc.card.name,
        rarity: dc.card.rarity,
        cardType: dc.card.cardType,
        domain: dc.card.domain,
        imageSmall: dc.card.imageSmall,
      },
    }))
  );

  // Search filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [setSlug, setSetSlug] = useState('');
  const [rarity, setRarity] = useState('');
  const [domain, setDomain] = useState('');

  // --------------------------------------------------
  // Zone-aware card type filtering
  // --------------------------------------------------

  const zoneCardTypeFilter = useMemo((): string | undefined => {
    if (activeZone === 'rune') return 'Rune';
    if (activeZone === 'champion') return 'Legend';
    return undefined; // main + sideboard: handled by exclusion below
  }, [activeZone]);

  // --------------------------------------------------
  // Data queries
  // --------------------------------------------------

  const { data: setsData } = trpc.card.sets.useQuery(undefined, { staleTime: Infinity });

  const {
    data: searchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isSearchLoading,
  } = trpc.card.list.useInfiniteQuery(
    {
      search: debouncedSearch || undefined,
      setSlug: setSlug || undefined,
      rarity: (rarity as typeof CARD_RARITIES[number]) || undefined,
      cardType: zoneCardTypeFilter,
      domain: domain || undefined,
      limit: 20,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: undefined,
      staleTime: 5 * 60 * 1000,
      enabled: searchPanel === 'search',
    },
  );

  // All cards from search, with client-side exclusion for main/sideboard zones
  const searchCards = useMemo(() => {
    const all = searchData?.pages.flatMap((page) => page.items) ?? [];
    if (activeZone === 'main' || activeZone === 'sideboard') {
      return all.filter((c) => c.cardType !== 'Legend' && c.cardType !== 'Rune');
    }
    return all;
  }, [searchData, activeZone]);

  // Load user collection for ownership badges (all cards, up to 200)
  const { data: collectionData } = trpc.collection.list.useQuery(
    { limit: 200 },
    { staleTime: 5 * 60 * 1000 },
  );

  // Build ownership map: cardId -> count of copies owned
  const ownershipMap = useMemo((): Map<string, number> => {
    const map = new Map<string, number>();
    if (!collectionData?.items) return map;
    for (const entry of collectionData.items) {
      const cardId = entry.card.id;
      map.set(cardId, (map.get(cardId) ?? 0) + 1);
    }
    return map;
  }, [collectionData]);

  // Suggestions
  const { data: suggestionsData, isLoading: isSuggestLoading, refetch: refetchSuggestions } = trpc.deck.suggest.useQuery(
    { deckId, mode: suggestMode, zone: activeZone },
    { enabled: searchPanel === 'suggested', staleTime: 0 },
  );
  const suggestions = suggestionsData ?? [];

  // --------------------------------------------------
  // Intersection observer for infinite scroll
  // --------------------------------------------------

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void fetchNextPage(); },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --------------------------------------------------
  // Mutations
  // --------------------------------------------------

  const utils = trpc.useUtils();

  const setCardsMutation = trpc.deck.setCards.useMutation({
    onSuccess: () => {
      void utils.deck.getById.invalidate({ id: deckId });
      onSaved();
    },
    onError: (err) => {
      setSaveError(err.message ?? 'Failed to save deck. Please try again.');
    },
  });

  const wishlistMutation = trpc.wishlist.toggle.useMutation({
    onSuccess: () => { toast.success('Added to wantlist'); },
    onError: () => { toast.error('Failed to add to wantlist'); },
  });

  // --------------------------------------------------
  // Derived state: zone counts and totals
  // --------------------------------------------------

  const zoneCounts = useMemo((): Record<DeckZone, number> => {
    const counts: Record<DeckZone, number> = { main: 0, rune: 0, champion: 0, sideboard: 0 };
    for (const entry of entries) {
      counts[entry.zone] = (counts[entry.zone] ?? 0) + entry.quantity;
    }
    return counts;
  }, [entries]);

  const zoneEntries = useMemo(
    () => entries.filter((e) => e.zone === activeZone),
    [entries, activeZone]
  );

  // --------------------------------------------------
  // Validity bar: shared validateDeckFormat (same as server)
  // --------------------------------------------------

  const validationErrors = useMemo(() => {
    const flatEntries = entries.map((e) => ({
      cardId: e.cardId,
      quantity: e.quantity,
      zone: e.zone,
    }));
    const cardTypeMap = new Map<string, string | null>(
      entries.map((e) => [e.cardId, e.card.cardType])
    );
    return validateDeckFormat(flatEntries, cardTypeMap);
  }, [entries]);

  const isValid = validationErrors.length === 0;

  // --------------------------------------------------
  // Mini analytics for main zone (recharts)
  // --------------------------------------------------

  const analytics = useMemo(() => {
    const mainCards = entries
      .filter((e) => e.zone === 'main')
      .map((e) => ({
        energyCost: (e.card as { energyCost?: number | null }).energyCost ?? null,
        domain: e.card.domain,
        quantity: e.quantity,
      }));
    return computeAnalytics(mainCards);
  }, [entries]);

  const energyCurveData = useMemo(() => {
    const buckets = [0, 1, 2, 3, 4, 5, 6, 7, '8+'];
    return buckets.map((bucket) => ({
      cost: String(bucket),
      count: analytics.energyCurve[bucket] ?? 0,
    }));
  }, [analytics]);

  const domainPieData = useMemo(() => {
    return Object.entries(analytics.domainDistribution).map(([domain, count]) => ({
      name: domain,
      value: count,
    }));
  }, [analytics]);

  const PIE_COLORS = ['#f87171', '#4ade80', '#60a5fa', '#fb923c', '#c084fc', '#facc15', '#94a3b8'];

  // --------------------------------------------------
  // Copy limit helpers
  // --------------------------------------------------

  function getTotalCopies(cardId: string): number {
    return entries
      .filter((e) => e.cardId === cardId && (e.zone === 'main' || e.zone === 'sideboard'))
      .reduce((sum, e) => sum + e.quantity, 0);
  }

  function getQuantityInZone(cardId: string, zone: DeckZone): number {
    return entries.find((e) => e.cardId === cardId && e.zone === zone)?.quantity ?? 0;
  }

  function isSignatureCard(cardType: string | null): boolean {
    return cardType !== null && (SIGNATURE_TYPES as readonly string[]).includes(cardType);
  }

  function getCopyLimit(cardType: string | null): number {
    return isSignatureCard(cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;
  }

  // --------------------------------------------------
  // Add card logic
  // --------------------------------------------------

  function addCardToZone(card: { id: string; name: string; rarity: string; cardType: string | null; domain: string | null; imageSmall: string | null }, zone: DeckZone) {
    const limit = getCopyLimit(card.cardType);
    const copies = getTotalCopies(card.id);
    const zoneCount = zoneCounts[zone];
    const zoneLimit = ZONE_LIMITS[zone];

    // Check copy limit (for main + sideboard)
    if ((zone === 'main' || zone === 'sideboard') && copies >= limit) {
      toast.error(`Max ${limit} ${isSignatureCard(card.cardType) ? 'copy' : 'copies'} of ${card.name}`);
      return;
    }

    // Check zone capacity
    if (zoneCount >= zoneLimit) {
      setSwapPrompt({ zone, incomingCard: card as CardItem });
      return;
    }

    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.cardId === card.id && e.zone === zone);
      if (idx >= 0) {
        return prev.map((e, i) =>
          i === idx ? { ...e, quantity: e.quantity + 1 } : e
        );
      }
      return [...prev, {
        cardId: card.id,
        quantity: 1,
        zone,
        card: {
          id: card.id,
          name: card.name,
          rarity: card.rarity,
          cardType: card.cardType,
          domain: card.domain,
          imageSmall: card.imageSmall,
        },
      }];
    });

    // Wantlist prompt for unowned cards
    const owned = ownershipMap.get(card.id) ?? 0;
    if (owned === 0) {
      toast("You don't own this card.", {
        action: {
          label: 'Add to wantlist',
          onClick: () => {
            wishlistMutation.mutate({ cardId: card.id, type: 'want' });
          },
        },
        duration: 5000,
      });
    }

    setAddedCardId(card.id);
    setTimeout(() => setAddedCardId(null), 1200);
  }

  function addCard(card: CardItem) {
    addCardToZone(card, activeZone);
  }

  function addSuggestion(suggested: { cardId: string; card: { id: string; name: string; rarity: string; cardType: string | null; domain: string | null; imageSmall: string | null } }) {
    addCardToZone(suggested.card, activeZone);
  }

  function increment(cardId: string, zone: DeckZone) {
    const entry = entries.find((e) => e.cardId === cardId && e.zone === zone);
    if (!entry) return;
    const limit = getCopyLimit(entry.card.cardType);
    const copies = getTotalCopies(cardId);
    const zoneCount = zoneCounts[zone];
    if ((zone === 'main' || zone === 'sideboard') && copies >= limit) return;
    if (zoneCount >= ZONE_LIMITS[zone]) return;
    setEntries((prev) =>
      prev.map((e) => e.cardId === cardId && e.zone === zone ? { ...e, quantity: e.quantity + 1 } : e)
    );
  }

  function decrement(cardId: string, zone: DeckZone) {
    setEntries((prev) => {
      const entry = prev.find((e) => e.cardId === cardId && e.zone === zone);
      if (!entry) return prev;
      if (entry.quantity <= 1) return prev.filter((e) => !(e.cardId === cardId && e.zone === zone));
      return prev.map((e) => e.cardId === cardId && e.zone === zone ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }

  function remove(cardId: string, zone: DeckZone) {
    setEntries((prev) => prev.filter((e) => !(e.cardId === cardId && e.zone === zone)));
  }

  // --------------------------------------------------
  // Swap prompt: replace an existing card with the incoming card
  // --------------------------------------------------

  function handleSwapReplace(existingCardId: string) {
    if (!swapPrompt) return;
    const { zone, incomingCard } = swapPrompt;
    setEntries((prev) => {
      // Remove the replaced card
      const without = prev.filter((e) => !(e.cardId === existingCardId && e.zone === zone));
      // Add incoming card
      const idx = without.findIndex((e) => e.cardId === incomingCard.id && e.zone === zone);
      if (idx >= 0) {
        return without.map((e, i) => i === idx ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...without, {
        cardId: incomingCard.id,
        quantity: 1,
        zone,
        card: {
          id: incomingCard.id,
          name: incomingCard.name,
          rarity: incomingCard.rarity,
          cardType: incomingCard.cardType ?? null,
          domain: incomingCard.domain,
          imageSmall: incomingCard.imageSmall,
        },
      }];
    });
    setSwapPrompt(null);
    // Wantlist prompt for unowned incoming
    const owned = ownershipMap.get(incomingCard.id) ?? 0;
    if (owned === 0) {
      toast("You don't own this card.", {
        action: {
          label: 'Add to wantlist',
          onClick: () => {
            wishlistMutation.mutate({ cardId: incomingCard.id, type: 'want' });
          },
        },
        duration: 5000,
      });
    }
  }

  // --------------------------------------------------
  // Auto-complete
  // --------------------------------------------------

  function handleAutoComplete() {
    if (suggestions.length === 0) return;
    const zoneLimit = ZONE_LIMITS[activeZone];
    const remaining = zoneLimit - zoneCounts[activeZone];
    if (remaining <= 0) return;

    const toAdd = suggestions.slice(0, remaining).map((s) => ({
      cardId: s.cardId,
      name: s.card.name,
      imageSmall: s.card.imageSmall,
      rarity: s.card.rarity,
      reasonTag: s.reasonTag,
      quantity: 1,
    }));

    setAutoCompletePreview({ zone: activeZone, cards: toAdd });
  }

  function confirmAutoComplete() {
    if (!autoCompletePreview) return;
    for (const card of autoCompletePreview.cards) {
      const suggestion = suggestions.find((s) => s.cardId === card.cardId);
      if (suggestion) {
        addCardToZone(suggestion.card, autoCompletePreview.zone);
      }
    }
    setAutoCompletePreview(null);
    toast.success(`Added ${autoCompletePreview.cards.length} cards`);
  }

  // --------------------------------------------------
  // Save
  // --------------------------------------------------

  function handleSave() {
    setSaveError(null);
    setCardsMutation.mutate({
      deckId,
      cards: entries.map((e) => ({
        cardId: e.cardId,
        quantity: e.quantity,
        zone: e.zone,
      })),
    });
  }

  // --------------------------------------------------
  // Render helpers
  // --------------------------------------------------

  const zoneTabsHasSlots = ZONE_LIMITS[activeZone] - zoneCounts[activeZone] > 0;

  return (
    <div className="space-y-4">

      {/* ── Validity Status Bar ── */}
      <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-2 px-4 py-2.5 rounded-lg border text-sm ${
          isValid
            ? 'bg-green-900/20 border-green-700/40 text-green-300'
            : 'bg-red-900/20 border-red-700/40 text-red-300'
        }`}
      >
        {isValid ? (
          <>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Valid deck format</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <span className="font-medium">Format issues: </span>
              {validationErrors.join(' · ')}
            </div>
          </>
        )}
      </div>

      {saveError && (
        <div role="alert" className="lg-alert-error">{saveError}</div>
      )}

      {/* ── Two-panel layout ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

        {/* ── Left: Search / Suggestions Panel ── */}
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

          {/* ── Search panel ── */}
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
                  {activeZone === 'champion' && <span className="ml-1 text-zinc-600">(legends only)</span>}
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
                    const limit = getCopyLimit(card.cardType ?? null);
                    const zoneCount = zoneCounts[activeZone];
                    const atMax = (activeZone === 'main' || activeZone === 'sideboard') && copies >= limit;
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
                            <span className={`lg-badge ${rarityColors.text} ${rarityColors.bg}`}>{card.rarity}</span>
                            {qty > 0 && <span className="text-xs text-zinc-500">x{qty}</span>}
                            {/* Ownership badge */}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              owned > 0
                                ? 'text-rift-400 bg-rift-950/50'
                                : 'text-zinc-600 bg-zinc-900/50'
                            }`}>
                              Own: {owned}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => addCard(card)}
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

          {/* ── Suggestions panel ── */}
          {searchPanel === 'suggested' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {/* Owned first / Best fit toggle */}
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
                              <span className={`lg-badge ${rarityColors.text} ${rarityColors.bg}`}>{suggestion.card.rarity}</span>
                              {/* Reason tag — clickable to expand */}
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
                            onClick={() => addSuggestion(suggestion)}
                            aria-label={`Add ${suggestion.card.name} to deck`}
                            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border text-zinc-400 hover:border-rift-500 hover:text-rift-400 text-sm font-bold transition-colors"
                          >
                            +
                          </button>
                        </div>
                        {/* Expanded reason detail */}
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

        {/* ── Right: Zone tabs + Deck list ── */}
        <div className="lg:w-72 xl:w-80 space-y-3 flex-shrink-0">

          {/* Zone tabs */}
          <div className="flex gap-1 p-1 bg-surface-elevated rounded-lg overflow-x-auto">
            {DECK_ZONES.map((zone) => {
              const count = zoneCounts[zone];
              const limit = ZONE_LIMITS[zone];
              const isActive = zone === activeZone;
              const isFull = count >= limit;
              return (
                <button
                  key={zone}
                  onClick={() => { setActiveZone(zone); setSwapPrompt(null); }}
                  className={`flex-1 py-1.5 px-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-surface-card text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="block">{ZONE_LABELS[zone]}</span>
                  <span className={`text-[10px] ${isFull ? 'text-green-400' : isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {count}/{limit}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Auto-complete button */}
          {zoneTabsHasSlots && (
            <button
              onClick={handleAutoComplete}
              disabled={searchPanel !== 'suggested' || suggestions.length === 0}
              className="w-full text-xs py-1.5 rounded-lg border border-rift-700/50 text-rift-400 hover:bg-rift-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Auto-complete {ZONE_LABELS[activeZone]} ({ZONE_LIMITS[activeZone] - zoneCounts[activeZone]} slots)
            </button>
          )}

          {/* Deck card list for active zone */}
          <div className="lg-card overflow-hidden max-h-[360px] overflow-y-auto">
            {zoneEntries.length === 0 ? (
              <p className="text-center py-8 lg-text-muted text-sm">
                No {ZONE_LABELS[activeZone].toLowerCase()} cards.
              </p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {zoneEntries.map((entry) => {
                  const rarityColors = RARITY_COLORS[entry.card.rarity] ?? FALLBACK_RARITY;
                  const primaryDomain = entry.card.domain?.split(';')[0] ?? null;
                  const domainColor = primaryDomain ? DOMAIN_COLORS[primaryDomain] : null;
                  const cardBorder = domainColor?.border ?? rarityColors.border;
                  return (
                    <li key={`${entry.cardId}-${entry.zone}`} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-shrink-0">
                        {entry.card.imageSmall ? (
                          <div className={`relative w-8 h-11 rounded overflow-hidden border-2 ${cardBorder}`}>
                            <Image src={entry.card.imageSmall} alt={entry.card.name} fill sizes="32px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-11 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                            <span className="text-zinc-600 text-xs" aria-hidden>?</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{entry.card.name}</p>
                        {primaryDomain && domainColor ? (
                          <span className={`lg-badge ${domainColor.text} ${domainColor.bg}`}>{primaryDomain}</span>
                        ) : (
                          <span className={`lg-badge ${rarityColors.text} ${rarityColors.bg}`}>{entry.card.rarity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => decrement(entry.cardId, entry.zone)}
                          aria-label={`Decrease ${entry.card.name}`}
                          className="lg-qty-btn text-base"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold text-white" aria-live="polite">
                          {entry.quantity}
                        </span>
                        <button
                          onClick={() => increment(entry.cardId, entry.zone)}
                          aria-label={`Increase ${entry.card.name}`}
                          className="lg-qty-btn text-base"
                        >
                          +
                        </button>
                        <button
                          onClick={() => remove(entry.cardId, entry.zone)}
                          aria-label={`Remove ${entry.card.name}`}
                          className="lg-btn-danger ml-1 !py-1 !px-2 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Swap prompt — shown when zone is full and user clicks + */}
          {swapPrompt && swapPrompt.zone === activeZone && (
            <div className="lg-card px-3 py-3 space-y-2 border-amber-700/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-amber-300">
                  {ZONE_LABELS[activeZone]} is full. Replace a card?
                </p>
                <button
                  onClick={() => setSwapPrompt(null)}
                  aria-label="Dismiss swap prompt"
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-zinc-500">Adding: <span className="text-white">{swapPrompt.incomingCard.name}</span></p>
              <ul className="divide-y divide-surface-border max-h-40 overflow-y-auto">
                {zoneEntries.map((entry) => (
                  <li key={entry.cardId} className="flex items-center justify-between py-1.5 gap-2">
                    <span className="text-xs text-white truncate flex-1">{entry.card.name}</span>
                    <span className="text-xs text-zinc-500 flex-shrink-0">x{entry.quantity}</span>
                    <button
                      onClick={() => handleSwapReplace(entry.cardId)}
                      className="text-xs px-2 py-0.5 rounded border border-amber-700/50 text-amber-300 hover:bg-amber-900/20 flex-shrink-0 transition-colors"
                    >
                      Replace
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mini analytics — only for main zone */}
          {activeZone === 'main' && zoneCounts.main > 0 && (
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
          )}
        </div>
      </div>

      {/* Auto-complete preview modal */}
      {autoCompletePreview && (
        <div className="lg-card border-rift-700/40 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">
              Fill {autoCompletePreview.cards.length} {ZONE_LABELS[autoCompletePreview.zone]} slots?
            </h3>
            <button onClick={() => setAutoCompletePreview(null)} className="text-zinc-500 hover:text-zinc-300 p-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {autoCompletePreview.cards.map((card) => {
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
            <button
              onClick={confirmAutoComplete}
              className="lg-btn-primary flex-1 py-2 text-sm"
            >
              Confirm
            </button>
            <button
              onClick={() => setAutoCompletePreview(null)}
              className="lg-btn-ghost flex-1 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          disabled={setCardsMutation.isPending}
          className="lg-btn-ghost"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={setCardsMutation.isPending}
          className="lg-btn-primary flex items-center gap-2"
        >
          {setCardsMutation.isPending && (
            <div role="status" className="lg-spinner-sm">
              <span className="sr-only">Saving</span>
            </div>
          )}
          {setCardsMutation.isPending ? 'Saving...' : 'Save Deck'}
        </button>
      </div>
    </div>
  );
}
