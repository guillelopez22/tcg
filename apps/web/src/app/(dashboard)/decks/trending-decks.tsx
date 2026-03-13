'use client';

// TrendingDecks — shows public decks with the [RD] prefix (scraped from riftdecks.com).
// Rendering: fully client-side — data is user-context-aware (import, wishlist actions).

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import type { DeckZone } from '@la-grieta/shared';

const DOMAIN_COLORS: Record<string, string> = {
  Fury: 'text-red-400 bg-red-400/10 border-red-400/30',
  Calm: 'text-green-400 bg-green-400/10 border-green-400/30',
  Mind: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  Body: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
  Chaos: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  Order: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
};
const FALLBACK_DOMAIN = 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';

function DomainBadge({ domain }: { domain: string | null }) {
  if (!domain) return null;
  const cls = DOMAIN_COLORS[domain] ?? FALLBACK_DOMAIN;
  return (
    <span className={`lg-badge border text-[10px] font-semibold flex-shrink-0 ${cls}`}>
      {domain}
    </span>
  );
}

function DeckPlaceholder({ domain }: { domain: string | null }) {
  return (
    <div className="w-12 h-16 rounded-lg bg-surface-elevated flex-shrink-0 flex items-center justify-center border border-surface-border">
      <IconDecks className="w-5 h-5 text-zinc-600" />
    </div>
  );
}

function TrendingDeckSkeleton() {
  return (
    <div className="lg-card p-3 animate-pulse flex gap-3">
      <div className="w-12 h-16 rounded-lg bg-surface-elevated flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2 pt-1">
        <div className="h-3.5 bg-surface-elevated rounded w-2/3" />
        <div className="h-2.5 bg-surface-elevated rounded w-1/3" />
        <div className="h-2 bg-surface-elevated rounded w-1/2" />
      </div>
    </div>
  );
}

function isNonLatinScript(text: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(text);
}

interface TrendingDeckCardProps {
  deck: {
    id: string;
    name: string;
    domain: string | null;
    description: string | null;
    coverCardId: string | null;
    coverCard?: { id: string; name: string | null; cleanName: string | null; imageSmall: string | null } | null;
    user: { username: string; displayName: string | null };
  };
  displayName: string;
}

function TrendingDeckCard({ deck, displayName }: TrendingDeckCardProps) {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [importState, setImportState] = useState<'idle' | 'fetching' | 'creating'>('idle');
  const [wishlistState, setWishlistState] = useState<'idle' | 'fetching' | 'toggling' | 'done'>('idle');

  const createDeck = trpc.deck.create.useMutation({
    onSuccess() {
      void utils.deck.list.invalidate();
      setImportState('idle');
      toast.success(`Imported "${displayName}" to your decks`);
    },
    onError(err) {
      setImportState('idle');
      toast.error(`Import failed: ${err.message}`);
    },
  });

  const addIfMissing = trpc.wishlist.addIfMissing.useMutation();

  async function handleImport() {
    if (!user) { toast.error('Sign in to import decks'); return; }
    if (importState !== 'idle') return;

    setImportState('fetching');
    let deckDetail: Awaited<ReturnType<typeof utils.deck.getById.fetch>>;
    try {
      deckDetail = await utils.deck.getById.fetch({ id: deck.id });
    } catch (err) {
      setImportState('idle');
      toast.error('Could not load deck details');
      return;
    }

    setImportState('creating');
    createDeck.mutate({
      name: displayName,
      description: deck.description ?? undefined,
      coverCardId: deck.coverCardId ?? undefined,
      isPublic: false,
      cards: deckDetail.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity, zone: c.zone as DeckZone })),
    });
  }

  async function handleWishlistMissing() {
    if (!user) { toast.error('Sign in to use the wantlist'); return; }
    if (wishlistState !== 'idle') return;

    setWishlistState('fetching');
    let deckDetail: Awaited<ReturnType<typeof utils.deck.getById.fetch>>;
    try {
      deckDetail = await utils.deck.getById.fetch({ id: deck.id });
    } catch (err) {
      setWishlistState('idle');
      toast.error('Could not load deck details');
      return;
    }

    if (deckDetail.cards.length === 0) {
      setWishlistState('idle');
      toast.info('This deck has no cards yet');
      return;
    }

    setWishlistState('toggling');
    let addedCount = 0;
    for (const card of deckDetail.cards) {
      try {
        await addIfMissing.mutateAsync({ cardId: card.cardId, type: 'want' });
        addedCount++;
      } catch {
        // Continue for remaining cards even if one fails
      }
    }

    setWishlistState('done');
    toast.success(
      addedCount === deckDetail.cards.length
        ? `Added ${addedCount} cards to your wantlist`
        : `Added ${addedCount} of ${deckDetail.cards.length} cards to your wantlist`,
    );
  }

  const importBusy = importState !== 'idle';
  const wishlistBusy = wishlistState === 'fetching' || wishlistState === 'toggling';
  const wishlistDone = wishlistState === 'done';

  const creatorLabel = deck.user.displayName ?? deck.user.username;

  // Use legend name for non-Latin deck names
  const cleanedName = deck.name.replace(/^\[RD\]\s*/, '');
  const isNonLatin = isNonLatinScript(cleanedName);
  const legendLabel = deck.coverCard?.name?.split(' - ')[0] ?? null;
  const finalDisplayName = isNonLatin && legendLabel ? legendLabel : displayName;
  const subtitle = isNonLatin ? cleanedName : null;

  return (
    <div className="lg-card overflow-hidden flex flex-col">
      <div className="p-3 flex gap-3">
        {deck.coverCard?.imageSmall ? (
          <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 relative bg-surface-elevated">
            <Image src={deck.coverCard.imageSmall} alt="" fill sizes="48px" className="object-cover" />
          </div>
        ) : (
          <DeckPlaceholder domain={deck.domain} />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5 mb-0.5">
            <p className="text-sm font-semibold text-white leading-snug truncate">{finalDisplayName}</p>
            <DomainBadge domain={deck.domain} />
          </div>
          {subtitle && <p className="text-[10px] text-zinc-500 truncate">{subtitle}</p>}
          <p className="lg-text-muted truncate">by {creatorLabel}</p>
        </div>
      </div>

      <div className="px-3 pb-3 flex gap-2">
        <button
          onClick={() => void handleImport()}
          disabled={importBusy}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-rift-700/60 text-rift-300 hover:bg-rift-900/30 transition-colors disabled:opacity-50"
        >
          {importState === 'fetching' ? 'Loading...' : importState === 'creating' ? 'Importing...' : 'Import'}
        </button>

        <button
          onClick={() => void handleWishlistMissing()}
          disabled={wishlistBusy || wishlistDone}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
            wishlistDone
              ? 'border-green-700/50 text-green-400'
              : 'border-surface-border text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
          }`}
        >
          {wishlistState === 'fetching' ? 'Loading...'
            : wishlistState === 'toggling' ? 'Adding...'
            : wishlistDone ? 'Added to wantlist'
            : 'Wishlist missing'}
        </button>
      </div>
    </div>
  );
}

export function TrendingDecks() {
  const { data, isLoading, isError, refetch } = trpc.deck.browse.useQuery({ limit: 12 });

  const trendingDecks = (data?.items ?? []).filter((d) => d.name.startsWith('[RD]'));

  const displayName = useCallback((name: string) => name.replace(/^\[RD\]\s*/, ''), []);

  if (isLoading) {
    return (
      <section aria-label="Trending decks" className="space-y-3">
        <h2 className="lg-section-title uppercase tracking-wide">Trending Decks</h2>
        <div role="status">
          <span className="sr-only">Loading trending decks</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <TrendingDeckSkeleton key={i} />)}
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section aria-label="Trending decks" className="space-y-3">
        <h2 className="lg-section-title uppercase tracking-wide">Trending Decks</h2>
        <div role="alert" className="lg-alert-error">
          Failed to load trending decks.
          <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">Try again</button>
        </div>
      </section>
    );
  }

  if (trendingDecks.length === 0) {
    return (
      <section aria-label="Trending decks" className="space-y-3">
        <h2 className="lg-section-title uppercase tracking-wide">Trending Decks</h2>
        <p className="lg-text-muted py-4 text-center">No trending decks available yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Trending decks" className="space-y-3">
      <h2 className="lg-section-title uppercase tracking-wide">Trending Decks</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {trendingDecks.map((deck) => (
          <TrendingDeckCard
            key={deck.id}
            deck={deck}
            displayName={displayName(deck.name)}
          />
        ))}
      </div>
    </section>
  );
}

function IconDecks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="1" width="10" height="14" rx="1.5" />
      <rect x="3" y="3" width="10" height="14" rx="1.5" />
      <rect x="7" y="5" width="10" height="14" rx="1.5" />
    </svg>
  );
}
