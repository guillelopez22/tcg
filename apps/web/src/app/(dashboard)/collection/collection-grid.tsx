'use client';

// Collection grid — shows all user copies grouped by card, with copy count badges,
// filters (set/rarity/variant/condition/domain), sort controls, and infinite scroll.
// Floating + button opens the AddCardsModal.
// Features: optimistic add/remove, undo toasts, long-press variant picker,
//           copy picker on multi-remove, hover-reveal steppers, total value badge.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import {
  CARD_RARITIES,
  CARD_VARIANTS,
  CARD_CONDITIONS,
  CARD_DOMAINS,
  isFoilVariant,
} from '@la-grieta/shared';
import { CardGridSkeleton } from '@/components/skeletons';
import { AddCardsModal } from './add-cards-modal';

const CONDITION_LABELS: Record<string, string> = {
  near_mint: 'NM',
  lightly_played: 'LP',
  moderately_played: 'MP',
  heavily_played: 'HP',
  damaged: 'DMG',
};

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  alt_art: 'Alt Art',
  overnumbered: 'OVN',
  signature: 'SIG',
};

type SortBy = 'name' | 'date_added' | 'price' | 'set_number';
type SortDir = 'asc' | 'desc';

type CopyEntry = {
  id: string;
  cardId: string;
  variant: string;
  condition: string;
  card: {
    id: string;
    name: string;
    rarity: string;
    cardType: string | null;
    imageSmall: string | null;
    marketPrice?: string | null;
    foilMarketPrice?: string | null;
  };
};

export function CollectionGrid() {
  const { user } = useAuth();
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');

  // --- Filter / sort state ---
  const [setSlug, setSetSlug] = useState('');
  const [rarity, setRarity] = useState('');
  const [variant, setVariant] = useState('');
  const [condition, setCondition] = useState('');
  const [domain, setDomain] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date_added');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Optimistic delta: cardId -> count delta (+1 for add, -1 for remove) ---
  const [optimisticDeltas, setOptimisticDeltas] = useState<Map<string, number>>(new Map());

  // --- Long-press state (per card) ---
  const [variantPickerCardId, setVariantPickerCardId] = useState<string | null>(null);
  const [pickerVariant, setPickerVariant] = useState<string>('normal');
  const [pickerCondition, setPickerCondition] = useState<string>('near_mint');
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressTriggered = useRef(false);
  const longPressCardId = useRef<string | null>(null);

  // --- Copy picker for multi-remove ---
  const [copyPickerCardId, setCopyPickerCardId] = useState<string | null>(null);

  const { data: setsData } = trpc.card.sets.useQuery(undefined, { staleTime: Infinity });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = trpc.collection.list.useInfiniteQuery(
    {
      setSlug: setSlug || undefined,
      rarity: (rarity as typeof CARD_RARITIES[number]) || undefined,
      variant: (variant as typeof CARD_VARIANTS[number]) || undefined,
      condition: (condition as typeof CARD_CONDITIONS[number]) || undefined,
      domain: domain || undefined,
      sortBy,
      sortDir,
      limit: 30,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: undefined,
      enabled: !!user,
    },
  );

  const utils = trpc.useUtils();

  const entries = (data?.pages.flatMap((page) => page.items) ?? []) as CopyEntry[];

  // --- Grouped by card ---
  const cardMap = new Map<string, { card: CopyEntry['card']; copies: CopyEntry[] }>();
  for (const entry of entries) {
    const existing = cardMap.get(entry.card.id);
    if (existing) {
      existing.copies.push(entry);
    } else {
      cardMap.set(entry.card.id, { card: entry.card, copies: [entry] });
    }
  }
  const cardGroups = Array.from(cardMap.values());

  // --- Total market value (across all loaded pages) ---
  const filteredTotal = useMemo(() => {
    if (!data?.pages) return 0;
    return (data.pages.flatMap((p) => p.items) as CopyEntry[]).reduce((sum, entry) => {
      const price = isFoilVariant(entry.variant)
        ? parseFloat(entry.card.foilMarketPrice ?? '0')
        : parseFloat(entry.card.marketPrice ?? '0');
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
  }, [data?.pages]);

  // --- Infinite scroll observer ---
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (obs) => { if (obs[0]?.isIntersecting) void fetchNextPage(); },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // --- Helper to bump optimistic delta ---
  const bumpDelta = useCallback((cardId: string, delta: number) => {
    setOptimisticDeltas((prev) => {
      const next = new Map(prev);
      next.set(cardId, (next.get(cardId) ?? 0) + delta);
      return next;
    });
  }, []);

  const clearDelta = useCallback((cardId: string) => {
    setOptimisticDeltas((prev) => {
      const next = new Map(prev);
      next.delete(cardId);
      return next;
    });
  }, []);

  // --- Add mutation with optimistic update ---
  const addMutation = trpc.collection.add.useMutation({
    onMutate: ({ cardId }) => {
      bumpDelta(cardId, +1);
    },
    onSuccess: () => {
      void utils.collection.stats.invalidate();
    },
    onError: (_err, { cardId }) => {
      bumpDelta(cardId, -1);
      toast.error('Failed to add copy');
    },
    onSettled: (_data, _err, { cardId }) => {
      clearDelta(cardId);
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
    },
  });

  // --- Remove mutation with optimistic update + undo toast ---
  const removeMutation = trpc.collection.remove.useMutation({
    onMutate: ({ id: _id }) => {
      // Delta applied by the calling handler after capturing the copy
    },
    onError: (_err, _vars, ctx) => {
      // ctx carries cardId from calling handler if we set it
      toast.error('Failed to remove copy');
    },
    onSettled: () => {
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
    },
  });

  // --- handleAdd: normal tap (Normal/NM) ---
  const handleAdd = useCallback(
    (cardId: string) => {
      addMutation.mutate({ cardId, variant: 'normal', condition: 'near_mint' });
    },
    [addMutation],
  );

  // --- handleAddWithVariant: from picker ---
  const handleAddWithVariant = useCallback(
    (cardId: string, v: string, c: string) => {
      addMutation.mutate({
        cardId,
        variant: v as typeof CARD_VARIANTS[number],
        condition: c as typeof CARD_CONDITIONS[number],
      });
    },
    [addMutation],
  );

  // --- handleRemoveCopy: removes a specific copy with optimistic delta + undo toast ---
  const handleRemoveCopy = useCallback(
    (copy: CopyEntry) => {
      bumpDelta(copy.cardId, -1);
      removeMutation.mutate(
        { id: copy.id },
        {
          onSuccess: () => {
            let undoToastId: string | number;
            undoToastId = toast('Copy removed', {
              duration: 5000,
              action: {
                label: 'Undo',
                onClick: () => {
                  addMutation.mutate({
                    cardId: copy.cardId,
                    variant: copy.variant as typeof CARD_VARIANTS[number],
                    condition: copy.condition as typeof CARD_CONDITIONS[number],
                  });
                  toast.dismiss(undoToastId);
                },
              },
            });
          },
          onError: () => {
            bumpDelta(copy.cardId, +1);
            toast.error('Failed to remove copy');
          },
        },
      );
    },
    [addMutation, bumpDelta, removeMutation],
  );

  // --- handleRemove: tap - button ---
  const handleRemove = useCallback(
    (cardId: string, copies: CopyEntry[]) => {
      if (copies.length === 1 && copies[0]) {
        // Single copy: remove immediately
        handleRemoveCopy(copies[0]);
      } else if (copies.length > 1) {
        // Multi-copy: open copy picker
        setCopyPickerCardId(cardId);
      }
    },
    [handleRemoveCopy],
  );

  // --- Long-press handlers ---
  const handlePressStart = useCallback((cardId: string) => {
    longPressTriggered.current = false;
    longPressCardId.current = cardId;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setPickerVariant('normal');
      setPickerCondition('near_mint');
      setVariantPickerCardId(cardId);
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  // --- Close pickers ---
  const closeVariantPicker = useCallback(() => {
    setVariantPickerCardId(null);
    longPressTriggered.current = false;
  }, []);

  const closeCopyPicker = useCallback(() => {
    setCopyPickerCardId(null);
  }, []);

  const handleModalSuccess = () => {
    void utils.collection.list.invalidate();
    void utils.collection.stats.invalidate();
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <select
          value={setSlug}
          onChange={(e) => setSetSlug(e.target.value)}
          className="lg-select flex-1 min-w-[120px]"
          aria-label="Filter by set"
        >
          <option value="">All Sets</option>
          {setsData?.map((s) => (
            <option key={s.id} value={s.slug}>{s.name}</option>
          ))}
        </select>

        <select
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          className="lg-select flex-1 min-w-[100px]"
          aria-label="Filter by rarity"
        >
          <option value="">All Rarities</option>
          {CARD_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          className="lg-select flex-1 min-w-[100px]"
          aria-label="Filter by variant"
        >
          <option value="">All Variants</option>
          {CARD_VARIANTS.map((v) => <option key={v} value={v}>{VARIANT_LABELS[v]}</option>)}
        </select>

        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="lg-select flex-1 min-w-[100px]"
          aria-label="Filter by condition"
        >
          <option value="">All Conditions</option>
          {CARD_CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
        </select>

        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="lg-select flex-1 min-w-[100px]"
          aria-label="Filter by domain"
        >
          <option value="">All Domains</option>
          {CARD_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Sort bar + total value badge + Add Cards button */}
      <div className="flex gap-2 items-center">
        <span className="lg-text-muted flex-shrink-0">{t('sort')}:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="lg-select flex-1"
          aria-label="Sort by"
        >
          <option value="date_added">Date Added</option>
          <option value="name">Name A-Z</option>
          <option value="price">Price</option>
          <option value="set_number">Set Number</option>
        </select>
        <button
          onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
          className="lg-btn-secondary px-3 py-2 flex-shrink-0"
          aria-label={`Sort direction: ${sortDir}`}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
        {filteredTotal > 0 && (
          <span className="text-zinc-400 text-sm tabular-nums flex-shrink-0">
            ${filteredTotal.toFixed(2)}
          </span>
        )}
        <button
          onClick={() => setIsModalOpen(true)}
          className="lg-btn-primary px-4 py-2 flex-shrink-0 flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>{t('addCards')}</span>
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div role="status">
          <span className="sr-only">{tCommon('loading')}</span>
          <CardGridSkeleton count={9} />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div role="alert" className="lg-alert-error">
          {tCommon('error')}
          <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && cardGroups.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3 opacity-30">🃏</div>
          <p className="lg-text-secondary mb-4">Your collection is empty.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="lg-btn-primary px-6 py-3 inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>{t('addCards')}</span>
          </button>
        </div>
      )}

      {/* Card grid — 2 cols on mobile, 3 on sm, 4 on lg */}
      {cardGroups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cardGroups.map(({ card, copies }) => {
            const delta = optimisticDeltas.get(card.id) ?? 0;
            const displayCount = copies.length + delta;

            return (
              <div key={card.id} className="relative group rounded-xl overflow-hidden border border-surface-border bg-surface-card hover:border-rift-600/50 transition-all">
                <Link href={`/collection/${card.id}`}>
                  <div className="aspect-[2/3] relative bg-surface-elevated">
                    {card.imageSmall ? (
                      <Image
                        src={card.imageSmall}
                        alt={card.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <span className="text-xs text-zinc-600 text-center">{card.name}</span>
                      </div>
                    )}
                  </div>
                </Link>

                {/* +/- stepper overlay — always visible on mobile, hover-reveal on desktop */}
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1.5 py-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemove(card.id, copies)}
                    className="w-8 h-8 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-500 active:scale-90 transition-all"
                    aria-label={`Remove copy of ${card.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>

                  {/* Count display */}
                  <span className="text-white font-bold text-sm min-w-[2ch] text-center tabular-nums">
                    {displayCount}
                  </span>

                  {/* Add button with long-press */}
                  <button
                    onMouseDown={() => handlePressStart(card.id)}
                    onMouseUp={() => {
                      handlePressEnd();
                      if (!longPressTriggered.current) {
                        handleAdd(card.id);
                      }
                    }}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handlePressStart(card.id)}
                    onTouchEnd={() => {
                      handlePressEnd();
                      if (!longPressTriggered.current) {
                        handleAdd(card.id);
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-8 h-8 rounded-full bg-rift-600/90 text-white flex items-center justify-center hover:bg-rift-500 active:scale-90 transition-all"
                    aria-label={`Add copy of ${card.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Variant picker popover (long-press on +) */}
                {variantPickerCardId === card.id && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={closeVariantPicker}
                    />
                    {/* Popover */}
                    <div className="absolute bottom-12 inset-x-0 z-50 bg-surface-card border border-surface-border rounded-xl p-3 shadow-xl mx-1">
                      <p className="text-xs text-zinc-400 mb-2 font-medium">Variant</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {CARD_VARIANTS.map((v) => (
                          <button
                            key={v}
                            onClick={() => setPickerVariant(v)}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                              pickerVariant === v
                                ? 'bg-rift-600 border-rift-500 text-white'
                                : 'border-surface-border text-zinc-300 hover:border-rift-600/50'
                            }`}
                          >
                            {VARIANT_LABELS[v]}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-400 mb-2 font-medium">Condition</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {CARD_CONDITIONS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setPickerCondition(c)}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                              pickerCondition === c
                                ? 'bg-rift-600 border-rift-500 text-white'
                                : 'border-surface-border text-zinc-300 hover:border-rift-600/50'
                            }`}
                          >
                            {CONDITION_LABELS[c]}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          handleAddWithVariant(card.id, pickerVariant, pickerCondition);
                          closeVariantPicker();
                        }}
                        className="w-full lg-btn-primary py-1.5 text-sm"
                      >
                        Add
                      </button>
                    </div>
                  </>
                )}

                {/* Copy picker popover (- on multi-copy) */}
                {copyPickerCardId === card.id && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={closeCopyPicker}
                    />
                    {/* Popover */}
                    <div className="absolute bottom-12 inset-x-0 z-50 bg-surface-card border border-surface-border rounded-xl p-3 shadow-xl mx-1">
                      <p className="text-xs text-zinc-400 mb-2 font-medium">Which copy?</p>
                      <div className="space-y-1">
                        {copies.map((copy, idx) => (
                          <button
                            key={copy.id}
                            onClick={() => {
                              closeCopyPicker();
                              handleRemoveCopy(copy);
                            }}
                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md border border-surface-border hover:border-red-500/50 hover:bg-red-900/10 transition-colors text-left"
                          >
                            <span className="text-xs text-zinc-300">
                              Copy {idx + 1}
                            </span>
                            <span className="flex gap-1">
                              <span className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded text-zinc-400">
                                {VARIANT_LABELS[copy.variant] ?? copy.variant}
                              </span>
                              <span className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded text-zinc-400">
                                {CONDITION_LABELS[copy.condition] ?? copy.condition}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          {isFetchingNextPage ? (
            <div role="status" className="lg-spinner-sm">
              <span className="sr-only">{tCommon('loading')}</span>
            </div>
          ) : (
            <button onClick={() => void fetchNextPage()} className="lg-btn-ghost">
              Load more
            </button>
          )}
        </div>
      )}

      {/* Floating + button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="lg-fab"
        aria-label={t('addCards')}
        title={t('addCards')}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <AddCardsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
