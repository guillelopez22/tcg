'use client';

// Wantlist tab — displays want-type wishlist entries with card thumbnails
// Links to the card detail page. Empty state encourages browsing cards.

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { CardGridSkeleton } from '@/components/skeletons';

export function WantlistTab() {
  const { user } = useAuth();
  const t = useTranslations('wantlist');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = trpc.wishlist.list.useQuery(
    { type: 'want', limit: 100 },
    { enabled: !!user },
  );

  const entries = data?.items ?? [];

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

  if (entries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30">⭐</div>
        <p className="lg-text-secondary mb-4">{t('empty')}</p>
        <Link href="/cards" className="lg-btn-link">
          Browse cards to add to your wantlist
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={`/collection/${entry.card.id}`}
          className="relative rounded-xl overflow-hidden border border-surface-border bg-surface-card hover:border-rift-600/50 transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
        >
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
              <span className="absolute bottom-1 left-1 lg-badge bg-purple-900/80 text-purple-300 text-[9px]">
                {entry.preferredVariant}
              </span>
            )}
            {/* Max price badge */}
            {entry.maxPrice && (
              <span className="absolute bottom-1 right-1 lg-badge bg-surface-card/80 text-zinc-300 text-[9px]">
                ≤${entry.maxPrice}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
