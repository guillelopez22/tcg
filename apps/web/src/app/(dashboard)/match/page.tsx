'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

type MatchSummary = inferRouterOutputs<AppRouter>['match']['history']['items'][number];

const FORMAT_LABELS: Record<string, string> = {
  '1v1': '1v1',
  '2v2': '2v2',
  'ffa': 'FFA',
};

const FORMAT_BADGE_COLORS: Record<string, string> = {
  '1v1': 'bg-blue-900/30 text-blue-400 border-blue-700/40',
  '2v2': 'bg-purple-900/30 text-purple-400 border-purple-700/40',
  'ffa': 'bg-amber-900/30 text-amber-400 border-amber-700/40',
};

function RelativeDate({ date }: { date: Date | string | null }) {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return <>Today</>;
  if (diffDays === 1) return <>Yesterday</>;
  if (diffDays < 7) return <>{diffDays} days ago</>;
  return <>{d.toLocaleDateString()}</>;
}

function MatchHistoryItem({ match }: { match: MatchSummary }) {
  const playerNames = match.players.map((p) => p.displayName).join(' vs ');
  const winner = match.players.find((p) => p.isWinner);
  const isConcession = match.status === 'abandoned';

  return (
    <div className="lg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`lg-badge border text-xs font-medium ${FORMAT_BADGE_COLORS[match.format] ?? 'bg-zinc-800/50 text-zinc-300 border-zinc-700'}`}>
            {FORMAT_LABELS[match.format] ?? match.format}
          </span>
          {isConcession && (
            <span className="lg-badge bg-red-900/30 text-red-400 border-red-700/40 border text-xs">
              Concession
            </span>
          )}
          {winner && (
            <span className="lg-badge bg-green-900/30 text-green-400 border-green-700/40 border text-xs">
              {winner.displayName} won
            </span>
          )}
        </div>
        <span className="text-zinc-500 text-xs shrink-0">
          <RelativeDate date={match.endedAt ?? match.startedAt} />
        </span>
      </div>

      <div className="text-sm text-white">{playerNames}</div>

      {match.players.some((p) => p.finalScore !== null) && (
        <div className="flex gap-2 text-xs text-zinc-400">
          {match.players.map((p, i) => (
            <span key={i} className={p.isWinner ? 'text-green-400 font-medium' : ''}>
              {p.displayName}: {p.finalScore ?? 0}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MatchPage() {
  const { user } = useAuth();

  const { data: historyData, isLoading } = trpc.match.history.useQuery(
    { limit: 20 },
    { enabled: !!user },
  );

  const matches = historyData?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Match</h1>
      </div>

      {/* New match CTA */}
      <Link
        href="/match/new"
        className="lg-btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Match
      </Link>

      {/* Match history */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-white">Match History</h2>

        {!user ? (
          <div className="lg-card p-6 text-center space-y-2">
            <p className="lg-text-secondary">Sign in to see your match history</p>
            <Link href="/login" className="lg-btn-secondary text-sm inline-block">
              Sign in
            </Link>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="lg-card p-4 animate-pulse">
                <div className="h-4 bg-surface-elevated rounded w-3/4 mb-2" />
                <div className="h-3 bg-surface-elevated rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="lg-card p-6 text-center">
            <p className="lg-text-secondary">No matches yet</p>
            <p className="text-zinc-600 text-sm mt-1">Start a new match above to get playing</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <MatchHistoryItem key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
