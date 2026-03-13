'use client';

// Card detail page — shows large card art, card info, wantlist/tradelist toggles,
// all user copies with inline editing, and "Add another copy" button.

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { DetailSkeleton } from '@/components/skeletons';
import { CopyList } from './copy-list';

interface PageProps {
  params: { cardId: string };
}

const RARITY_COLORS: Record<string, string> = {
  Common: 'text-zinc-400',
  Uncommon: 'text-green-400',
  Rare: 'text-blue-400',
  Epic: 'text-purple-400',
  Showcase: 'text-yellow-400',
  'Alternate Art': 'text-pink-400',
  Overnumbered: 'text-orange-400',
};

export default function CardDetailPage({ params }: PageProps) {
  const { cardId } = params;
  const { user } = useAuth();
  const t = useTranslations('collection');
  const tWant = useTranslations('wantlist');
  const tTrade = useTranslations('tradelist');
  const tCommon = useTranslations('common');

  // Fetch card data
  const { data: card, isLoading: cardLoading } = trpc.card.getById.useQuery(
    { id: cardId },
    { staleTime: Infinity },
  );

  // Fetch all user copies for this card
  const {
    data: copiesData,
    isLoading: copiesLoading,
    refetch: refetchCopies,
  } = trpc.collection.getByCard.useQuery(
    { cardId },
    { enabled: !!user },
  );

  // Fetch wishlist status for this card
  const {
    data: wishlistStatus,
    refetch: refetchWishlist,
  } = trpc.wishlist.getForCard.useQuery(
    { cardId },
    { enabled: !!user },
  );

  const utils = trpc.useUtils();

  // Wishlist toggle mutation
  const toggle = trpc.wishlist.toggle.useMutation({
    onSuccess(data, variables) {
      void refetchWishlist();
      const typeLabel = variables.type === 'want' ? 'wantlist' : 'tradelist';
      toast.success(data.added ? `Added to ${typeLabel}` : `Removed from ${typeLabel}`);
    },
    onError(err) {
      toast.error(err.message ?? tCommon('error'));
    },
  });

  // Add another copy mutation
  const addCopy = trpc.collection.add.useMutation({
    onSuccess() {
      void refetchCopies();
      void utils.collection.stats.invalidate();
      toast.success('Copy added');
    },
    onError(err) {
      toast.error(err.message ?? tCommon('error'));
    },
  });

  const copies = copiesData ?? [];
  const onWantlist = wishlistStatus?.onWantlist ?? false;
  const onTradelist = wishlistStatus?.onTradelist ?? false;

  if (cardLoading || copiesLoading) {
    return (
      <div className="lg-page-padding">
        <DetailSkeleton />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="lg-page-padding text-center py-16">
        <p className="lg-text-secondary">Card not found.</p>
        <Link href="/collection" className="lg-btn-link mt-2 block">Back to collection</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg-page-padding">
      {/* Back link */}
      <Link href="/collection" className="inline-flex items-center gap-1 lg-text-secondary hover:text-white transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {tCommon('back')}
      </Link>

      {/* Card art + info */}
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        {/* Large card art */}
        <div className="w-full sm:w-48 flex-shrink-0 mx-auto sm:mx-0" style={{ maxWidth: 200 }}>
          <div className="relative rounded-xl overflow-hidden border border-surface-border shadow-lg aspect-[2/3] bg-surface-elevated">
            {card.imageLarge ? (
              <Image
                src={card.imageLarge}
                alt={card.name}
                fill
                sizes="(max-width: 640px) 80vw, 200px"
                className="object-cover"
                priority
              />
            ) : card.imageSmall ? (
              <Image
                src={card.imageSmall}
                alt={card.name}
                fill
                sizes="(max-width: 640px) 80vw, 200px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-4">
                <span className="text-zinc-600 text-center text-sm">{card.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card info */}
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-xl font-bold text-white">{card.name}</h1>
            {card.set && (
              <p className="lg-text-secondary text-sm">{card.set.name}</p>
            )}
            <p className={`text-sm font-medium mt-0.5 ${RARITY_COLORS[card.rarity ?? ''] ?? 'text-zinc-400'}`}>
              {card.rarity}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {card.cardType && (
              <span className="lg-badge bg-surface-elevated text-zinc-300">{card.cardType}</span>
            )}
            {card.domain && (
              <span className="lg-badge bg-rift-900/30 text-rift-400">{card.domain}</span>
            )}
          </div>

          {/* Wantlist / tradelist toggle buttons */}
          {user && (
            <div className="flex gap-2">
              {/* Wantlist star */}
              <button
                onClick={() => toggle.mutate({ cardId, type: 'want' })}
                disabled={toggle.isPending}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  onWantlist
                    ? 'border-yellow-600/50 bg-yellow-900/20 text-yellow-400'
                    : 'border-surface-border text-zinc-400 hover:border-yellow-600/40 hover:text-yellow-400'
                }`}
                title={onWantlist ? tWant('removeFromWantlist') : tWant('addToWantlist')}
              >
                <svg className="w-4 h-4" fill={onWantlist ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                {onWantlist ? tWant('removeFromWantlist') : tWant('addToWantlist')}
              </button>

              {/* Tradelist button */}
              <button
                onClick={() => toggle.mutate({ cardId, type: 'trade' })}
                disabled={toggle.isPending}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  onTradelist
                    ? 'border-rift-600/50 bg-rift-900/20 text-rift-400'
                    : 'border-surface-border text-zinc-400 hover:border-rift-600/40 hover:text-rift-400'
                }`}
                title={onTradelist ? tTrade('removeFromTradelist') : tTrade('addToTradelist')}
              >
                <svg className="w-4 h-4" fill={onTradelist ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {onTradelist ? tTrade('removeFromTradelist') : tTrade('addToTradelist')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Purchase history section */}
      <div className="space-y-3">
        <div className="rounded-xl border border-surface-border bg-surface-card/50 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Purchase History
            </h2>
            <span className="lg-badge bg-surface-elevated text-zinc-300">
              {copies.length} {copies.length === 1 ? 'copy' : 'copies'} owned
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Each copy represents a physical card you own. Track condition, variant, price paid, and photos for every purchase.
          </p>
        </div>

        <button
          onClick={() => addCopy.mutate({ cardId, variant: 'normal', condition: 'near_mint' })}
          disabled={addCopy.isPending}
          className="lg-btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {addCopy.isPending ? tCommon('loading') : 'Log a new purchase'}
        </button>

        <CopyList
          copies={copies}
          onCopiesChanged={() => void refetchCopies()}
        />
      </div>
    </div>
  );
}
