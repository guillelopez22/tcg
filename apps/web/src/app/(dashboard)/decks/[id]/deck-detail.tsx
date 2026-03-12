'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { RARITY_COLORS, DOMAIN_COLORS } from '@/lib/design-tokens';
import { DetailSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';
import { DeckCardEditor } from './deck-card-editor';
import { DeckAnalytics } from './deck-analytics';
import { HandSimulator } from './hand-simulator';

const FALLBACK_RARITY = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' };

type DetailTab = 'cards' | 'analytics';

interface DeckDetailProps {
  id: string;
}

// Draft/Complete badge (same pattern as deck-list)
function DeckStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;

  if (status === 'complete') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 6l3 3 5-5" />
        </svg>
        Complete
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 10V8l6-6 2 2-6 6H2z" />
      </svg>
      Draft
    </span>
  );
}

// Buildability section — only rendered when user is the owner
function BuildabilitySection({ deckId }: { deckId: string }) {
  const { data, isLoading } = trpc.deck.buildability.useQuery({ deckId });

  const addMissing = trpc.wishlist.addIfMissing.useMutation();

  async function handleAddMissing() {
    if (!data || data.missingCardIds.length === 0) return;
    let added = 0;
    for (const cardId of data.missingCardIds) {
      try {
        await addMissing.mutateAsync({ cardId, type: 'want' });
        added++;
      } catch {
        // Skip cards that fail individually
      }
    }
    toast.success(`Added ${added} card${added !== 1 ? 's' : ''} to wantlist`);
  }

  if (isLoading) {
    return (
      <div className="lg-card px-5 py-4">
        <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const { owned, total, pct, missingCardIds } = data;
  const colorClass =
    pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const textColorClass =
    pct >= 80 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="lg-card px-5 py-4 space-y-3">
      <h2 className="lg-section-title">Collection Readiness</h2>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-300">
          You own{' '}
          <span className="font-semibold text-white">{owned}/{total}</span> cards{' '}
          <span className={`font-medium ${textColorClass}`}>({pct}%)</span>
        </p>
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Add missing button */}
      {missingCardIds.length > 0 && (
        <button
          onClick={() => void handleAddMissing()}
          disabled={addMissing.isPending}
          className="lg-btn-secondary w-full disabled:opacity-50"
        >
          {addMissing.isPending
            ? 'Adding...'
            : `Add ${missingCardIds.length} missing card${missingCardIds.length !== 1 ? 's' : ''} to wantlist`}
        </button>
      )}
      {missingCardIds.length === 0 && pct === 100 && (
        <p className="text-xs text-emerald-400">You own all cards in this deck.</p>
      )}
    </div>
  );
}

export function DeckDetail({ id }: DeckDetailProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('cards');
  const { data: deck, isLoading, isError } = trpc.deck.getById.useQuery({ id });

  if (isLoading) {
    return <div role="status"><span className="sr-only">Loading deck</span><DetailSkeleton /></div>;
  }

  if (isError || !deck) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="lg-text-secondary mb-4">Deck not found.</p>
        <Link href="/decks" className="lg-btn-link">Back to decks</Link>
      </div>
    );
  }

  const totalCards = deck.cards.reduce((sum, entry) => sum + entry.quantity, 0);
  const isOwner = user?.id === deck.userId;
  const deckWithStatus = deck as typeof deck & { status?: string | null };

  const detailTabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'cards', label: 'Cards' },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="space-y-6">
      <Link href="/decks" className="inline-flex items-center gap-1 lg-text-secondary hover:text-white transition-colors">
        <span aria-hidden>&larr;</span> Back to decks
      </Link>

      {/* Deck header */}
      <div className="lg-card px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="lg-page-title">{deck.name}</h1>
            <DeckStatusBadge status={deckWithStatus.status} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {deck.isPublic ? (
              <span className="lg-badge text-rift-300 bg-rift-950">Public</span>
            ) : (
              <span className="lg-badge text-zinc-400 bg-zinc-800">Private</span>
            )}
            {deck.domain && <span className="lg-badge text-amber-300 bg-amber-900/30">{deck.domain}</span>}
          </div>
        </div>
        {deck.description && <p className="lg-text-secondary leading-relaxed">{deck.description}</p>}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="lg-text-muted">{totalCards} {totalCards === 1 ? 'card' : 'cards'} total</p>
          {isOwner && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="lg-btn-secondary">
              Edit Cards
            </button>
          )}
        </div>
      </div>

      {/* Buildability section — owner only */}
      {isOwner && !isEditing && <BuildabilitySection deckId={id} />}

      {/* Inline card editor */}
      {isEditing && (
        <div className="lg-card px-5 py-4">
          <DeckCardEditor
            deckId={id}
            initialCards={deck.cards}
            onClose={() => setIsEditing(false)}
            onSaved={() => setIsEditing(false)}
          />
        </div>
      )}

      {/* Read-only card list + analytics (hidden while editing) */}
      {!isEditing && (
        <>
          {/* Tab bar */}
          <div className="border-b border-surface-border overflow-x-auto scrollbar-hide -mx-4 px-4">
            <nav className="flex gap-1 min-w-max" role="tablist" aria-label="Deck sections">
              {detailTabs.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={activeTab === tab.key ? 'lg-tab-active' : 'lg-tab-inactive'}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Cards tab */}
          {activeTab === 'cards' && (
            deck.cards.length === 0 ? (
              <div className="text-center py-12">
                <p className="lg-text-muted">This deck has no cards yet.</p>
                {isOwner && (
                  <button onClick={() => setIsEditing(true)} className="lg-btn-secondary mt-4">
                    Add Cards
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="lg-section-title px-1">Cards</h2>
                <div className="lg-card overflow-hidden divide-y divide-surface-border">
                  {deck.cards.map((entry) => {
                    const rarity = RARITY_COLORS[entry.card.rarity] ?? FALLBACK_RARITY;
                    const primaryDomain = entry.card.domain?.split(';')[0] ?? null;
                    const domainColor = primaryDomain ? DOMAIN_COLORS[primaryDomain] : null;
                    const borderColor = domainColor?.border ?? rarity.border;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-shrink-0">
                          {entry.card.imageSmall ? (
                            <div className={`relative w-10 h-14 rounded overflow-hidden border ${borderColor}`}>
                              <Image src={entry.card.imageSmall} alt={entry.card.name} fill sizes="40px" className="object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-14 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                              <span className="text-zinc-600 text-xs" aria-hidden>?</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/cards/${entry.card.id}`} className="text-sm font-medium text-white truncate hover:text-rift-400 transition-colors block">
                            {entry.card.name}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {primaryDomain && domainColor ? (
                              <span className={`lg-badge ${domainColor.text} ${domainColor.bg}`}>{primaryDomain}</span>
                            ) : (
                              <span className={`lg-badge ${rarity.text} ${rarity.bg}`}>{entry.card.rarity}</span>
                            )}
                            {entry.card.cardType && <span className="lg-text-muted">{entry.card.cardType}</span>}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <span className="text-sm font-bold text-white">&times;{entry.quantity}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Analytics tab */}
          {activeTab === 'analytics' && (
            <div className="lg-card px-5 py-4">
              <DeckAnalytics cards={deck.cards} />
            </div>
          )}

          {/* Sample Hand section — visible on all tabs when deck has main-zone cards */}
          {deck.cards.some((c) => c.zone === 'main') && (
            <HandSimulator
              cards={deck.cards.map((c) => ({
                cardId: c.card.id,
                quantity: c.quantity,
                name: c.card.name,
                imageSmall: c.card.imageSmall ?? null,
                zone: c.zone,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
