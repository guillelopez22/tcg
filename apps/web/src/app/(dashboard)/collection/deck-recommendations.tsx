'use client';

// Deck recommendations — shows top 5 public decks ranked by ownership %.
// Each card shows: champion art, deck name, ownership bar, synergy reasoning,
// expandable missing cards list, and "Add all missing to wantlist" button.

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';

export function DeckRecommendations() {
  const { user } = useAuth();
  const t = useTranslations('stats');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError } = trpc.deckRecommendations.getRecommendations.useQuery(
    undefined,
    { enabled: !!user },
  );

  const recommendations = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="lg-card p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-12 h-16 rounded bg-surface-elevated" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-elevated rounded w-3/4" />
                <div className="h-2 bg-surface-elevated rounded w-full" />
                <div className="h-3 bg-surface-elevated rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="lg-alert-error">
        {tCommon('error')}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="lg-text-secondary text-sm">{t('noRecommendations')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec) => (
        <DeckRecommendationCard key={rec.deckId} recommendation={rec} />
      ))}
    </div>
  );
}

interface DeckRecommendation {
  deckId: string;
  deckName: string;
  champion: string | null;
  championImageSmall: string | null;
  ownershipPct: number;
  ownedCards: Array<{ cardId: string; cardName: string; quantity: number }>;
  missingCards: Array<{
    cardId: string;
    cardName: string;
    quantity: number;
    marketPrice: string | null;
    imageSmall: string | null;
  }>;
  synergyReasoning: string;
  domain: string | null;
}

function DeckRecommendationCard({ recommendation: rec }: { recommendation: DeckRecommendation }) {
  const t = useTranslations('stats');
  const [isExpanded, setIsExpanded] = useState(false);
  const [addedToWantlist, setAddedToWantlist] = useState(false);

  const toggleMutation = trpc.wishlist.toggle.useMutation();

  const domainColorMap: Record<string, string> = {
    Fury: 'text-red-400',
    Calm: 'text-blue-400',
    Mind: 'text-purple-400',
    Body: 'text-green-400',
    Chaos: 'text-orange-400',
    Order: 'text-yellow-400',
  };
  const domainColor = rec.domain ? (domainColorMap[rec.domain] ?? 'text-zinc-400') : 'text-zinc-400';

  async function handleAddAllMissing() {
    if (rec.missingCards.length === 0) return;

    let addedCount = 0;
    for (const card of rec.missingCards) {
      try {
        await toggleMutation.mutateAsync({ cardId: card.cardId, type: 'want' });
        addedCount++;
      } catch {
        // Continue adding other cards even if one fails
      }
    }

    setAddedToWantlist(true);
    toast.success(t('addedToWantlist', { count: addedCount }));
  }

  const ownershipBarWidth = `${rec.ownershipPct}%`;
  const ownershipColor =
    rec.ownershipPct >= 75 ? 'bg-green-500' :
    rec.ownershipPct >= 50 ? 'bg-yellow-500' :
    rec.ownershipPct >= 25 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="lg-card overflow-hidden">
      <div className="p-4">
        <div className="flex gap-3">
          {/* Champion art thumbnail */}
          <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0">
            {rec.championImageSmall ? (
              <Image
                src={rec.championImageSmall}
                alt={rec.champion ?? rec.deckName}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[10px] text-zinc-600 text-center px-1 leading-tight">
                  {rec.domain ?? '?'}
                </span>
              </div>
            )}
          </div>

          {/* Deck info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-zinc-100 leading-tight truncate">
                {rec.deckName}
              </h4>
              {rec.domain && (
                <span className={`text-[10px] font-medium flex-shrink-0 ${domainColor}`}>
                  {rec.domain}
                </span>
              )}
            </div>

            {/* Ownership bar */}
            <div className="mt-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-zinc-400">{t('ownership')}</span>
                <span className="text-[11px] font-semibold text-zinc-300">{rec.ownershipPct}%</span>
              </div>
              <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${ownershipColor}`}
                  style={{ width: ownershipBarWidth }}
                />
              </div>
            </div>

            {/* Synergy reasoning */}
            <p className="mt-2 text-[11px] text-zinc-400 italic leading-relaxed line-clamp-2">
              {rec.synergyReasoning}
            </p>
          </div>
        </div>

        {/* Missing cards section */}
        {rec.missingCards.length > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-border">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-[11px] text-zinc-400">
                {t('missingCards', { count: rec.missingCards.length })}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div className="mt-2 space-y-1">
                {rec.missingCards.map((card) => (
                  <div key={card.cardId} className="flex items-center justify-between py-0.5">
                    <span className="text-[11px] text-zinc-300 truncate flex-1">
                      {card.quantity}x {card.cardName}
                    </span>
                    {card.marketPrice && (
                      <span className="text-[11px] text-zinc-400 flex-shrink-0 ml-2">
                        ${card.marketPrice}
                      </span>
                    )}
                  </div>
                ))}

                {!addedToWantlist ? (
                  <button
                    onClick={() => void handleAddAllMissing()}
                    disabled={toggleMutation.isPending}
                    className="mt-2 w-full py-1.5 px-3 text-[11px] font-medium text-rift-300 border border-rift-700/50 rounded-lg hover:bg-rift-900/30 transition-colors disabled:opacity-50"
                  >
                    {toggleMutation.isPending ? t('adding') : t('addAllMissing')}
                  </button>
                ) : (
                  <div className="mt-2 w-full py-1.5 px-3 text-[11px] font-medium text-green-400 border border-green-700/50 rounded-lg text-center">
                    {t('addedToWantlistConfirm')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
