'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import type { ScannedEntry } from './card-scanner';

// ── Types ────────────────────────────────────────────────────────────────────

type WishlistType = 'want' | 'trade';

interface EntryToggleState {
  onWantlist: boolean;
  onTradelist: boolean;
}

// ── Labels ───────────────────────────────────────────────────────────────────

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  alt_art: 'Alt-Art',
  overnumbered: 'Overnumbered',
  signature: 'Signature',
};

const CONDITION_LABELS: Record<string, string> = {
  near_mint: 'NM',
  lightly_played: 'LP',
  moderately_played: 'MP',
  heavily_played: 'HP',
  damaged: 'DMG',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ScanSessionSummaryProps {
  sessionSummary: ScannedEntry[];
  onScanMore: () => void;
}

export function ScanSessionSummary({ sessionSummary, onScanMore }: ScanSessionSummaryProps) {
  const t = useTranslations('scanner');
  const router = useRouter();

  const totalCopies = sessionSummary.reduce((n, e) => n + e.quantity, 0);

  // Per-entry wishlist toggle state
  const [wishlistState, setWishlistState] = useState<Map<string, EntryToggleState>>(() => {
    const m = new Map<string, EntryToggleState>();
    for (const entry of sessionSummary) {
      m.set(entry.card.cardId, { onWantlist: false, onTradelist: false });
    }
    return m;
  });

  // Per-entry purchase price state (keyed by entry index for multiple copies of same card)
  const [purchasePrices, setPurchasePrices] = useState<Record<number, string>>({});

  const wishlistToggleMutation = trpc.wishlist.toggle.useMutation({
    onSuccess(data, variables) {
      const key = variables.cardId;
      const type = variables.type as WishlistType;
      setWishlistState((prev) => {
        const next = new Map(prev);
        const cur = next.get(key) ?? { onWantlist: false, onTradelist: false };
        next.set(key, {
          ...cur,
          onWantlist: type === 'want' ? data.added : cur.onWantlist,
          onTradelist: type === 'trade' ? data.added : cur.onTradelist,
        });
        return next;
      });
    },
    onError(err) {
      toast.error(err.message ?? 'Failed to update wishlist');
    },
  });

  const collectionUpdateMutation = trpc.collection.update.useMutation({
    onError(err) {
      toast.error(err.message ?? 'Failed to update purchase price');
    },
  });

  function handleWishlistToggle(cardId: string, type: WishlistType) {
    wishlistToggleMutation.mutate({ cardId, type });
  }

  function handlePurchasePriceBlur(collectionEntryId: string | undefined, index: number) {
    if (!collectionEntryId) return;
    const price = purchasePrices[index];
    if (!price) return;
    // Validate price format
    if (!/^\d+(\.\d{1,2})?$/.test(price)) {
      toast.error('Invalid price format (e.g. 12.50)');
      return;
    }
    collectionUpdateMutation.mutate({ id: collectionEntryId, purchasePrice: price });
  }

  function handleDone() {
    router.push('/collection');
  }

  if (sessionSummary.length === 0) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="lg-page-title">{t('sessionSummary')}</h1>
          <span className="lg-badge border border-surface-border text-zinc-400">0 cards</span>
        </div>
        <div className="lg-card py-16 flex flex-col items-center gap-3 text-center">
          <IconCamera className="w-10 h-10 text-zinc-700" />
          <p className="lg-text-secondary">{t('noCardsScanned')}</p>
          <button onClick={onScanMore} className="lg-btn-primary mt-2">
            {t('scanMore')}
          </button>
        </div>
      </div>
    );
  }

  // Deduplicate entries by cardId for wishlist display — same card may appear multiple times
  const uniqueCardIds = [...new Set(sessionSummary.map((e) => e.card.cardId))];

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="lg-page-title">{t('sessionSummary')}</h1>
        <span className="lg-badge border border-rift-800/50 bg-rift-950/80 text-rift-300">
          {totalCopies} {totalCopies === 1 ? 'card' : 'cards'}
        </span>
      </div>

      {/* Card list */}
      <div className="space-y-2">
        {sessionSummary.map((entry, index) => {
          const wlState = wishlistState.get(entry.card.cardId) ?? {
            onWantlist: false,
            onTradelist: false,
          };
          const uniqueIndex = uniqueCardIds.indexOf(entry.card.cardId);

          return (
            <div
              key={`${entry.card.cardId}-${index}`}
              className="lg-card flex gap-3 p-3"
            >
              {/* Card art */}
              {entry.card.imageSmall ? (
                <div className="relative flex-shrink-0 w-12 rounded-md overflow-hidden border border-surface-border" style={{ aspectRatio: '2/3' }}>
                  <Image
                    src={entry.card.imageSmall}
                    alt={entry.card.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className="flex-shrink-0 w-12 rounded-md bg-surface-elevated border border-surface-border flex items-center justify-center"
                  style={{ aspectRatio: '2/3' }}
                >
                  <span className="text-[9px] text-zinc-600 text-center px-0.5">{entry.card.name}</span>
                </div>
              )}

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white leading-tight truncate">{entry.card.name}</p>
                    <p className="text-[11px] text-zinc-500">{entry.card.setName}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1 pt-0.5">
                    <span className="lg-badge text-[10px] border border-surface-border text-zinc-400">
                      {VARIANT_LABELS[entry.variant] ?? entry.variant}
                    </span>
                    <span className="lg-badge text-[10px] border border-surface-border text-zinc-400">
                      {CONDITION_LABELS[entry.condition] ?? entry.condition}
                    </span>
                    {entry.quantity > 1 && (
                      <span className="lg-badge text-[10px] border border-rift-800 bg-rift-950/60 text-rift-400">
                        x{entry.quantity}
                      </span>
                    )}
                  </div>
                </div>

                {/* Market price + purchase price */}
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500">{t('marketPrice')}: </span>
                    <span className="text-[10px] text-zinc-400">—</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-500">{t('purchasePrice')}: </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={purchasePrices[index] ?? ''}
                      onChange={(e) =>
                        setPurchasePrices((p) => ({ ...p, [index]: e.target.value }))
                      }
                      onBlur={() => handlePurchasePriceBlur(undefined, index)}
                      className="w-14 bg-surface-elevated border border-surface-border rounded px-1.5 py-0.5 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-rift-700"
                      aria-label={`Purchase price for ${entry.card.name}`}
                    />
                  </div>
                </div>

                {/* Per-card wantlist / tradelist toggles (only shown once per unique card) */}
                {uniqueIndex === index && (
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => handleWishlistToggle(entry.card.cardId, 'want')}
                      disabled={wishlistToggleMutation.isPending}
                      className={[
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors',
                        wlState.onWantlist
                          ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50'
                          : 'bg-surface-elevated text-zinc-500 border-surface-border hover:border-yellow-700/50 hover:text-yellow-300',
                      ].join(' ')}
                      aria-pressed={wlState.onWantlist}
                      aria-label={`${wlState.onWantlist ? 'Remove from' : 'Add to'} wantlist`}
                    >
                      <IconStar className="w-3 h-3" filled={wlState.onWantlist} />
                      Want
                    </button>
                    <button
                      onClick={() => handleWishlistToggle(entry.card.cardId, 'trade')}
                      disabled={wishlistToggleMutation.isPending}
                      className={[
                        'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors',
                        wlState.onTradelist
                          ? 'bg-blue-900/40 text-blue-300 border-blue-700/50'
                          : 'bg-surface-elevated text-zinc-500 border-surface-border hover:border-blue-700/50 hover:text-blue-300',
                      ].join(' ')}
                      aria-pressed={wlState.onTradelist}
                      aria-label={`${wlState.onTradelist ? 'Remove from' : 'Add to'} tradelist`}
                    >
                      <IconArrow className="w-3 h-3" />
                      Trade
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — total session value */}
      <div className="lg-card p-4 flex items-center justify-between border-t border-surface-border">
        <div>
          <p className="text-xs text-zinc-500">{t('totalValue')}</p>
          <p className="text-lg font-semibold text-white">—</p>
          <p className="text-[10px] text-zinc-600">Market prices not available yet</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">{t('totalScanned')}</p>
          <p className="text-lg font-semibold text-rift-300">{totalCopies}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="fixed bottom-0 inset-x-0 z-10 px-4 pb-safe bg-gradient-to-t from-surface-base via-surface-base to-transparent pt-4 max-w-lg mx-auto">
        <div className="flex gap-3">
          <button
            onClick={onScanMore}
            className="lg-btn-secondary flex-1"
          >
            {t('scanMore')}
          </button>
          <button
            onClick={handleDone}
            className="lg-btn-primary flex-1"
          >
            {t('done')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconCamera({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconStar({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
