'use client';

import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { CARD_RARITIES } from '@la-grieta/shared';
import { useState, useEffect, useRef } from 'react';
import { CardGridSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';

const CONDITION_LABELS: Record<string, string> = {
  near_mint: 'NM', lightly_played: 'LP', moderately_played: 'MP', heavily_played: 'HP', damaged: 'DMG',
};

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal', alt_art: 'Alt Art', overnumbered: 'OVN', signature: 'SIG',
};

export function CollectionManager() {
  const { user } = useAuth();
  const [setSlug, setSetSlug] = useState('');
  const [rarity, setRarity] = useState('');
  const [search, setSearch] = useState('');

  const { data: setsData } = trpc.card.sets.useQuery(undefined, { staleTime: Infinity });
  const { data: stats } = trpc.collection.stats.useQuery(undefined, { enabled: !!user, staleTime: 60_000 });

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch,
  } = trpc.collection.list.useInfiniteQuery(
    { setSlug: setSlug || undefined, rarity: (rarity as typeof CARD_RARITIES[number]) || undefined, limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor, initialCursor: undefined, enabled: !!user },
  );

  const entries = data?.pages.flatMap((page) => page.items) ?? [];
  const filteredEntries = entries.filter(
    (entry) => !search || entry.card.name.toLowerCase().includes(search.toLowerCase()),
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (observerEntries) => { if (observerEntries[0]?.isIntersecting) void fetchNextPage(); },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="lg-page-title">My Collection</h1>
        <Link href="/cards" className="lg-btn-link">+ Add cards</Link>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="lg-stat-box">
            <p className="lg-stat-label">Total Cards</p>
            <p className="lg-stat-value">{stats.totalCards}</p>
          </div>
          <div className="lg-stat-box">
            <p className="lg-stat-label">Unique Cards</p>
            <p className="lg-stat-value">{stats.uniqueCards}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input type="text" placeholder="Search your collection..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg-input w-full sm:w-auto sm:flex-1" />
        <select value={setSlug} onChange={(e) => setSetSlug(e.target.value)} className="lg-select flex-1" aria-label="Filter by set">
          <option value="">All Sets</option>
          {setsData?.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="lg-select flex-1" aria-label="Filter by rarity">
          <option value="">All Rarities</option>
          {CARD_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {isLoading && (
        <div role="status"><span className="sr-only">Loading collection</span><CardGridSkeleton count={6} /></div>
      )}

      {isError && (
        <div role="alert" className="lg-alert-error">
          Failed to load collection.
          <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">Try again</button>
        </div>
      )}

      {!isLoading && filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <p className="lg-text-secondary mb-3">
            {search ? 'No cards match your search.' : 'Your collection is empty.'}
          </p>
          {!search && <Link href="/cards" className="lg-btn-link">Browse cards to add them</Link>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredEntries.map((entry) => <CollectionEntry key={entry.id} entry={entry} />)}
      </div>

      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          {isFetchingNextPage ? (
            <div role="status" className="lg-spinner-sm"><span className="sr-only">Loading more</span></div>
          ) : (
            <button onClick={() => void fetchNextPage()} className="lg-btn-ghost">Load more</button>
          )}
        </div>
      )}
    </div>
  );
}

interface CollectionEntryProps {
  entry: {
    id: string;
    variant: string;
    condition: string;
    card: { id: string; name: string; rarity: string; cardType: string; imageSmall: string | null };
  };
}

function CollectionEntry({ entry }: CollectionEntryProps) {
  const utils = trpc.useUtils();

  const remove = trpc.collection.remove.useMutation({
    onSuccess() {
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
      toast.success('Copy removed from collection');
    },
  });

  return (
    <div className="flex items-center gap-3 lg-card px-3 py-2">
      <Link href={`/cards/${entry.card.id}`} className="flex-shrink-0">
        {entry.card.imageSmall ? (
          <div className="relative w-10 h-14 rounded overflow-hidden">
            <Image src={entry.card.imageSmall} alt={entry.card.name} fill sizes="40px" className="object-cover" />
          </div>
        ) : (
          <div className="w-10 h-14 rounded bg-surface-elevated flex items-center justify-center">
            <span className="text-xs text-zinc-600">?</span>
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/cards/${entry.card.id}`} className="hover:text-rift-400 transition-colors">
          <p className="text-sm font-medium text-white truncate">{entry.card.name}</p>
        </Link>
        <p className="lg-text-muted">{entry.card.cardType}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {entry.variant !== 'normal' && (
          <span className="lg-badge text-purple-400 bg-purple-900/20">
            {VARIANT_LABELS[entry.variant] ?? entry.variant}
          </span>
        )}
        <span className="lg-badge text-zinc-400 bg-surface-elevated">
          {CONDITION_LABELS[entry.condition] ?? entry.condition}
        </span>
        <button
          onClick={() => {
            if (confirm('Remove this copy from your collection?')) {
              remove.mutate({ id: entry.id });
            }
          }}
          disabled={remove.isPending}
          className="lg-qty-btn !border-red-800/50 !text-red-400 hover:!bg-red-900/20"
          title="Remove copy" aria-label="Remove copy"
        >&times;</button>
      </div>
    </div>
  );
}
