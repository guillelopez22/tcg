'use client';

/**
 * MatchBoard — full-screen match gameplay view.
 *
 * Integrates: battlefield zones, score displays, ABCD phase tracker,
 * turn controls, undo, pause, concession, turn log, win overlay.
 * All state flows through useMatchSocket (Socket.IO).
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMatchSocket } from '@/hooks/use-match-socket';
import { BattlefieldZone } from './battlefield-zone';
import { ScoreDisplay } from './score-display';
import { TurnControls } from './turn-controls';
import { TurnLog } from './turn-log';
import { MatchEndOverlay } from './match-end-overlay';

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

  // Track which battlefields should show +1 flash (when Beginning phase scores)
  const [flashingBattlefields, setFlashingBattlefields] = useState<Set<number>>(new Set());
  const prevPhaseRef = useRef<string | null>(null);
  const prevScoresRef = useRef<Record<string, number>>({});

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

  // Detect phase transition to 'B' → flash controlled battlefields with +1
  useEffect(() => {
    if (!matchState) return;
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = matchState.phase;

    if (matchState.phase === 'B' && prevPhase === 'A') {
      // Find all battlefields controlled by a player (not uncontrolled/contested)
      const controlled = matchState.battlefields
        .map((bf, i) => ({ index: i, control: bf.control }))
        .filter((bf) => bf.control !== 'uncontrolled' && bf.control !== 'contested')
        .map((bf) => bf.index);

      if (controlled.length > 0) {
        setFlashingBattlefields(new Set(controlled));
        setTimeout(() => setFlashingBattlefields(new Set()), 1200);
      }
    }
  }, [matchState]);

  // Detect 8th point rule block — score did NOT increase despite conquest attempt
  useEffect(() => {
    if (!matchState) return;
    const currentScores: Record<string, number> = {};
    for (const p of matchState.players) {
      currentScores[p.playerId] = p.score;
    }

    // Check last log entry for 8th point rule violation
    const lastLog = matchState.log[matchState.log.length - 1];
    if (lastLog?.event?.includes('8th point rule')) {
      toast.warning('Cannot win without holding a battlefield!', {
        description: '8th point rule: final point must come from holding a battlefield',
      });
    }

    prevScoresRef.current = currentScores;
  }, [matchState]);

  // Derive player color map
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
  const turnHistory = matchState?.log ?? [];

  // Pause detection: last log entry is 'paused' (no explicit isPaused field in MatchState)
  const lastLog = turnHistory[turnHistory.length - 1];
  const isPaused = lastLog?.event === 'paused';

  // Match ended
  const isMatchEnded = !!matchEndedPayload || fullState?.status === 'completed';

  // Player layout: my score at bottom, opponent at top
  const myPlayer = players.find((p) => p.playerId === playerId);
  const otherPlayers = players.filter((p) => p.playerId !== playerId);

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

      {/* Match end overlay */}
      {isMatchEnded && matchEndedPayload && (
        <MatchEndOverlay
          winnerId={matchEndedPayload.winnerId}
          winnerName={matchEndedPayload.winnerName}
          isConcession={matchEndedPayload.isConcession}
          finalScores={matchEndedPayload.finalScores}
        />
      )}

      {/* ── Top bar: exit + opponent scores ── */}
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
        {(['A', 'B', 'C', 'D'] as const).map((ph) => {
          const phaseLabels: Record<string, string> = {
            A: 'Awaken', B: 'Beginning', C: 'Channel', D: 'Draw',
          };
          return (
            <button
              key={ph}
              disabled
              title={phaseLabels[ph]}
              className={`
                w-8 h-8 rounded-full text-xs font-bold transition-all cursor-default
                ${ph === phase
                  ? 'bg-rift-600 text-white shadow-lg scale-110'
                  : 'bg-surface-elevated text-zinc-500 opacity-40'
                }
              `}
            >
              {ph}
            </button>
          );
        })}
        <span className="ml-1 text-xs text-zinc-500">
          {phase === 'A' ? 'Awaken' : phase === 'B' ? 'Beginning' : phase === 'C' ? 'Channel' : 'Draw'}
        </span>
        {turnNumber === 1 && phase === 'C' && (
          <span className="ml-1 text-[10px] bg-rift-900/50 text-rift-400 px-2 py-0.5 rounded border border-rift-700/40">
            Draw 3 runes
          </span>
        )}
      </div>

      {/* ── Battlefield zones ── */}
      <div className="flex-1 p-3 min-h-0">
        <style>{`
          .match-bf-grid { display: flex; flex-direction: column; height: 100%; gap: 12px; }
          @media (orientation: landscape) {
            .match-bf-grid { flex-direction: row; }
          }
        `}</style>
        <div className="match-bf-grid">
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
                showScoreFlash={flashingBattlefields.has(i)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Bottom bar: my score + controls + turn log ── */}
      <div className="border-t border-surface-border bg-surface-card/60 shrink-0">
        {/* My score */}
        {myPlayer && (
          <div className="flex justify-center px-3 pt-2">
            <ScoreDisplay
              playerName={`${myPlayer.displayName} (You)`}
              score={myPlayer.score}
              winTarget={winTarget}
              color={myPlayer.color}
              isCurrentTurn={myPlayer.playerId === activePlayerId}
            />
          </div>
        )}

        {/* Turn controls (only for players, not spectators) */}
        {!isSpectator && (
          <div className="px-3 py-2">
            <TurnControls
              phase={phase}
              activePlayerId={activePlayerId}
              myPlayerId={playerId}
              turnNumber={turnNumber}
              onAdvancePhase={() => advancePhase(playerId)}
              onAdvanceTurn={advanceTurn}
              onPause={pauseMatch}
              onEndMatch={endMatch}
              onUndo={undoAction}
            />
          </div>
        )}

        {isSpectator && (
          <p className="text-center text-xs text-zinc-500 py-2">Spectating — read only</p>
        )}

        {/* Turn log (collapsible) */}
        <TurnLog turnHistory={turnHistory} />
      </div>
    </div>
  );
}
