'use client';

// Tradelist tab — displays trade-type wishlist entries with card thumbnails.
// Shows asking price badge if set. Floating + button opens add-to-tradelist modal.
// Includes a per-list public/private visibility toggle.

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { CardGridSkeleton } from '@/components/skeletons';
import { AddToWishlistModal } from './add-to-wishlist-modal';

export function TradelistTab() {
  const { user } = useAuth();
  const t = useTranslations('tradelist');
  const tCommon = useTranslations('common');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Visibility state — default private. True = public, false = private.
  const [isPublic, setIsPublic] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);
  const [pricingEntryId, setPricingEntryId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');

  const { data, isLoading, isError, refetch } = trpc.wishlist.list.useQuery(
    { type: 'trade', limit: 100 },
    { enabled: !!user },
  );

  const updateMutation = trpc.wishlist.update.useMutation({
    onSuccess: () => {
      toast.success('Asking price updated');
      void refetch();
      setPricingEntryId(null);
      setPriceInput('');
    },
    onError: () => toast.error('Failed to update price'),
  });

  const removeMutation = trpc.wishlist.toggle.useMutation({
    onSuccess: () => {
      toast.success('Removed from tradelist');
      void refetch();
    },
    onError: () => toast.error('Failed to remove'),
    onSettled: () => setRemovingCardId(null),
  });

  const entries = data?.items ?? [];

  async function handleVisibilityToggle() {
    if (entries.length === 0) {
      setIsPublic(!isPublic);
      return;
    }
    const next = !isPublic;
    setIsTogglingVisibility(true);
    try {
      for (const entry of entries) {
        await updateMutation.mutateAsync({ id: entry.id, isPublic: next });
      }
      setIsPublic(next);
    } finally {
      setIsTogglingVisibility(false);
    }
  }

  if (isLoading) {
    return (
      <div role="status">
        <span className="sr-only">{tCommon('loading')}</span>
        <CardGridSkeleton count={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="lg-alert-error">
        {tCommon('error')}
        <button onClick={() => void refetch()} className="lg-btn-link mt-2 block">
          Try again
        </button>
      </div>
    );
  }

  const header = (
    <div className="rounded-xl border border-surface-border bg-surface-card/50 p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400 leading-relaxed flex-1">
          List cards you're willing to trade or sell. Tap <span className="text-rift-400 font-medium">+</span> to add cards, tap <span className="text-rift-400 font-medium">$</span> on a card to set an asking price.
        </p>
        <button
          onClick={() => void handleVisibilityToggle()}
          disabled={isTogglingVisibility}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
            isPublic
              ? 'text-green-400 bg-green-900/20 hover:bg-green-900/30'
              : 'text-zinc-400 bg-surface-elevated hover:bg-zinc-700/50'
          } disabled:opacity-50`}
          title={t('visibilityToggleLabel')}
          aria-label={t('visibilityToggleLabel')}
        >
          {isPublic ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" strokeLinecap="round" />
              </svg>
              {t('public')}
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
              </svg>
              {t('private')}
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (entries.length === 0) {
    return (
      <>
        {header}
        <div className="text-center py-10">
          <p className="lg-text-secondary mb-4">{t('empty')}</p>
          <button onClick={() => setIsModalOpen(true)} className="lg-btn-secondary px-4 py-2">
            {t('addToTradelist')}
          </button>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="lg-fab"
          aria-label={t('addToTradelist')}
          title={t('addToTradelist')}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <AddToWishlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => void refetch()}
          type="trade"
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.map((entry) => {
          const isRemoving = removingCardId === entry.card.id;
          const isPricing = pricingEntryId === entry.id;
          return (
            <div
              key={entry.id}
              className="relative group rounded-xl overflow-hidden border border-surface-border bg-surface-card hover:border-rift-600/50 transition-all"
            >
              <Link href={`/collection/${entry.card.id}`}>
                <div className="aspect-[2/3] relative bg-surface-elevated">
                  {entry.card.imageSmall ? (
                    <Image
                      src={entry.card.imageSmall}
                      alt={entry.card.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <span className="text-xs text-zinc-600 text-center">{entry.card.name}</span>
                    </div>
                  )}
                </div>
              </Link>
              {/* Inline price editor */}
              {isPricing ? (
                <div className="absolute bottom-0 inset-x-0 p-2 bg-black/90">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (priceInput.match(/^\d+(\.\d{1,2})?$/)) {
                        updateMutation.mutate({ id: entry.id, askingPrice: priceInput });
                      }
                    }}
                    className="flex gap-1"
                  >
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                      <input
                        autoFocus
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded-md pl-5 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-rift-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!priceInput.match(/^\d+(\.\d{1,2})?$/) || updateMutation.isPending}
                      className="w-7 h-7 rounded-md bg-rift-600 text-white flex items-center justify-center hover:bg-rift-500 active:scale-90 transition-all disabled:opacity-50 flex-shrink-0 self-center"
                      aria-label="Save price"
                    >
                      {updateMutation.isPending ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPricingEntryId(null); setPriceInput(''); }}
                      className="w-7 h-7 rounded-md bg-zinc-700 text-zinc-300 flex items-center justify-center hover:bg-zinc-600 active:scale-90 transition-all flex-shrink-0 self-center"
                      aria-label="Cancel"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </form>
                </div>
              ) : (
                /* Action overlay: price + remove */
                <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-1.5 py-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setRemovingCardId(entry.card.id);
                      removeMutation.mutate({ cardId: entry.card.id, type: 'trade' });
                    }}
                    disabled={isRemoving}
                    className="w-8 h-8 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-500 active:scale-90 transition-all disabled:opacity-50"
                    aria-label={`Remove ${entry.card.name} from tradelist`}
                  >
                    {isRemoving ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                      </svg>
                    )}
                  </button>
                  <span className="text-white font-bold text-xs tabular-nums">
                    {entry.askingPrice ? `$${entry.askingPrice}` : ''}
                  </span>
                  <button
                    onClick={() => {
                      setPricingEntryId(entry.id);
                      setPriceInput(entry.askingPrice ?? '');
                    }}
                    className="w-8 h-8 rounded-full bg-rift-600/90 text-white flex items-center justify-center hover:bg-rift-500 active:scale-90 transition-all"
                    aria-label={`Set asking price for ${entry.card.name}`}
                    title="Set asking price"
                  >
                    <span className="text-sm font-bold">$</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating + button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="lg-fab"
        aria-label={t('addToTradelist')}
        title={t('addToTradelist')}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <AddToWishlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => void refetch()}
        type="trade"
      />
    </>
  );
}
