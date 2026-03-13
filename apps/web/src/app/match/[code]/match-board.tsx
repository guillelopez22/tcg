'use client';

/**
 * MatchBoard — full-screen match gameplay view.
 *
 * Integrates: battlefield zones, per-player zone rows, vertical score trackers,
 * ABCD phase tracker, turn controls, undo, pause, concession, turn log, win overlay.
 * Layout mirrors the physical Riftbound play mat:
 *   - Opponent zones (top, mirrored)
 *   - Shared battlefield center flanked by vertical 0-8 score trackers
 *   - My zones (bottom)
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMatchSocket } from '@/hooks/use-match-socket';
import { BattlefieldZone } from './battlefield-zone';
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

// Color classes for player colors
const PLAYER_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  blue: {
    bg: 'bg-blue-500',
    border: 'border-blue-500',
    text: 'text-blue-400',
  },
  red: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    text: 'text-red-400',
  },
  green: {
    bg: 'bg-green-500',
    border: 'border-green-500',
    text: 'text-green-400',
  },
  yellow: {
    bg: 'bg-yellow-400',
    border: 'border-yellow-400',
    text: 'text-yellow-400',
  },
};

// ---------------------------------------------------------------------------
// VerticalScoreTracker — 0-8 circles stacked vertically
// ---------------------------------------------------------------------------

function VerticalScoreTracker({
  score,
  winTarget,
  color,
  side,
}: {
  score: number;
  winTarget: number;
  color: string;
  side: 'left' | 'right';
}) {
  const colorClasses = PLAYER_COLOR_CLASSES[color] ?? PLAYER_COLOR_CLASSES.blue!;
  const max = Math.max(winTarget, 8);
  const points = Array.from({ length: max + 1 }, (_, i) => i); // 0..winTarget

  return (
    <div
      className={`flex flex-col items-center gap-[3px] py-1 px-1 ${
        side === 'left' ? 'items-start' : 'items-end'
      }`}
    >
      {/* Render from high to low so 0 is at bottom */}
      {[...points].reverse().map((point) => {
        const isCurrent = point === score;
        const isFilled = point <= score;
        return (
          <div
            key={point}
            className={`
              w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all
              border
              ${isCurrent
                ? `${colorClasses.bg} border-transparent text-white scale-110 shadow-sm`
                : isFilled
                ? `${colorClasses.bg} border-transparent text-white opacity-60`
                : 'bg-[#0a1628] border-[#c5a84a]/30 text-[#c5a84a]/40'
              }
            `}
          >
            {point}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoneSlot — a single zone card-shaped slot on the play mat
// ---------------------------------------------------------------------------

function ZoneSlot({ label }: { label: string }) {
  return (
    <div
      className="
        w-[52px] h-[72px] rounded
        bg-[#0a1628] border border-[#c5a84a]/30
        flex items-end justify-center pb-1
        flex-shrink-0
      "
    >
      <span className="text-[8px] font-medium text-[#c5a84a]/60 text-center leading-tight px-0.5">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlayerZoneRows — renders Base row + Runes row for one player
// isOpponent=true mirrors the layout (opponent side is upside-down relative to yours)
// ---------------------------------------------------------------------------

function PlayerZoneRows({
  playerName,
  color,
  isOpponent,
  isCurrentTurn,
}: {
  playerName: string;
  color: string;
  isOpponent: boolean;
  isCurrentTurn: boolean;
}) {
  const colorClasses = PLAYER_COLOR_CLASSES[color] ?? PLAYER_COLOR_CLASSES.blue!;

  // Base row: Champion | Legend | (empty space) | Main Deck
  // Runes row: Runes Deck | (empty space) | Trash
  // Opponent mirrors: Main Deck | (empty) | Legend | Champion (base)
  //                    Trash | (empty) | Runes Deck (runes)

  const baseRow = isOpponent
    ? (
      <div className="flex items-center gap-1.5 px-2">
        <ZoneSlot label="Main Deck" />
        <div className="flex-1" />
        <ZoneSlot label="Legend" />
        <ZoneSlot label="Champion" />
      </div>
    )
    : (
      <div className="flex items-center gap-1.5 px-2">
        <ZoneSlot label="Champion" />
        <ZoneSlot label="Legend" />
        <div className="flex-1" />
        <ZoneSlot label="Main Deck" />
      </div>
    );

  const runesRow = isOpponent
    ? (
      <div className="flex items-center gap-1.5 px-2">
        <ZoneSlot label="Trash" />
        <div className="flex-1" />
        <ZoneSlot label="Runes Deck" />
      </div>
    )
    : (
      <div className="flex items-center gap-1.5 px-2">
        <ZoneSlot label="Runes Deck" />
        <div className="flex-1" />
        <ZoneSlot label="Trash" />
      </div>
    );

  const nameBar = (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 ${isOpponent ? '' : ''}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${isCurrentTurn ? colorClasses.bg : 'bg-zinc-700'} flex-shrink-0`} />
      <span className={`text-[10px] font-medium ${isCurrentTurn ? colorClasses.text : 'text-zinc-500'} truncate`}>
        {playerName}
        {isCurrentTurn && <span className="ml-1 opacity-60">(active)</span>}
      </span>
    </div>
  );

  if (isOpponent) {
    // Opponent: runes on top (far from center), base closer to center
    return (
      <div className="space-y-1 py-1">
        {nameBar}
        {runesRow}
        {baseRow}
      </div>
    );
  }

  // My side: base closer to center, runes at bottom
  return (
    <div className="space-y-1 py-1">
      {baseRow}
      {runesRow}
      {nameBar}
    </div>
  );
}

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

  // Player layout: my data at bottom, opponent at top
  const myPlayer = players.find((p) => p.playerId === playerId);
  const otherPlayers = players.filter((p) => p.playerId !== playerId);

  // Score data
  const myScore = matchState?.players.find((p) => p.playerId === playerId)?.score ?? 0;
  const opponentScores = otherPlayers.map((op) => ({
    player: op,
    score: matchState?.players.find((p) => p.playerId === op.playerId)?.score ?? 0,
  }));

  // Primary opponent for single-score tracker display
  const primaryOpponent = otherPlayers[0];
  const primaryOpponentScore = opponentScores[0]?.score ?? 0;

  const phaseLabels: Record<string, string> = {
    A: 'Awaken', B: 'Beginning', C: 'Channel', D: 'Draw',
  };

  return (
    <div className="fixed inset-0 bg-[#0a1628] flex flex-col overflow-hidden z-30">
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

      {/* ── Top bar: exit + match code + turn + ABCD phase ── */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#c5a84a]/20 bg-[#0a1628]/80 shrink-0">
        <button
          onClick={handleExit}
          className="text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded border border-[#c5a84a]/20 shrink-0"
        >
          Exit
        </button>

        {/* ABCD phase — compact inline circles */}
        <div className="flex items-center gap-1 flex-1 justify-center">
          {(['A', 'B', 'C', 'D'] as const).map((ph) => (
            <button
              key={ph}
              disabled
              title={phaseLabels[ph]}
              className={`
                w-6 h-6 rounded-full text-[10px] font-bold transition-all cursor-default
                ${ph === phase
                  ? 'bg-rift-600 text-white shadow-sm scale-110'
                  : 'bg-[#0a1628] border border-[#c5a84a]/20 text-zinc-600'
                }
              `}
            >
              {ph}
            </button>
          ))}
          <span className="ml-1 text-[10px] text-zinc-500">{phaseLabels[phase]}</span>
          {turnNumber === 1 && phase === 'C' && (
            <span className="ml-1 text-[9px] bg-rift-900/50 text-rift-400 px-1.5 py-0.5 rounded border border-rift-700/40">
              +3 runes
            </span>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-[9px] text-zinc-600 font-mono">{code}</p>
          <p className="text-[9px] text-zinc-600">T{turnNumber}</p>
        </div>
      </div>

      {/* ── Opponent zones (top of screen) ── */}
      <div className="shrink-0 border-b border-[#c5a84a]/10 bg-[#060e1a]/60">
        {otherPlayers.length > 0 ? (
          otherPlayers.map((op) => (
            <PlayerZoneRows
              key={op.playerId}
              playerName={op.displayName}
              color={playerColorMap[op.playerId] ?? 'blue'}
              isOpponent={true}
              isCurrentTurn={op.playerId === activePlayerId}
            />
          ))
        ) : (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-zinc-500">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
            Waiting for opponent...
          </div>
        )}
      </div>

      {/* ── Center: Score trackers + Battlefield zones ── */}
      <div className="flex items-stretch min-h-0 flex-1">
        {/* Left score tracker (opponent) */}
        <div className="flex items-center justify-center px-1 bg-[#060e1a]/40 border-r border-[#c5a84a]/10">
          {primaryOpponent ? (
            <VerticalScoreTracker
              score={primaryOpponentScore}
              winTarget={winTarget}
              color={playerColorMap[primaryOpponent.playerId] ?? 'blue'}
              side="left"
            />
          ) : (
            <div className="w-7" />
          )}
        </div>

        {/* Battlefield zones */}
        <div className="flex-1 p-2 min-w-0">
          <style>{`
            .match-bf-grid { display: flex; flex-direction: column; height: 100%; gap: 8px; }
            @media (orientation: landscape) {
              .match-bf-grid { flex-direction: row; }
            }
          `}</style>
          <div className="match-bf-grid player-base-row">
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

        {/* Right score tracker (me) */}
        <div className="flex items-center justify-center px-1 bg-[#060e1a]/40 border-l border-[#c5a84a]/10">
          {myPlayer ? (
            <VerticalScoreTracker
              score={myScore}
              winTarget={winTarget}
              color={playerColorMap[myPlayer.playerId] ?? 'blue'}
              side="right"
            />
          ) : (
            <div className="w-7" />
          )}
        </div>
      </div>

      {/* ── My zones (bottom half) ── */}
      <div className="shrink-0 border-t border-[#c5a84a]/10 bg-[#060e1a]/60">
        {myPlayer ? (
          <PlayerZoneRows
            playerName={`${myPlayer.displayName} (You)`}
            color={playerColorMap[myPlayer.playerId] ?? 'blue'}
            isOpponent={false}
            isCurrentTurn={myPlayer.playerId === activePlayerId}
          />
        ) : (
          <div className="flex items-center justify-center py-3 text-xs text-zinc-500">
            Joining match...
          </div>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div className="border-t border-[#c5a84a]/20 bg-[#060e1a]/80 shrink-0">
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
