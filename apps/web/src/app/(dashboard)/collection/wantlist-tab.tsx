'use client';

// Wantlist tab — displays want-type wishlist entries with card thumbnails
// Links to the card detail page. Floating + button opens add-to-wantlist modal.
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

export function WantlistTab() {
  const { user } = useAuth();
  const t = useTranslations('wantlist');
  const tCommon = useTranslations('common');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Visibility state — default private. True = public, false = private.
  const [isPublic, setIsPublic] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = trpc.wishlist.list.useQuery(
    { type: 'want', limit: 100 },
    { enabled: !!user },
  );

  const updateMutation = trpc.wishlist.update.useMutation();

  const removeMutation = trpc.wishlist.toggle.useMutation({
    onSuccess: () => {
      toast.success('Removed from wantlist');
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
          Mark cards you're looking for. Tap <span className="text-yellow-400 font-medium">+</span> to add cards, tap any card to set a preferred variant or max price.
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
            {t('addToWantlist')}
          </button>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="lg-fab"
          aria-label={t('addToWantlist')}
          title={t('addToWantlist')}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <AddToWishlistModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => void refetch()}
          type="want"
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
                  {/* Preferred variant badge */}
                  {entry.preferredVariant && (
                    <span className="absolute bottom-8 left-1 lg-badge bg-purple-900/80 text-purple-300 text-[9px]">
                      {entry.preferredVariant}
                    </span>
                  )}
                  {/* Max price badge */}
                  {entry.maxPrice && (
                    <span className="absolute bottom-8 right-1 lg-badge bg-surface-card/80 text-zinc-300 text-[9px]">
                      ≤${entry.maxPrice}
                    </span>
                  )}
                </div>
              </Link>
              {/* Remove overlay */}
              <div className="absolute bottom-0 inset-x-0 flex items-center justify-center px-1.5 py-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setRemovingCardId(entry.card.id);
                    removeMutation.mutate({ cardId: entry.card.id, type: 'want' });
                  }}
                  disabled={isRemoving}
                  className="w-8 h-8 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-500 active:scale-90 transition-all disabled:opacity-50"
                  aria-label={`Remove ${entry.card.name} from wantlist`}
                >
                  {isRemoving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating + button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="lg-fab"
        aria-label={t('addToWantlist')}
        title={t('addToWantlist')}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <AddToWishlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => void refetch()}
        type="want"
      />
    </>
  );
}
