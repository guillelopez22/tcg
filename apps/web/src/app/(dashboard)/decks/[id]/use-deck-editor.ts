'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  CARD_RARITIES,
  type DeckZone,
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  LEGEND_COUNT,
  CHAMPION_COUNT,
  BATTLEFIELD_COUNT,
  SIDEBOARD_SIZE,
  SIGNATURE_TYPES,
  getZoneForCardType,
  validateDeckFormat,
  computeAnalytics,
} from '@la-grieta/shared';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardItem = inferRouterOutputs<AppRouter>['card']['list']['items'][number];
type DeckCard = inferRouterOutputs<AppRouter>['deck']['getById']['cards'][number];

export interface DeckEntry {
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

export interface SwapPrompt {
  zone: DeckZone;
  incomingCard: CardItem;
}

export interface AutoCompletePreview {
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

export const ZONE_LABELS: Record<DeckZone, string> = {
  main: 'Main',
  rune: 'Runes',
  legend: 'Legend',
  champion: 'Champion',
  battlefield: 'Battlefield',
  sideboard: 'Sideboard',
};

export const ZONE_LIMITS: Record<DeckZone, number> = {
  main: MAIN_DECK_SIZE,
  rune: RUNE_DECK_SIZE,
  legend: LEGEND_COUNT,
  champion: CHAMPION_COUNT,
  battlefield: BATTLEFIELD_COUNT,
  sideboard: SIDEBOARD_SIZE,
};

// ---------------------------------------------------------------------------
// Pure helpers (exported for sub-components)
// ---------------------------------------------------------------------------

export function isSignatureCard(cardType: string | null): boolean {
  return cardType !== null && (SIGNATURE_TYPES as readonly string[]).includes(cardType);
}

export function getCopyLimit(cardType: string | null): number {
  return isSignatureCard(cardType) ? MAX_SIGNATURE_COPIES : MAX_COPIES_PER_CARD;
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
// useDeckEditor
// ---------------------------------------------------------------------------

interface UseDeckEditorOptions {
  deckId: string;
  initialCards: DeckCard[];
  isPublic?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function useDeckEditor({ deckId, initialCards, isPublic, onClose, onSaved }: UseDeckEditorOptions) {
  // — UI state —
  const [activeZone, setActiveZone] = useState<DeckZone>('main');
  const [searchPanel, setSearchPanel] = useState<'search' | 'suggested'>('search');
  const [suggestMode, setSuggestMode] = useState<'owned_first' | 'best_fit'>('owned_first');
  const [expandedReason, setExpandedReason] = useState<string | null>(null);
  const [swapPrompt, setSwapPrompt] = useState<SwapPrompt | null>(null);
  const [autoCompletePreview, setAutoCompletePreview] = useState<AutoCompletePreview | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addedCardId, setAddedCardId] = useState<string | null>(null);

  // — Entries —
  const [entries, setEntries] = useState<DeckEntry[]>(() =>
    initialCards.map((dc): DeckEntry => {
      const derivedZone = getZoneForCardType(dc.card.cardType);
      const storedZone = (dc as DeckCard & { zone?: string }).zone as DeckZone | undefined;
      const zone = derivedZone !== 'main' ? derivedZone : (storedZone ?? 'main');
      return {
        cardId: dc.cardId,
        quantity: dc.quantity,
        zone,
        card: {
          id: dc.card.id,
          name: dc.card.name,
          rarity: dc.card.rarity,
          cardType: dc.card.cardType,
          domain: dc.card.domain,
          imageSmall: dc.card.imageSmall,
        },
      };
    })
  );

  // — Search filters —
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [setSlug, setSetSlug] = useState('');
  const [rarity, setRarity] = useState('');
  const [domain, setDomain] = useState('');

  // — Zone-aware card type filtering —
  const zoneCardTypeFilter = useMemo((): string | undefined => {
    if (activeZone === 'rune') return 'Rune';
    if (activeZone === 'legend') return 'Legend';
    if (activeZone === 'champion') return 'Champion Unit';
    if (activeZone === 'battlefield') return 'Battlefield';
    return undefined;
  }, [activeZone]);

  // — Queries —
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

  const legendDomain = useMemo(() => {
    const legendEntry = entries.find((e) => e.zone === 'legend');
    return legendEntry?.card.domain ?? null;
  }, [entries]);

  const searchCards = useMemo(() => {
    const all = searchData?.pages.flatMap((page) => page.items) ?? [];
    const noTokens = all.filter((c) => c.cardType && !c.cardType.includes('Token'));
    const domainFiltered = noTokens.filter((c) => {
      if (!c.cardType || !(SIGNATURE_TYPES as readonly string[]).includes(c.cardType)) return true;
      if (!legendDomain) return false;
      return c.domain === legendDomain;
    });
    if (activeZone === 'main' || activeZone === 'sideboard') {
      return domainFiltered.filter((c) => c.cardType !== 'Legend' && c.cardType !== 'Champion Unit' && c.cardType !== 'Rune' && c.cardType !== 'Battlefield');
    }
    return domainFiltered;
  }, [searchData, activeZone, legendDomain]);

  const { data: collectionData } = trpc.collection.list.useQuery(
    { limit: 200 },
    { staleTime: 5 * 60 * 1000 },
  );

  const ownershipMap = useMemo((): Map<string, number> => {
    const map = new Map<string, number>();
    if (!collectionData?.items) return map;
    for (const entry of collectionData.items) {
      const cardId = entry.card.id;
      map.set(cardId, (map.get(cardId) ?? 0) + 1);
    }
    return map;
  }, [collectionData]);

  const { data: suggestionsData, isLoading: isSuggestLoading, refetch: refetchSuggestions } = trpc.deck.suggest.useQuery(
    { deckId, mode: suggestMode, zone: activeZone },
    { enabled: searchPanel === 'suggested', staleTime: 0 },
  );
  const suggestions = suggestionsData ?? [];

  // — Infinite scroll —
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

  // — Mutations —
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

  const generateShareCode = trpc.deck.generateShareCode.useMutation({
    onSuccess(code) {
      void navigator.clipboard.writeText(code);
      toast.success(`Share code copied: ${code}`);
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  // — Derived state —
  const zoneCounts = useMemo((): Record<DeckZone, number> => {
    const counts: Record<DeckZone, number> = { main: 0, rune: 0, legend: 0, champion: 0, battlefield: 0, sideboard: 0 };
    for (const entry of entries) {
      counts[entry.zone] = (counts[entry.zone] ?? 0) + entry.quantity;
    }
    return counts;
  }, [entries]);

  const zoneEntries = useMemo(
    () => entries.filter((e) => e.zone === activeZone),
    [entries, activeZone]
  );

  const validationErrors = useMemo(() => {
    const flatEntries = entries.map((e) => ({
      cardId: e.cardId,
      quantity: e.quantity,
      zone: e.zone,
    }));
    const cardTypeMap = new Map<string, string | null>(
      entries.map((e) => [e.cardId, e.card.cardType])
    );
    const domainMap = new Map<string, string | null>(
      entries.map((e) => [e.cardId, e.card.domain])
    );
    return validateDeckFormat(flatEntries, cardTypeMap, domainMap);
  }, [entries]);

  const isValid = validationErrors.length === 0;

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

  // — Copy limit helpers —
  const getTotalCopies = useCallback((cardId: string): number => {
    return entries
      .filter((e) => e.cardId === cardId && (e.zone === 'main' || e.zone === 'sideboard'))
      .reduce((sum, e) => sum + e.quantity, 0);
  }, [entries]);

  const getQuantityInZone = useCallback((cardId: string, zone: DeckZone): number => {
    return entries.find((e) => e.cardId === cardId && e.zone === zone)?.quantity ?? 0;
  }, [entries]);

  // — Add card logic —
  const addCardToZone = useCallback((card: { id: string; name: string; rarity: string; cardType: string | null; domain: string | null; imageSmall: string | null }, zone: DeckZone) => {
    if (isSignatureCard(card.cardType)) {
      if (!legendDomain) {
        toast.error('Select a Legend first before adding signature cards');
        return;
      }
      if (card.domain !== legendDomain) {
        toast.error(`${card.name} doesn't match your Legend's domain`);
        return;
      }
    }

    const limit = getCopyLimit(card.cardType);
    const copies = getTotalCopies(card.id);
    const zoneCount = zoneCounts[zone];
    const zoneLimit = ZONE_LIMITS[zone];

    if ((zone === 'main' || zone === 'sideboard') && copies >= limit) {
      toast.error(`Max ${limit} ${isSignatureCard(card.cardType) ? 'copy' : 'copies'} of ${card.name}`);
      return;
    }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legendDomain, getTotalCopies, zoneCounts, ownershipMap]);

  const addCard = useCallback((card: CardItem) => {
    if (activeZone === 'champion' && card.cardType === 'Champion Unit') {
      addCardToZone(card, 'champion');
    } else {
      const targetZone = getZoneForCardType(card.cardType);
      addCardToZone(card, targetZone);
    }
  }, [activeZone, addCardToZone]);

  const addSuggestion = useCallback((suggested: { cardId: string; card: { id: string; name: string; rarity: string; cardType: string | null; domain: string | null; imageSmall: string | null } }) => {
    const targetZone = getZoneForCardType(suggested.card.cardType);
    addCardToZone(suggested.card, targetZone);
  }, [addCardToZone]);

  const increment = useCallback((cardId: string, zone: DeckZone) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, getTotalCopies, zoneCounts]);

  const decrement = useCallback((cardId: string, zone: DeckZone) => {
    setEntries((prev) => {
      const entry = prev.find((e) => e.cardId === cardId && e.zone === zone);
      if (!entry) return prev;
      if (entry.quantity <= 1) return prev.filter((e) => !(e.cardId === cardId && e.zone === zone));
      return prev.map((e) => e.cardId === cardId && e.zone === zone ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }, []);

  const remove = useCallback((cardId: string, zone: DeckZone) => {
    setEntries((prev) => prev.filter((e) => !(e.cardId === cardId && e.zone === zone)));
  }, []);

  // — Swap —
  const handleSwapReplace = useCallback((existingCardId: string) => {
    if (!swapPrompt) return;
    const { zone, incomingCard } = swapPrompt;
    setEntries((prev) => {
      const without = prev.filter((e) => !(e.cardId === existingCardId && e.zone === zone));
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
  }, [swapPrompt, ownershipMap, wishlistMutation]);

  // — Auto-complete —
  const handleAutoComplete = useCallback(() => {
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
  }, [suggestions, activeZone, zoneCounts]);

  const confirmAutoComplete = useCallback(() => {
    if (!autoCompletePreview) return;
    for (const card of autoCompletePreview.cards) {
      const suggestion = suggestions.find((s) => s.cardId === card.cardId);
      if (suggestion) {
        addCardToZone(suggestion.card, autoCompletePreview.zone);
      }
    }
    toast.success(`Added ${autoCompletePreview.cards.length} cards`);
    setAutoCompletePreview(null);
  }, [autoCompletePreview, suggestions, addCardToZone]);

  // — Save —
  const handleSave = useCallback(() => {
    setSaveError(null);
    setCardsMutation.mutate({
      deckId,
      cards: entries.map((e) => ({
        cardId: e.cardId,
        quantity: e.quantity,
        zone: e.zone,
      })),
    });
  }, [deckId, entries, setCardsMutation]);

  const zoneTabsHasSlots = ZONE_LIMITS[activeZone] - zoneCounts[activeZone] > 0;

  return {
    // ui state
    activeZone,
    setActiveZone,
    searchPanel,
    setSearchPanel,
    suggestMode,
    setSuggestMode,
    expandedReason,
    setExpandedReason,
    swapPrompt,
    setSwapPrompt,
    autoCompletePreview,
    setAutoCompletePreview,
    saveError,
    addedCardId,
    // entries
    entries,
    zoneEntries,
    zoneCounts,
    // search
    search,
    setSearch,
    setSlug,
    setSetSlug,
    rarity,
    setRarity,
    domain,
    setDomain,
    setsData,
    searchCards,
    isSearchLoading,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
    // suggestions
    suggestions,
    isSuggestLoading,
    refetchSuggestions,
    // ownership
    ownershipMap,
    // validation
    validationErrors,
    isValid,
    // analytics
    energyCurveData,
    domainPieData,
    // helpers
    getTotalCopies,
    getQuantityInZone,
    zoneTabsHasSlots,
    // card operations
    addCard,
    addSuggestion,
    increment,
    decrement,
    remove,
    handleSwapReplace,
    handleAutoComplete,
    confirmAutoComplete,
    handleSave,
    // mutations
    setCardsMutation,
    generateShareCode,
    isPublic,
    onClose,
  };
}
