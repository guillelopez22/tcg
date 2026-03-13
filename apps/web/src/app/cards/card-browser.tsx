'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { CARD_RARITIES, CARD_TYPES, CARD_DOMAINS } from '@la-grieta/shared';
import { RARITY_COLORS } from '@/lib/design-tokens';
import { CardGridSkeleton } from '@/components/skeletons';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

const FALLBACK_RARITY = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' };

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type CardItem = inferRouterOutputs<AppRouter>['card']['list']['items'][number];

export function CardBrowser() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [setSlug, setSetSlug] = useState('');
  const [rarity, setRarity] = useState('');
  const [cardType, setCardType] = useState('');
  const [domain, setDomain] = useState('');

  const { data: setsData } = trpc.card.sets.useQuery(undefined, { staleTime: Infinity });

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch,
  } = trpc.card.list.useInfiniteQuery(
    {
      search: debouncedSearch || undefined,
      setSlug: setSlug || undefined,
      rarity: (rarity as typeof CARD_RARITIES[number]) || undefined,
      cardType: cardType || undefined,
      domain: domain || undefined,
      limit: 24,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: undefined,
      staleTime: 5 * 60 * 1000,
    },
  );

  const cards = data?.pages.flatMap((page) => page.items) ?? [];

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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <input
          type="search"
          placeholder="Search cards..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg-input col-span-2 sm:col-span-3 lg:col-span-2"
          aria-label="Search cards by name"
          autoFocus
        />
        <select value={setSlug} onChange={(e) => setSetSlug(e.target.value)} className="lg-select" aria-label="Filter by set">
          <option value="">All Sets</option>
          {setsData?.map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}
        </select>
        <select value={rarity} onChange={(e) => setRarity(e.target.value)} className="lg-select" aria-label="Filter by rarity">
          <option value="">All Rarities</option>
          {CARD_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className="lg-select" aria-label="Filter by domain">
          <option value="">All Domains</option>
          {CARD_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={cardType} onChange={(e) => setCardType(e.target.value)} className="lg-select col-span-2 sm:col-span-1" aria-label="Filter by card type">
          <option value="">All Types</option>
          {CARD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isLoading && (
        <div role="status">
          <span className="sr-only">Loading cards</span>
          <CardGridSkeleton count={12} />
        </div>
      )}

      {isError && (
        <div role="alert" className="lg-alert-error">
          Failed to load cards.
          <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">Try again</button>
        </div>
      )}

      {!isLoading && cards.length === 0 && (
        <p className="text-center py-12 lg-text-secondary">No cards found matching your filters.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {cards.map((card, index) => (
          <CardTile key={card.id} card={card} index={index} />
        ))}
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

function CardTile({ card, index }: { card: CardItem; index: number }) {
  const rarity = RARITY_COLORS[card.rarity] ?? FALLBACK_RARITY;
  return (
    <Link
      href={`/cards/${card.id}`}
      className={`lg-card-interactive animate-card-enter ${rarity.border} ${rarity.glow}`}
      style={{ animationDelay: `${(index % 12) * 40}ms` }}
    >
      {card.imageSmall ? (
        <div className="aspect-[2/3] relative bg-surface-elevated">
          <Image src={card.imageSmall} alt={card.name} fill sizes="(max-width:640px) 50vw,(max-width:768px) 33vw,25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105" />
        </div>
      ) : (
        <div className="aspect-[2/3] bg-surface-elevated flex items-center justify-center">
          <span className="text-xs text-zinc-600 text-center px-2">{card.name}</span>
        </div>
      )}
      <div className="p-2.5">
        <p className="text-xs font-medium text-white truncate">{card.name}</p>
        <div className="flex items-center justify-between">
          <p className={`text-xs ${rarity.text}`}>{card.rarity}</p>
          {(() => {
            const displayPrice = card.price?.marketPrice ?? card.price?.foilMarketPrice;
            if (!displayPrice) return null;
            return (
              <p className="text-xs font-medium text-emerald-400">
                ${parseFloat(displayPrice).toFixed(2)}
              </p>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}
