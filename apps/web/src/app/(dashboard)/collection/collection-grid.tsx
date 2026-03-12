'use client';

// Collection grid — shows all user copies grouped by card, with copy count badges,
// filters (set/rarity/variant/condition/domain), sort controls, and infinite scroll.
// Floating + button opens the AddCardsModal.

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { CARD_RARITIES, CARD_VARIANTS, CARD_CONDITIONS, CARD_DOMAINS } from '@la-grieta/shared';
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

export function CollectionGrid() {
  const { user } = useAuth();
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');

  const [setSlug, setSetSlug] = useState('');
  const [rarity, setRarity] = useState('');
  const [variant, setVariant] = useState('');
  const [condition, setCondition] = useState('');
  const [domain, setDomain] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date_added');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);

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

  const entries = data?.pages.flatMap((page) => page.items) ?? [];

  // Group entries by cardId and build map of cardId -> {card, copies[]}
  const cardMap = new Map<string, {
    card: { id: string; name: string; rarity: string; cardType: string | null; imageSmall: string | null };
    copies: typeof entries;
  }>();
  for (const entry of entries) {
    const existing = cardMap.get(entry.card.id);
    if (existing) {
      existing.copies.push(entry);
    } else {
      cardMap.set(entry.card.id, { card: entry.card, copies: [entry] });
    }
  }
  const cardGroups = Array.from(cardMap.values());

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

  const addMutation = trpc.collection.add.useMutation({
    onSuccess: () => {
      toast.success('Copy added');
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
    },
    onError: () => toast.error('Failed to add copy'),
    onSettled: () => setBusyCardId(null),
  });

  const removeMutation = trpc.collection.remove.useMutation({
    onSuccess: () => {
      toast.success('Copy removed');
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
    },
    onError: () => toast.error('Failed to remove copy'),
    onSettled: () => setBusyCardId(null),
  });

  const handleAdd = useCallback((cardId: string) => {
    setBusyCardId(cardId);
    addMutation.mutate({ cardId, variant: 'normal', condition: 'near_mint' });
  }, [addMutation]);

  const handleRemove = useCallback((copyId: string, cardId: string) => {
    setBusyCardId(cardId);
    removeMutation.mutate({ id: copyId });
  }, [removeMutation]);

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

      {/* Sort bar + Add Cards button */}
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

      {/* Card grid — 2 cols on mobile, 3 on lg */}
      {cardGroups.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cardGroups.map(({ card, copies }) => {
            const isBusy = busyCardId === card.id;
            const latestCopy = copies[0];

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
                {/* +/- stepper overlay */}
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1.5 py-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => latestCopy && handleRemove(latestCopy.id, card.id)}
                    disabled={isBusy}
                    className="w-8 h-8 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-500 active:scale-90 transition-all disabled:opacity-50"
                    aria-label={`Remove copy of ${card.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-white font-bold text-sm min-w-[2ch] text-center tabular-nums">
                    {isBusy ? (
                      <div className="w-4 h-4 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      copies.length
                    )}
                  </span>
                  <button
                    onClick={() => handleAdd(card.id)}
                    disabled={isBusy}
                    className="w-8 h-8 rounded-full bg-rift-600/90 text-white flex items-center justify-center hover:bg-rift-500 active:scale-90 transition-all disabled:opacity-50"
                    aria-label={`Add copy of ${card.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
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
