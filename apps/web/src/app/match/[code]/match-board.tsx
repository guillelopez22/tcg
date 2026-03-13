'use client';

/**
 * MatchBoard — full-screen match gameplay view.
 *
 * Shows battlefield zones, score displays, ABCD phase tracker, and
 * turn controls. All state flows through useMatchSocket (Socket.IO).
 * Hides dashboard bottom nav for full-screen immersion.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMatchSocket } from '@/hooks/use-match-socket';
import { BattlefieldZone } from './battlefield-zone';
import { ScoreDisplay } from './score-display';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchBoardProps {
  code: string;
  playerId: string;
  role: 'player' | 'spectator';
}

const COLOR_MAP: Record<string, string> = {
  blue: 'blue',
  red: 'red',
  green: 'green',
  yellow: 'yellow',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MatchBoard({ code, playerId, role }: MatchBoardProps) {
  const router = useRouter();
  const {
    matchState,
    fullState,
    players,
    isReconnecting,
    matchEndedPayload,
    tapBattlefield,
    advancePhase,
    advanceTurn,
    pauseMatch,
    endMatch,
    undoAction,
  } = useMatchSocket(code);

  // Hide dashboard bottom nav while match board is active
  useEffect(() => {
    const nav = document.querySelector('.lg-mobile-nav') as HTMLElement | null;
    if (nav) {
      nav.style.display = 'none';
    }
    return () => {
      if (nav) {
        nav.style.display = '';
      }
    };
  }, []);

  // Derive player color map from players (live) or fullState.players (initial)
  const playerColorMap: Record<string, string> = {};
  if (players.length > 0) {
    for (const p of players) {
      playerColorMap[p.playerId] = COLOR_MAP[p.color] ?? 'blue';
    }
  } else if (fullState?.players) {
    for (const p of fullState.players) {
      playerColorMap[p.id] = COLOR_MAP[p.color] ?? 'blue';
    }
  }

  const isSpectator = role === 'spectator';

  function handleExit() {
    router.push('/match');
  }

  function handleTapBattlefield(bfIndex: number) {
    if (isSpectator || !matchState) return;
    tapBattlefield(bfIndex, playerId);
  }

  // Derived state
  const battlefields = matchState?.battlefields ?? [];
  const winTarget = matchState?.winTarget ?? fullState?.state?.winTarget ?? 8;
  const activePlayerId = matchState?.activePlayerId ?? '';
  const phase = matchState?.phase ?? 'A';
  const turnNumber = matchState?.turnNumber ?? 1;

  // Determine if paused — last log entry is "paused" and no subsequent "unpaused"
  const lastLog = matchState?.log?.[matchState.log.length - 1];
  const isPaused = lastLog?.event === 'paused';

  // Check if match ended
  const isMatchEnded = !!matchEndedPayload || fullState?.status === 'completed';

  // Split players: me at bottom, opponents at top
  const myPlayer = players.find((p) => p.playerId === playerId);
  const otherPlayers = players.filter((p) => p.playerId !== playerId);

  const phaseLabels: Record<string, string> = {
    A: 'Awaken',
    B: 'Beginning',
    C: 'Channel',
    D: 'Draw',
  };

  return (
    <div className="fixed inset-0 bg-surface flex flex-col overflow-hidden z-30">
      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="fixed top-0 inset-x-0 z-50 bg-yellow-900/80 border-b border-yellow-700/60 px-4 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-sm text-yellow-300 font-medium">Reconnecting...</span>
        </div>
      )}

      {/* Paused overlay */}
      {isPaused && !isMatchEnded && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="lg-card p-6 text-center space-y-3 mx-4">
            <p className="text-xl font-bold text-white">Match Paused</p>
            <p className="text-sm text-zinc-400">Waiting for players to resume</p>
            {!isSpectator && (
              <button onClick={pauseMatch} className="lg-btn-primary px-6 py-2.5">
                Resume
              </button>
            )}
          </div>
        </div>
      )}

      {/* Match ended overlay */}
      {isMatchEnded && matchEndedPayload && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="lg-card p-6 text-center space-y-4 mx-4 w-full max-w-sm">
            <p className="text-2xl font-bold text-white">
              {matchEndedPayload.isConcession
                ? `${matchEndedPayload.winnerName ?? 'Opponent'} wins by concession`
                : matchEndedPayload.winnerId
                ? `${matchEndedPayload.winnerName ?? 'Player'} Wins!`
                : 'Match Drawn'}
            </p>
            <div className="space-y-1">
              {matchEndedPayload.finalScores.map((s) => (
                <div key={s.playerId} className="flex justify-between gap-8 text-sm">
                  <span className="text-zinc-300">{s.displayName}</span>
                  <span className="text-white font-bold">{s.score}</span>
                </div>
              ))}
            </div>
            <button onClick={handleExit} className="lg-btn-secondary w-full">
              End Session
            </button>
          </div>
        </div>
      )}

      {/* ── Top bar: exit + opponent scores + match code ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border bg-surface-card/60 shrink-0">
        <button
          onClick={handleExit}
          className="text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded border border-surface-border shrink-0"
        >
          Exit
        </button>

        <div className="flex gap-2 flex-1 justify-center overflow-hidden">
          {otherPlayers.length > 0 ? (
            otherPlayers.map((p) => (
              <ScoreDisplay
                key={p.playerId}
                playerName={p.displayName}
                score={p.score}
                winTarget={winTarget}
                color={p.color}
                isCurrentTurn={p.playerId === activePlayerId}
              />
            ))
          ) : (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
              Waiting for opponent...
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] text-zinc-600 font-mono">{code}</p>
          <p className="text-[10px] text-zinc-600">T{turnNumber}</p>
        </div>
      </div>

      {/* ── ABCD Phase indicator ── */}
      <div className="flex items-center justify-center gap-1.5 py-2 bg-surface-card/40 border-b border-surface-border/50 shrink-0">
        {(['A', 'B', 'C', 'D'] as const).map((ph) => (
          <button
            key={ph}
            onClick={() => {
              if (!isSpectator && ph === phase) {
                advancePhase(playerId);
              }
            }}
            disabled={isSpectator || ph !== phase}
            title={phaseLabels[ph]}
            className={`
              w-8 h-8 rounded-full text-xs font-bold transition-all
              ${ph === phase
                ? 'bg-rift-600 text-white shadow-lg scale-110'
                : 'bg-surface-elevated text-zinc-500 opacity-40'
              }
              ${ph === phase && !isSpectator ? 'cursor-pointer hover:bg-rift-500 active:scale-100' : 'cursor-default'}
            `}
          >
            {ph}
          </button>
        ))}
        <span className="ml-1 text-xs text-zinc-500">{phaseLabels[phase]}</span>
        {turnNumber === 1 && phase === 'C' && (
          <span className="ml-1 text-[10px] bg-rift-900/50 text-rift-400 px-2 py-0.5 rounded border border-rift-700/40">
            Draw 3 runes
          </span>
        )}
      </div>

      {/* ── Battlefield zones (portrait: stacked, landscape: side-by-side) ── */}
      <div
        className="flex-1 flex p-3 gap-3 min-h-0"
        style={{
          flexDirection: 'column',
        }}
      >
        <style>{`
          @media (orientation: landscape) {
            .match-bf-grid { flex-direction: row !important; }
          }
        `}</style>
        <div className="match-bf-grid flex-1 flex flex-col gap-3 min-h-0">
          {battlefields.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
              <div className="lg-spinner-sm mr-2" />
              Loading battlefields...
            </div>
          ) : (
            battlefields.map((bf, i) => (
              <BattlefieldZone
                key={i}
                index={i}
                control={bf.control}
                playerColors={playerColorMap}
                cardArt={(bf as { cardArt?: string | null }).cardArt}
                cardName={(bf as { cardName?: string | null }).cardName}
                onTap={handleTapBattlefield}
                disabled={isSpectator}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Bottom bar: my score + turn controls ── */}
      <div className="border-t border-surface-border bg-surface-card/60 px-3 py-2 space-y-2 shrink-0">
        {/* My score */}
        {myPlayer && (
          <div className="flex justify-center">
            <ScoreDisplay
              playerName={`${myPlayer.displayName} (You)`}
              score={myPlayer.score}
              winTarget={winTarget}
              color={myPlayer.color}
              isCurrentTurn={myPlayer.playerId === activePlayerId}
            />
          </div>
        )}

        {/* Turn action buttons — only for non-spectators */}
        {!isSpectator && (
          <div className="flex items-center gap-2">
            {/* Undo */}
            <button
              onClick={undoAction}
              title="Undo last action"
              className="p-2 rounded-lg border border-surface-border text-zinc-400 hover:text-white hover:border-rift-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            {/* Advance Phase / End Turn */}
            {phase === 'D' ? (
              <button
                onClick={advanceTurn}
                className="flex-1 lg-btn-primary py-2 text-sm"
              >
                End Turn
              </button>
            ) : (
              <button
                onClick={() => advancePhase(playerId)}
                className="flex-1 lg-btn-secondary py-2 text-sm"
              >
                {phase} → {phase === 'A' ? 'B' : phase === 'B' ? 'C' : 'D'}
                <span className="ml-1 text-zinc-400">({phaseLabels[phase === 'A' ? 'B' : phase === 'B' ? 'C' : phase === 'C' ? 'D' : 'A']})</span>
              </button>
            )}

            {/* Pause */}
            <button
              onClick={pauseMatch}
              title="Pause match"
              className="p-2 rounded-lg border border-surface-border text-zinc-400 hover:text-white hover:border-yellow-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Concede */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.confirm('Are you sure? This will end the match as a concession.')) {
                  endMatch(null, 'concession');
                }
              }}
              title="Concede match"
              className="p-2 rounded-lg border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
          </div>
        )}

        {isSpectator && (
          <p className="text-center text-xs text-zinc-500">Spectating — read only</p>
        )}
      </div>
    </div>
  );
}
