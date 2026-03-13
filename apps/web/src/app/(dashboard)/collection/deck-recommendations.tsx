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
  const [importState, setImportState] = useState<'idle' | 'fetching' | 'creating'>('idle');

  const utils = trpc.useUtils();
  const addIfMissingMutation = trpc.wishlist.addIfMissing.useMutation();

  const createDeck = trpc.deck.create.useMutation({
    onSuccess() {
      void utils.deck.list.invalidate();
      setImportState('idle');
      toast.success(`Imported "${rec.deckName.replace(/^\[RD\]\s*/, '')}" to your decks`);
    },
    onError(err) {
      setImportState('idle');
      toast.error(`Import failed: ${err.message}`);
    },
  });

  async function handleImport() {
    if (importState !== 'idle') return;
    setImportState('fetching');
    let deckDetail: Awaited<ReturnType<typeof utils.deck.getById.fetch>>;
    try {
      deckDetail = await utils.deck.getById.fetch({ id: rec.deckId });
    } catch {
      setImportState('idle');
      toast.error('Could not load deck details');
      return;
    }
    setImportState('creating');
    const legendCard = deckDetail.cards.find((c) => c.card.cardType === 'Legend');
    createDeck.mutate({
      name: rec.deckName.replace(/^\[RD\]\s*/, ''),
      isPublic: false,
      coverCardId: legendCard?.cardId ?? undefined,
      cards: deckDetail.cards.map((c) => ({ cardId: c.cardId, quantity: c.quantity })),
    });
  }

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
        await addIfMissingMutation.mutateAsync({ cardId: card.cardId, type: 'want' });
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

  const importBusy = importState !== 'idle';

  return (
    <div className="lg-card overflow-hidden">
      <div className="p-3">
        <div className="flex gap-3">
          {/* Champion art thumbnail */}
          <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0">
            {rec.championImageSmall ? (
              <Image
                src={rec.championImageSmall}
                alt={rec.champion ?? rec.deckName}
                fill
                sizes="40px"
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

          {/* Deck info + inline import */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-semibold text-zinc-100 leading-tight truncate">
                    {rec.deckName.replace(/^\[RD\]\s*/, '')}
                  </h4>
                  {rec.domain && (
                    <span className={`text-[10px] font-medium flex-shrink-0 ${domainColor}`}>
                      {rec.domain}
                    </span>
                  )}
                </div>
                {/* Compact ownership line */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ownershipColor}`}
                      style={{ width: ownershipBarWidth }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-400 flex-shrink-0">{rec.ownershipPct}%</span>
                </div>
              </div>

              {/* Inline import button */}
              <button
                onClick={() => void handleImport()}
                disabled={importBusy}
                className="flex-shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-md border border-rift-700/60 text-rift-300 hover:bg-rift-900/30 transition-colors disabled:opacity-50"
              >
                {importState === 'fetching' ? '...' : importState === 'creating' ? '...' : 'Import'}
              </button>
            </div>

            {/* Missing cards count + expand */}
            {rec.missingCards.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 mt-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <span>{rec.missingCards.length} missing</span>
                <svg
                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Expanded missing cards */}
        {isExpanded && rec.missingCards.length > 0 && (
          <div className="mt-2 pt-2 border-t border-surface-border">
            <div className="space-y-0.5">
              {rec.missingCards.map((card) => (
                <div key={card.cardId} className="flex items-center justify-between py-0.5">
                  <span className="text-[11px] text-zinc-300 truncate flex-1">
                    {card.quantity}x {card.cardName}
                  </span>
                  {card.marketPrice && (
                    <span className="text-[11px] text-zinc-500 flex-shrink-0 ml-2">
                      ${card.marketPrice}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {!addedToWantlist ? (
              <button
                onClick={() => void handleAddAllMissing()}
                disabled={addIfMissingMutation.isPending}
                className="mt-2 w-full py-1.5 px-3 text-[11px] font-medium text-rift-300 border border-rift-700/50 rounded-lg hover:bg-rift-900/30 transition-colors disabled:opacity-50"
              >
                {addIfMissingMutation.isPending ? t('adding') : t('addAllMissing')}
              </button>
            ) : (
              <div className="mt-2 w-full py-1.5 px-3 text-[11px] font-medium text-green-400 border border-green-700/50 rounded-lg text-center">
                {t('addedToWantlistConfirm')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
