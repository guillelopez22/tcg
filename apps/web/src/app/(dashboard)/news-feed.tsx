'use client';

import { trpc } from '@/lib/trpc';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

type NewsArticle = inferRouterOutputs<AppRouter>['news']['getLatest'][number];

const SOURCE_COLORS: Record<string, string> = {
  'riftbound.gg': 'bg-blue-900/40 text-blue-400 border-blue-700/40',
};

function formatRelativeDate(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NewsCardSkeleton() {
  return (
    <div className="lg-card p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-16 h-16 bg-surface-elevated rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-elevated rounded w-3/4" />
          <div className="h-3 bg-surface-elevated rounded w-1/2" />
          <div className="h-3 bg-surface-elevated rounded w-full" />
          <div className="h-3 bg-surface-elevated rounded w-2/3" />
        </div>
      </div>
    </div>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const sourceClass =
    SOURCE_COLORS[article.source] ?? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/40';

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="lg-card p-4 flex gap-3 hover:border-zinc-600 transition-colors cursor-pointer block"
    >
      {/* Thumbnail */}
      {article.thumbnailUrl ? (
        <img
          src={article.thumbnailUrl}
          alt=""
          aria-hidden
          className="w-16 h-16 object-cover rounded-lg shrink-0 bg-surface-elevated"
        />
      ) : (
        <div className="w-16 h-16 rounded-lg bg-surface-elevated shrink-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h4"
            />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={`lg-badge border text-xs font-medium ${sourceClass}`}>
            {article.source}
          </span>
          {article.publishedAt && (
            <span className="text-zinc-500 text-xs">{formatRelativeDate(article.publishedAt)}</span>
          )}
        </div>
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{article.title}</p>
        {article.excerpt && (
          <p className="text-xs lg-text-secondary line-clamp-2 leading-relaxed">{article.excerpt}</p>
        )}
      </div>
    </a>
  );
}

function EmptyNewsState() {
  return (
    <div className="lg-card p-8 text-center space-y-3">
      <svg
        className="w-10 h-10 mx-auto text-zinc-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h4"
        />
      </svg>
      <p className="text-zinc-400 text-sm">No news yet -- check back later</p>
    </div>
  );
}

export function NewsFeed() {
  const { data: articles, isLoading } = trpc.news.getLatest.useQuery({ limit: 10 });

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-white">Community News</h2>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : !articles || articles.length === 0 ? (
        <EmptyNewsState />
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
