'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { ListSkeleton } from '@/components/skeletons';
import { CARD_DOMAINS } from '@la-grieta/shared';

const DOMAIN_COLORS: Record<string, string> = {
  Fury: 'text-red-400 bg-red-400/10 border-red-400/30',
  Calm: 'text-green-400 bg-green-400/10 border-green-400/30',
  Mind: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  Body: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  Chaos: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  Order: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
};
const FALLBACK_DOMAIN_CLS = 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';

const TIER_COLORS: Record<string, string> = {
  S: 'text-amber-300 bg-amber-400/10 border-amber-400/30',
  A: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  B: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  C: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30',
};

function DomainBadge({ domain }: { domain: string | null }) {
  if (!domain) return null;
  const cls = DOMAIN_COLORS[domain] ?? FALLBACK_DOMAIN_CLS;
  return (
    <span className={`lg-badge border text-[10px] font-semibold flex-shrink-0 ${cls}`}>
      {domain}
    </span>
  );
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const cls = TIER_COLORS[tier] ?? FALLBACK_DOMAIN_CLS;
  return (
    <span className={`lg-badge border text-[10px] font-semibold flex-shrink-0 ${cls}`}>
      {tier}-Tier
    </span>
  );
}

function DeckStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex-shrink-0">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 6l3 3 5-5" />
        </svg>
        Complete
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 10V8l6-6 2 2-6 6H2z" />
      </svg>
      Draft
    </span>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function CommunityDecks() {
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>(undefined);
  const [championSearch, setChampionSearch] = useState('');
  const debouncedChampion = useDebounce(championSearch, 300);

  const hasFilters = !!selectedDomain || !!debouncedChampion;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = trpc.deck.browse.useInfiniteQuery(
    {
      limit: 12,
      domain: selectedDomain,
      championName: debouncedChampion || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const decks = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-label="Community decks" className="space-y-4">
      <h2 className="lg-section-title uppercase tracking-wide">Community Decks</h2>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={selectedDomain ?? ''}
          onChange={(e) => setSelectedDomain(e.target.value || undefined)}
          className="lg-input sm:w-40"
          aria-label="Filter by domain"
        >
          <option value="">All Domains</option>
          {CARD_DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={championSearch}
          onChange={(e) => setChampionSearch(e.target.value)}
          placeholder="Filter by champion..."
          className="lg-input flex-1"
          aria-label="Filter by champion name"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div role="status">
          <span className="sr-only">Loading community decks</span>
          <ListSkeleton count={6} />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div role="alert" className="lg-alert-error">
          Failed to load community decks.
          <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && decks.length === 0 && (
        <div className="text-center py-12">
          <p className="lg-text-secondary mb-2">
            {hasFilters ? 'No decks match your filters.' : 'No community decks found.'}
          </p>
          {hasFilters && (
            <button
              onClick={() => {
                setSelectedDomain(undefined);
                setChampionSearch('');
              }}
              className="lg-btn-link"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Deck grid */}
      {decks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const creatorLabel = deck.user.displayName ?? deck.user.username;
            return (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="lg-card overflow-hidden flex hover:border-rift-600/50 transition-colors"
              >
                <div className="w-16 flex-shrink-0 bg-surface-elevated flex items-center justify-center relative overflow-hidden">
                  {deck.coverCard?.imageSmall ? (
                    <Image
                      src={deck.coverCard.imageSmall}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <IconDecks className="w-6 h-6 text-zinc-700" />
                  )}
                </div>
                <div className="flex-1 px-3 py-2 min-w-0">
                  <div className="flex items-start gap-2 justify-between mb-0.5">
                    <p className="text-sm font-medium text-white truncate">{deck.name}</p>
                    <DeckStatusBadge status={deck.status} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <DomainBadge domain={deck.domain} />
                    <TierBadge tier={deck.tier} />
                  </div>
                  <p className="lg-text-muted text-xs truncate">by {creatorLabel}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel / load more */}
      {hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          {isFetchingNextPage ? (
            <div role="status" className="lg-spinner-sm">
              <span className="sr-only">Loading more</span>
            </div>
          ) : (
            <button onClick={() => void fetchNextPage()} className="lg-btn-ghost">
              Load more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function IconDecks({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="1" width="10" height="14" rx="1.5" />
      <rect x="3" y="3" width="10" height="14" rx="1.5" />
      <rect x="7" y="5" width="10" height="14" rx="1.5" />
    </svg>
  );
}
