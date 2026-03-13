'use client';

import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';
import type { MatchState } from '@la-grieta/shared';

type MatchDetail = inferRouterOutputs<AppRouter>['match']['getById'];

const FORMAT_LABELS: Record<string, string> = {
  '1v1': '1v1',
  '2v2': '2v2',
  ffa: 'FFA',
};

const FORMAT_BADGE_COLORS: Record<string, string> = {
  '1v1': 'bg-blue-900/30 text-blue-400 border-blue-700/40',
  '2v2': 'bg-green-900/30 text-green-400 border-green-700/40',
  ffa: 'bg-amber-900/30 text-amber-400 border-amber-700/40',
};

const PLAYER_COLOR_CLASSES: Record<string, string> = {
  blue: 'text-blue-400 border-blue-700/40 bg-blue-900/20',
  red: 'text-red-400 border-red-700/40 bg-red-900/20',
  green: 'text-green-400 border-green-700/40 bg-green-900/20',
  yellow: 'text-yellow-400 border-yellow-700/40 bg-yellow-900/20',
};

function formatDuration(startedAt: Date | string | null, endedAt: Date | string | null): string | null {
  if (!startedAt || !endedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return null;
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function computeScoringBreakdown(state: MatchState): Record<string, { conquest: number; holding: number }> {
  const breakdown: Record<string, { conquest: number; holding: number }> = {};

  // Initialize all players
  for (const player of state.players) {
    breakdown[player.playerId] = { conquest: 0, holding: 0 };
  }

  // Parse log events for scoring
  for (const entry of state.log) {
    const event = entry.event;

    // Conquest event: "conquest:{playerId}:{battlefieldIndex}"
    if (event.startsWith('conquest:')) {
      const parts = event.split(':');
      const playerId = parts[1];
      if (playerId && breakdown[playerId]) {
        breakdown[playerId].conquest += 1;
      }
    }

    // Holding event from phase scoring: "holding:{playerId}:{points}"
    if (event.startsWith('holding:')) {
      const parts = event.split(':');
      const playerId = parts[1];
      const pts = parts[2] ? parseInt(parts[2], 10) : 0;
      if (playerId && breakdown[playerId]) {
        breakdown[playerId].holding += isNaN(pts) ? 1 : pts;
      }
    }

    // Phase B scoring: "phase_score:{playerId}:{points}" or similar
    if (event.startsWith('phase_score:')) {
      const parts = event.split(':');
      const playerId = parts[1];
      const pts = parts[2] ? parseInt(parts[2], 10) : 0;
      if (playerId && breakdown[playerId]) {
        breakdown[playerId].holding += isNaN(pts) ? 1 : pts;
      }
    }
  }

  return breakdown;
}

type TurnGroup = {
  turn: number;
  entries: Array<{ phase: string; event: string; timestamp: number }>;
};

function groupLogByTurn(log: MatchState['log']): TurnGroup[] {
  const groups: TurnGroup[] = [];
  const turnMap = new Map<number, TurnGroup>();

  for (const entry of log) {
    if (!turnMap.has(entry.turn)) {
      const group: TurnGroup = { turn: entry.turn, entries: [] };
      turnMap.set(entry.turn, group);
      groups.push(group);
    }
    turnMap.get(entry.turn)!.entries.push({
      phase: entry.phase,
      event: entry.event,
      timestamp: entry.timestamp,
    });
  }

  return groups;
}

function formatEventLabel(event: string, playerMap: Map<string, string>): string {
  if (event.startsWith('conquest:')) {
    const parts = event.split(':');
    const playerId = parts[1] ?? '';
    const bfIdx = parts[2] ?? '?';
    const name = playerMap.get(playerId) ?? playerId;
    return `${name} conquered battlefield ${parseInt(bfIdx, 10) + 1}`;
  }
  if (event.startsWith('holding:') || event.startsWith('phase_score:')) {
    const parts = event.split(':');
    const playerId = parts[1] ?? '';
    const pts = parts[2] ?? '?';
    const name = playerMap.get(playerId) ?? playerId;
    return `${name} scored ${pts} holding point(s)`;
  }
  if (event === 'paused') return 'Match paused';
  if (event === 'resumed') return 'Match resumed';
  if (event.startsWith('concede:')) {
    const playerId = event.split(':')[1] ?? '';
    const name = playerMap.get(playerId) ?? playerId;
    return `${name} conceded`;
  }
  if (event.startsWith('win:')) {
    const playerId = event.split(':')[1] ?? '';
    const name = playerMap.get(playerId) ?? playerId;
    return `${name} wins`;
  }
  return event;
}

function MatchDetailContent({ match }: { match: MatchDetail }) {
  const router = useRouter();
  const state = match.state as unknown as MatchState | null;
  const duration = formatDuration(match.startedAt, match.endedAt);

  const playerMap = new Map<string, string>(
    match.players.map((p) => [p.id, p.displayName]),
  );

  const scoringBreakdown = state ? computeScoringBreakdown(state) : {};
  const turnGroups = state ? groupLogByTurn(state.log) : [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/match')}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Match History
      </button>

      {/* Header */}
      <div className="lg-card p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`lg-badge border text-xs font-medium ${FORMAT_BADGE_COLORS[match.format] ?? 'bg-zinc-800/50 text-zinc-300 border-zinc-700'}`}
          >
            {FORMAT_LABELS[match.format] ?? match.format}
          </span>
          {match.status === 'abandoned' && (
            <span className="lg-badge bg-red-900/30 text-red-400 border-red-700/40 border text-xs">Concession</span>
          )}
          {match.status === 'completed' && (
            <span className="lg-badge bg-green-900/30 text-green-400 border-green-700/40 border text-xs">Completed</span>
          )}
        </div>
        <div className="text-zinc-400 text-sm space-y-0.5">
          <div>{formatDate(match.endedAt ?? match.startedAt)}</div>
          {duration && <div>Duration: {duration}</div>}
        </div>
      </div>

      {/* Players */}
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-white">Players</h2>
        <div className="space-y-2">
          {match.players
            .filter((p) => p.role === 'player')
            .map((player) => {
              const colorClass = PLAYER_COLOR_CLASSES[player.color] ?? 'text-zinc-400 border-zinc-700 bg-zinc-800/30';
              const statePlayer = state?.players.find((sp) => sp.playerId === player.id);
              const finalScore = player.finalScore ?? statePlayer?.score ?? 0;

              return (
                <div
                  key={player.id}
                  className={`lg-card p-3 flex items-center justify-between border ${colorClass}`}
                >
                  <div className="flex items-center gap-2">
                    {player.isWinner && (
                      <svg
                        className="w-4 h-4 text-green-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-label="Winner"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="text-white font-medium text-sm">{player.displayName}</span>
                    <span className="text-xs opacity-70 capitalize">{player.color}</span>
                  </div>
                  <span className="text-lg font-bold">{finalScore}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Scoring breakdown */}
      {Object.keys(scoringBreakdown).length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Scoring Breakdown</h2>
          <div className="lg-card p-4">
            <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 font-medium pb-2 border-b border-zinc-800">
              <span>Player</span>
              <span className="text-center">Conquest</span>
              <span className="text-center">Holding</span>
            </div>
            {Object.entries(scoringBreakdown).map(([playerId, breakdown]) => {
              const name = playerMap.get(playerId) ?? playerId.slice(0, 8);
              return (
                <div key={playerId} className="grid grid-cols-3 gap-2 text-sm py-2 border-b border-zinc-800/50 last:border-0">
                  <span className="text-white truncate">{name}</span>
                  <span className="text-center text-blue-400">{breakdown.conquest}</span>
                  <span className="text-center text-green-400">{breakdown.holding}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Battlefields */}
      {state && state.battlefields.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Battlefields</h2>
          <div className="grid grid-cols-2 gap-2">
            {state.battlefields.map((bf, i) => {
              const controller =
                bf.control === 'uncontrolled'
                  ? 'Uncontrolled'
                  : bf.control === 'contested'
                    ? 'Contested'
                    : (playerMap.get(bf.control) ?? bf.control.slice(0, 8));
              return (
                <div key={i} className="lg-card p-3 text-center space-y-1">
                  <div className="text-xs text-zinc-500">Battlefield {i + 1}</div>
                  {bf.cardId ? (
                    <div className="text-xs text-zinc-400 font-mono truncate">{bf.cardId.slice(0, 8)}...</div>
                  ) : (
                    <div className="text-xs text-zinc-600">No card</div>
                  )}
                  <div className="text-xs font-medium text-white">{controller}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Turn log */}
      {turnGroups.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Turn Log</h2>
          <div className="space-y-2">
            {turnGroups.map((group) => (
              <div key={group.turn} className="lg-card p-3 space-y-1">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Turn {group.turn}</div>
                <div className="space-y-1">
                  {group.entries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-zinc-600 text-xs w-4 mt-0.5 font-mono">{entry.phase}</span>
                      <span className="text-zinc-300">{formatEventLabel(entry.event, playerMap)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!state && (
        <div className="lg-card p-4 text-center">
          <p className="text-zinc-500 text-sm">Match state not available</p>
        </div>
      )}
    </div>
  );
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: match, isLoading, error } = trpc.match.getById.useQuery(
    { id },
    { enabled: !!id },
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="lg-card p-4 animate-pulse">
          <div className="h-5 bg-surface-elevated rounded w-1/3 mb-2" />
          <div className="h-4 bg-surface-elevated rounded w-1/2" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="lg-card p-4 animate-pulse">
            <div className="h-4 bg-surface-elevated rounded w-full mb-2" />
            <div className="h-3 bg-surface-elevated rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="lg-card p-6 text-center">
        <p className="text-red-400 text-sm">Match not found</p>
      </div>
    );
  }

  if (!match) return null;

  return <MatchDetailContent match={match} />;
}
