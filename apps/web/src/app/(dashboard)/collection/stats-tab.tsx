'use client';

// Stats tab — shows total unique cards, total copies, total market value,
// per-set completion bars, value breakdown bar chart, rarity distribution
// donut chart, and deck recommendations.

import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { SetValueChart, RarityChart } from './stats-charts';
import { DeckRecommendations } from './deck-recommendations';

export function StatsTab() {
  const { user } = useAuth();
  const t = useTranslations('stats');
  const tCommon = useTranslations('common');

  const { data, isLoading, isError, refetch } = trpc.collection.stats.useQuery(
    undefined,
    { enabled: !!user },
  );

  if (isLoading) {
    return (
      <div role="status">
        <span className="sr-only">{tCommon('loading')}</span>
        <StatsSkeletons />
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

  const stats = data;
  if (!stats) return null;

  const totalValue = stats.totalMarketValue ?? 0;

  return (
    <div className="space-y-6">
      {/* Top stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="lg-stat-box">
          <p className="lg-stat-label">{t('totalUnique')}</p>
          <p className="lg-stat-value">{stats.uniqueCards.toLocaleString()}</p>
        </div>
        <div className="lg-stat-box">
          <p className="lg-stat-label">{t('totalCopies')}</p>
          <p className="lg-stat-value">{stats.totalCards.toLocaleString()}</p>
        </div>
        <div className="lg-stat-box">
          <p className="lg-stat-label">{t('totalValue')}</p>
          <p className="lg-stat-value text-rift-400">
            ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Set completion */}
      <section>
        <h3 className="lg-section-title mb-3">{t('setCompletion')}</h3>
        <div className="space-y-3">
          {stats.setStats.length === 0 ? (
            <p className="text-sm text-zinc-500">{t('noSets')}</p>
          ) : (
            stats.setStats
              .filter((s) => s.totalCards > 0)
              .map((set) => (
                <div key={set.setId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-300 truncate flex-1">{set.setName}</span>
                    <span className="text-xs text-zinc-400 flex-shrink-0 ml-2">
                      {set.ownedCards}/{set.totalCards} ({set.completionPercent}%)
                    </span>
                  </div>
                  <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rift-600 rounded-full transition-all"
                      style={{ width: `${set.completionPercent}%` }}
                    />
                  </div>
                </div>
              ))
          )}
        </div>
      </section>

      {/* Value by set — bar chart */}
      <section>
        <h3 className="lg-section-title mb-3">{t('valueBreakdown')}</h3>
        <div className="lg-card p-3">
          <SetValueChart data={stats.valueBySet} />
        </div>
      </section>

      {/* Rarity distribution — donut chart */}
      <section>
        <h3 className="lg-section-title mb-3">{t('rarityDistribution')}</h3>
        <div className="lg-card p-3">
          <RarityChart data={stats.rarityDistribution} />
        </div>
      </section>

      {/* Deck recommendations */}
      <section>
        <h3 className="lg-section-title mb-3">{t('deckRecommendations')}</h3>
        <DeckRecommendations />
      </section>
    </div>
  );
}

function StatsSkeletons() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="lg-stat-box">
            <div className="h-3 bg-surface-elevated rounded w-3/4 mb-2" />
            <div className="h-6 bg-surface-elevated rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Set bars */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 bg-surface-elevated rounded w-2/3 mb-1" />
            <div className="h-2 bg-surface-elevated rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
