'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

type NewsArticle = inferRouterOutputs<AppRouter>['news']['getLatest'][number];

const SOURCE_COLORS: Record<string, string> = {
  'Riftbound Official': 'bg-amber-900/40 text-amber-400 border-amber-700/40',
  'riftbound.gg': 'bg-blue-900/40 text-blue-400 border-blue-700/40',
  'riftdecks.com': 'bg-purple-900/40 text-purple-400 border-purple-700/40',
  'twitter': 'bg-sky-900/40 text-sky-400 border-sky-700/40',
  'youtube': 'bg-red-900/40 text-red-400 border-red-700/40',
  'reddit': 'bg-orange-900/40 text-orange-400 border-orange-700/40',
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
  const [expanded, setExpanded] = useState(false);
  const sourceClass =
    SOURCE_COLORS[article.source] ?? 'bg-zinc-800/50 text-zinc-400 border-zinc-700/40';

  return (
    <div className="lg-card overflow-hidden">
      {/* Header — always visible, clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex gap-3 hover:bg-surface-elevated/50 transition-colors text-left"
      >
        {/* Thumbnail */}
        {article.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
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

        {/* Content preview */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`lg-badge border text-xs font-medium ${sourceClass}`}>
              {article.source}
            </span>
            {article.publishedAt && (
              <span className="text-zinc-500 text-xs">{formatRelativeDate(article.publishedAt)}</span>
            )}
          </div>
          <p className={`text-sm font-semibold text-white leading-snug ${expanded ? '' : 'line-clamp-2'}`}>
            {article.title}
          </p>
          {!expanded && article.excerpt && (
            <p className="text-xs lg-text-secondary line-clamp-2 leading-relaxed">{article.excerpt}</p>
          )}
        </div>

        {/* Expand indicator */}
        <div className="shrink-0 self-center">
          <svg
            className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-border">
          {/* Large thumbnail */}
          {article.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.thumbnailUrl}
              alt={article.title}
              className="w-full max-h-64 object-cover rounded-lg mt-3"
            />
          )}

          {/* Full excerpt / content */}
          {article.excerpt && (
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
              {article.excerpt}
            </div>
          )}

          {/* Footer with source link */}
          <div className="flex items-center justify-between pt-2 border-t border-surface-border">
            <span className="text-xs text-zinc-500">
              From {article.source}
              {article.publishedAt && ` - ${new Date(article.publishedAt).toLocaleDateString()}`}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-rift-400 hover:text-rift-300 transition-colors flex items-center gap-1"
            >
              View original
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
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
  const { data: articles, isLoading, isError } = trpc.news.getLatest.useQuery(
    { limit: 20 },
    { retry: 1, staleTime: 5 * 60 * 1_000 },
  );

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <NewsCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="lg-card p-6 text-center">
          <p className="text-zinc-400 text-sm">Could not load news. The server may still be syncing.</p>
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
