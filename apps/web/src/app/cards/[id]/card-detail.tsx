'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { RARITY_COLORS, DOMAIN_COLORS } from '@/lib/design-tokens';
import { DetailSkeleton } from '@/components/skeletons';
import { toast } from 'sonner';

const FALLBACK_RARITY = { text: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', glow: '' };

interface CardDetailProps {
  cardId: string;
}

export function CardDetail({ cardId }: CardDetailProps) {
  const { user } = useAuth();
  const { data: card, isLoading, isError } = trpc.card.getById.useQuery({ id: cardId });
  const [justAdded, setJustAdded] = useState(false);
  const utils = trpc.useUtils();

  const addToCollection = trpc.collection.add.useMutation({
    onSuccess() {
      toast.success('Added to collection!');
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
    },
    onError(err) {
      toast.error(err.message ?? 'Failed to add to collection.');
    },
  });

  if (isLoading) {
    return (
      <div className="lg-container py-6 lg-page-padding" role="status">
        <span className="sr-only">Loading card</span>
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !card) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <div className="text-center">
          <p className="lg-text-secondary mb-4">Card not found.</p>
          <Link href="/cards" className="lg-btn-link">Back to cards</Link>
        </div>
      </div>
    );
  }

  const domains = card.domain.split(';').filter(Boolean);
  const rarity = RARITY_COLORS[card.rarity] ?? FALLBACK_RARITY;

  return (
    <div className="lg-container py-6 lg-page-padding">
      <Link href="/cards" className="inline-flex items-center gap-1 lg-text-secondary hover:text-white mb-6 transition-colors">
        <span aria-hidden>&larr;</span> Back to cards
      </Link>

      <div className="flex flex-col sm:flex-row gap-6">
        {/* Card image */}
        <div className="flex-shrink-0 mx-auto sm:mx-0">
          {card.imageLarge ? (
            <div className="relative">
              <div className={`absolute -inset-3 rounded-2xl blur-xl opacity-20 ${rarity.bg}`} />
              <div className={`relative w-[240px] h-[336px] rounded-xl overflow-hidden border shadow-lg ${rarity.border}`}>
                <Image src={card.imageLarge} alt={card.name} fill sizes="240px" className="object-cover" priority />
              </div>
            </div>
          ) : (
            <div className={`w-[240px] h-[336px] rounded-xl bg-surface-elevated border flex items-center justify-center ${rarity.border}`}>
              <span className="lg-text-muted">{card.name}</span>
            </div>
          )}
        </div>

        {/* Card info */}
        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{card.name}</h1>
            {card.cleanName !== card.name && <p className="lg-text-muted">{card.cleanName}</p>}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`lg-badge ${rarity.text} ${rarity.bg}`}>{card.rarity}</span>
            <span className="lg-badge text-zinc-300 bg-zinc-800">{card.cardType}</span>
            {domains.map((d) => {
              const dc = DOMAIN_COLORS[d] ?? { text: 'text-rift-300', bg: 'bg-rift-950' };
              return <span key={d} className={`lg-badge ${dc.text} ${dc.bg}`}>{d}</span>;
            })}
          </div>

          {/* Stats */}
          <dl className="grid grid-cols-3 gap-2">
            {card.energyCost !== null && (
              <div className="lg-stat-box text-center">
                <dt className="lg-stat-label">Energy</dt>
                <dd className="text-lg font-bold text-white">{card.energyCost}</dd>
              </div>
            )}
            {card.powerCost !== null && (
              <div className="lg-stat-box text-center">
                <dt className="lg-stat-label">Power</dt>
                <dd className="text-lg font-bold text-white">{card.powerCost}</dd>
              </div>
            )}
            {card.might !== null && (
              <div className="lg-stat-box text-center">
                <dt className="lg-stat-label">Might</dt>
                <dd className="text-lg font-bold text-white">{card.might}</dd>
              </div>
            )}
          </dl>

          {card.description && (
            <div>
              <h2 className="lg-section-title mb-1">Ability</h2>
              <p className="text-sm text-zinc-200 leading-relaxed">{card.description}</p>
            </div>
          )}

          {card.flavorText && (
            <blockquote className="border-l-2 border-rift-700 pl-3">
              <p className="text-sm text-zinc-500 italic">{card.flavorText}</p>
            </blockquote>
          )}

          {/* Add to Collection */}
          <div className="pt-2">
            {user ? (
              <button
                onClick={() => addToCollection.mutate({ cardId: card.id })}
                disabled={addToCollection.isPending || justAdded}
                className={`w-full lg-btn py-2.5 ${
                  justAdded
                    ? 'border border-green-600 text-green-400 bg-green-950/30'
                    : 'bg-rift-600 text-white hover:bg-rift-500'
                }`}
              >
                {justAdded ? 'Added!' : addToCollection.isPending ? 'Adding...' : '+ Add to Collection'}
              </button>
            ) : (
              <p className="lg-text-muted text-center">
                <Link href="/login" className="lg-btn-link">Sign in</Link> to add to collection
              </p>
            )}
          </div>

          {/* Pricing */}
          <CardPricing price={card.price} tcgplayerUrl={card.tcgplayerUrl ?? null} />

          <div className="pt-2 flex items-center justify-between text-xs text-zinc-600">
            <span>#{card.number}</span>
            {card.tcgplayerUrl && (
              <a href={card.tcgplayerUrl} target="_blank" rel="noopener noreferrer" className="lg-btn-link">
                View on TCGPlayer &rarr;
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PriceData {
  marketPrice: string | null;
  lowPrice: string | null;
  highPrice: string | null;
  foilMarketPrice: string | null;
  foilLowPrice: string | null;
  foilHighPrice: string | null;
  updatedAt: Date | string;
}

function formatUsd(value: string | null): string | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  return `$${num.toFixed(2)}`;
}

function hoursAgo(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'less than an hour ago';
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function PriceRow({ label, market, low, high }: { label: string; market: string | null; low: string | null; high: string | null }) {
  if (!market && !low && !high) return null;
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-3">
        {market && (
          <span className="text-base font-semibold text-emerald-400">{market}</span>
        )}
        {(low || high) && (
          <span className="text-xs text-zinc-500">
            {low && high ? `${low} – ${high}` : low ?? high}
          </span>
        )}
      </div>
    </div>
  );
}

function CardPricing({ price, tcgplayerUrl }: { price: PriceData | null; tcgplayerUrl: string | null }) {
  const normalMarket = formatUsd(price?.marketPrice ?? null);
  const normalLow = formatUsd(price?.lowPrice ?? null);
  const normalHigh = formatUsd(price?.highPrice ?? null);
  const foilMarket = formatUsd(price?.foilMarketPrice ?? null);
  const foilLow = formatUsd(price?.foilLowPrice ?? null);
  const foilHigh = formatUsd(price?.foilHighPrice ?? null);

  const hasNormal = !!(normalMarket || normalLow || normalHigh);
  const hasFoil = !!(foilMarket || foilLow || foilHigh);

  if (!price || (!hasNormal && !hasFoil)) {
    return (
      <div className="lg-stat-box">
        <p className="text-xs text-zinc-500 mb-1">Price</p>
        <p className="text-sm text-zinc-400">
          Price unavailable
          {tcgplayerUrl && (
            <>
              {' — '}
              <a href={tcgplayerUrl} target="_blank" rel="noopener noreferrer" className="lg-btn-link">
                Check TCGPlayer
              </a>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="lg-stat-box space-y-3">
      {hasNormal && (
        <PriceRow label="Normal" market={normalMarket} low={normalLow} high={normalHigh} />
      )}
      {hasFoil && (
        <PriceRow label="Foil" market={foilMarket} low={foilLow} high={foilHigh} />
      )}
      <p className="text-xs text-zinc-600">Updated {hoursAgo(price.updatedAt)}</p>
    </div>
  );
}
