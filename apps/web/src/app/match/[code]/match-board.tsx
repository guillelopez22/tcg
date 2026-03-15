'use client';

/**
 * MatchBoard — full-screen match gameplay view.
 *
 * Layout (top → bottom):
 *   1. Top bar — exit, ABCD phase, turn/code
 *   2. Opponent board — legend, champion, base, runes (local mode)
 *   3. Battlefield center — score trackers + BF cards with unit deployment slots
 *   4. My base zone — Legend, Champion, deployed units (large, droppable)
 *   5. Channeled runes row
 *   6. Hand area (draggable cards) + Trash drop zone
 *   7. Controls bar — TurnControls + TurnLog
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMatchSocket } from '@/hooks/use-match-socket';
import { useLocalGameState } from '@/hooks/use-local-game-state';
import type { LocalDeckEntry, GameCardInfo } from '@/hooks/use-local-game-state';
import { BattlefieldZone, type BattlefieldAction } from './battlefield-zone';
import { TurnControls } from './turn-controls';
import { TurnLog } from './turn-log';
import { MatchEndOverlay } from './match-end-overlay';
import { HandDisplay } from './hand-display';
import { MulliganModal } from './mulligan-modal';
import { DragDropProvider, DropZone, type ZoneId } from './drag-drop-context';
import { VerticalScoreTracker } from './board-components/score-display';
import { ExhaustableCard, ZoneSlot, UnitZone, CARD } from './board-components/exhaustable-card';
import { OpponentBoard } from './board-components/opponent-board';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchBoardProps {
  code: string;
  playerId: string;
  role: 'player' | 'spectator';
  localDecks?: LocalDeckEntry[][];
}

const COLOR_MAP: Record<string, string> = {
  blue: 'blue', red: 'red', green: 'green', yellow: 'yellow',
};

const PLAYER_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400' },
  red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400' },
  green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400' },
  yellow: { bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400' },
};

// ---------------------------------------------------------------------------
// MatchBoard
// ---------------------------------------------------------------------------

export function MatchBoard({ code, playerId, role, localDecks }: MatchBoardProps) {
  const router = useRouter();
  const {
    matchState, fullState, players, isReconnecting, matchEndedPayload,
    tapBattlefield, advancePhase, advanceTurn, pauseMatch, endMatch, undoAction,
  } = useMatchSocket(code);

  const localGame = useLocalGameState(
    localDecks,
    matchState?.activePlayerId,
    players.map((p) => p.playerId),
  );

  const [flashingBattlefields, setFlashingBattlefields] = useState<Set<number>>(new Set());
  const [bfActions, setBfActions] = useState<Record<number, BattlefieldAction>>({});
  const prevPhaseRef = useRef<string | null>(null);

  const localGameRef = useRef(localGame);
  localGameRef.current = localGame;

  // Drag-drop handler
  const handleDrop = useCallback((card: GameCardInfo, source: ZoneId, target: ZoneId) => {
    const lg = localGameRef.current;
    const pi = lg.activePlayerIndex;

    if (source === 'hand' && target === 'base') {
      lg.playToBase(pi, card.uid);
    } else if (source === 'hand' && target === 'trash') {
      lg.discardToTrash(pi, card.uid);
    } else if (source === 'base' && target === 'hand') {
      lg.returnFromBase(pi, card.uid);
    } else if (source === 'base' && target === 'trash') {
      lg.discardFromBase(pi, card.uid);
    }
  }, []);

  // Battlefield tap with proper game logic
  const handleBattlefieldTap = useCallback((bfIndex: number, action: BattlefieldAction) => {
    if (!matchState) return;

    setBfActions((prev) => ({ ...prev, [bfIndex]: action }));
    setTimeout(() => {
      setBfActions((prev) => {
        const next = { ...prev };
        delete next[bfIndex];
        return next;
      });
    }, 1200);

    if (action === 'conquer') {
      toast.success(`Battlefield ${bfIndex + 1} conquered!`, { duration: 2000 });
    } else if (action === 'showdown') {
      toast('Showdown triggered!', {
        description: 'Resolve combat — winner takes the battlefield',
        duration: 3000,
      });
    }

    tapBattlefield(bfIndex, playerId);
  }, [matchState, tapBattlefield, playerId]);

  // Hide dashboard bottom nav
  useEffect(() => {
    const nav = document.querySelector('.lg-mobile-nav') as HTMLElement | null;
    if (nav) nav.style.display = 'none';
    return () => { if (nav) nav.style.display = ''; };
  }, []);

  // Phase-triggered auto-actions
  useEffect(() => {
    if (!matchState) return;
    const prevPhase = prevPhaseRef.current;
    const currentPhase = matchState.phase;
    const currentTurn = matchState.turnNumber;
    if (prevPhase === currentPhase) return;
    prevPhaseRef.current = currentPhase;

    if (currentPhase === 'A') {
      localGame.readyAll(localGame.activePlayerIndex);
    } else if (currentPhase === 'C') {
      localGame.channelRunes(localGame.activePlayerIndex, currentTurn === 1 ? 3 : 2);
    } else if (currentPhase === 'D') {
      localGame.drawCard(localGame.activePlayerIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState?.phase, matchState?.turnNumber]);

  // Flash controlled battlefields on B phase
  useEffect(() => {
    if (!matchState) return;
    if (matchState.phase === 'B' && prevPhaseRef.current === 'A') {
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

  // 8th point rule toast
  useEffect(() => {
    if (!matchState) return;
    const lastLog = matchState.log[matchState.log.length - 1];
    if (lastLog?.event?.includes('8th point rule')) {
      toast.warning('Cannot win without holding a battlefield!', {
        description: '8th point rule: final point must come from holding a battlefield',
      });
    }
  }, [matchState]);

  // Derive player colors
  const playerColorMap: Record<string, string> = {};
  if (players.length > 0) {
    for (const p of players) playerColorMap[p.playerId] = COLOR_MAP[p.color] ?? 'blue';
  } else if (fullState?.players) {
    for (const p of fullState.players) playerColorMap[p.id] = COLOR_MAP[p.color] ?? 'blue';
  }

  const isSpectator = role === 'spectator';
  const battlefields = matchState?.battlefields ?? [];
  const winTarget = matchState?.winTarget ?? fullState?.state?.winTarget ?? 8;
  const activePlayerId = matchState?.activePlayerId ?? '';
  const phase = matchState?.phase ?? 'A';
  const turnNumber = matchState?.turnNumber ?? 1;
  const turnHistory = matchState?.log ?? [];
  const lastLog = turnHistory[turnHistory.length - 1];
  const isPaused = lastLog?.event === 'paused';
  const isMatchEnded = !!matchEndedPayload || fullState?.status === 'completed';

  const myPlayer = players.find((p) => p.playerId === playerId);
  const otherPlayers = players.filter((p) => p.playerId !== playerId);
  const myScore = matchState?.players.find((p) => p.playerId === playerId)?.score ?? 0;
  const primaryOpponent = otherPlayers[0];
  const primaryOpponentScore = matchState?.players.find((p) => p.playerId === primaryOpponent?.playerId)?.score ?? 0;

  const phaseLabels: Record<string, string> = { A: 'Awaken', B: 'Beginning', C: 'Channel', D: 'Draw' };
  const hasLocalDecks = !!localDecks;

  const mulliganPlayerName = localGame.mulliganPhase !== null
    ? (players[localGame.mulliganPhase]?.displayName ?? `Player ${localGame.mulliganPhase + 1}`)
    : null;
  const mulliganHand = localGame.mulliganPhase !== null && localGame.gameState
    ? (localGame.gameState[localGame.mulliganPhase]?.hand ?? [])
    : [];

  const opponentIndex = localGame.activePlayerIndex === 0 ? 1 : 0;

  return (
    <DragDropProvider onDrop={handleDrop}>
      <div className="fixed inset-0 bg-[#0a1628] flex flex-col overflow-hidden z-[100]">

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
                <button onClick={pauseMatch} className="lg-btn-primary px-6 py-2.5">Resume</button>
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

        {/* Mulligan overlay */}
        {localGame.mulliganPhase !== null && localGame.gameState && (
          <MulliganModal
            playerName={mulliganPlayerName ?? 'Player'}
            hand={mulliganHand}
            maxReturns={2}
            onConfirm={localGame.mulligan}
            onSkip={localGame.skipMulligan}
          />
        )}

        {/* ── 1. Top bar ── */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#c5a84a]/20 bg-[#0a1628]/80 shrink-0">
          <button
            onClick={() => router.push('/match')}
            className="text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded border border-[#c5a84a]/20 shrink-0"
          >
            Exit
          </button>
          <div className="flex items-center gap-1 flex-1 justify-center">
            {(['A', 'B', 'C', 'D'] as const).map((ph) => (
              <div
                key={ph}
                title={phaseLabels[ph]}
                className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all
                  ${ph === phase ? 'bg-rift-600 text-white shadow-sm scale-110' : 'bg-[#0a1628] border border-[#c5a84a]/20 text-zinc-600'}`}
              >
                {ph}
              </div>
            ))}
            <span className="ml-1 text-[10px] text-zinc-500">{phaseLabels[phase]}</span>
            {turnNumber === 1 && phase === 'C' && (
              <span className="ml-1 text-[9px] bg-rift-900/50 text-rift-400 px-1.5 py-0.5 rounded border border-rift-700/40">+3 runes</span>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-zinc-600 font-mono">{code}</p>
            <p className="text-[9px] text-zinc-600">T{turnNumber}</p>
          </div>
        </div>

        {/* ── 2. Opponent board ── */}
        {hasLocalDecks ? (
          <OpponentBoard
            name={primaryOpponent?.displayName ?? `Player ${opponentIndex + 1}`}
            isActive={primaryOpponent?.playerId === activePlayerId}
            color={playerColorMap[primaryOpponent?.playerId ?? ''] ?? 'blue'}
            legend={localGame.opponentLegend}
            champion={localGame.opponentChampion}
            base={localGame.opponentBase}
            channeledRunes={localGame.opponentChanneledRunes}
            exhaustedUids={localGame.opponentExhaustedUids}
            deckCount={localGame.opponentDeckCount}
            handCount={localGame.opponentHandCount}
            runeDeckCount={localGame.opponentRuneDeckCount}
            trashCount={localGame.opponentTrash.length}
            onToggleExhaust={(uid) => localGame.toggleCardExhaust(opponentIndex, uid)}
          />
        ) : (
          <div className="shrink-0 border-b border-[#c5a84a]/10 bg-[#060e1a]/60 px-2 py-1.5">
            {otherPlayers.length > 0 ? (
              otherPlayers.map((op) => {
                const opColor = playerColorMap[op.playerId] ?? 'blue';
                const opColorClasses = PLAYER_COLOR_CLASSES[opColor] ?? PLAYER_COLOR_CLASSES.blue!;
                const isActive = op.playerId === activePlayerId;
                return (
                  <div key={op.playerId} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? opColorClasses.bg : 'bg-zinc-700'}`} />
                    <span className={`text-[11px] font-medium truncate ${isActive ? opColorClasses.text : 'text-zinc-500'}`}>
                      {op.displayName}
                      {isActive && <span className="ml-1 opacity-60 text-[10px]">(active)</span>}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                Waiting for opponent...
              </div>
            )}
          </div>
        )}

        {/* ── 3. Battlefield center — unit zones + BF cards ── */}
        <div className="flex items-stretch shrink-0" style={{ height: '180px' }}>
          {/* Left score tracker */}
          <div className="flex items-center justify-center px-1 bg-[#060e1a]/40 border-r border-[#c5a84a]/10">
            {primaryOpponent ? (
              <VerticalScoreTracker score={primaryOpponentScore} winTarget={winTarget} color={playerColorMap[primaryOpponent.playerId] ?? 'blue'} side="left" />
            ) : <div className="w-7" />}
          </div>

          {/* Opponent unit zone (left) */}
          <UnitZone side="opponent" label={`${primaryOpponent?.displayName ?? 'Opponent'} Units`} />

          {/* Battlefields (center) */}
          <div className="flex items-center justify-center gap-2 px-2 py-1">
            {battlefields.length === 0 ? (
              <div className="flex items-center justify-center text-zinc-500 text-xs">
                <div className="lg-spinner-sm mr-2" />Loading...
              </div>
            ) : (
              battlefields.map((bf, i) => (
                <div key={i} style={{ width: '100px', height: '140px' }} className="flex-shrink-0">
                  <BattlefieldZone
                    index={i}
                    control={bf.control}
                    playerColors={playerColorMap}
                    myPlayerId={playerId}
                    cardArt={(bf as { cardArt?: string | null }).cardArt}
                    cardName={(bf as { cardName?: string | null }).cardName}
                    onTap={handleBattlefieldTap}
                    disabled={isSpectator}
                    showScoreFlash={flashingBattlefields.has(i)}
                    lastAction={bfActions[i] ?? null}
                  />
                </div>
              ))
            )}
          </div>

          {/* My unit zone (right) */}
          <UnitZone side="mine" label="My Units" />

          {/* Right score tracker */}
          <div className="flex items-center justify-center px-1 bg-[#060e1a]/40 border-l border-[#c5a84a]/10">
            {myPlayer ? (
              <VerticalScoreTracker score={myScore} winTarget={winTarget} color={playerColorMap[myPlayer.playerId] ?? 'blue'} side="right" />
            ) : <div className="w-7" />}
          </div>
        </div>

        {/* ── 4. My base zone (large, droppable) ── */}
        <DropZone
          zone="base"
          accepts={['hand']}
          dropLabel="Play to Base"
          highlightClass="ring-2 ring-rift-400/60"
          className="flex-1 min-h-0 border-t border-[#c5a84a]/10 bg-[#060e1a]/60 px-2 py-2 overflow-y-auto"
        >
          {myPlayer && (
            <div className="flex items-center gap-1 mb-1.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                myPlayer.playerId === activePlayerId
                  ? (PLAYER_COLOR_CLASSES[playerColorMap[myPlayer.playerId] ?? 'blue'] ?? PLAYER_COLOR_CLASSES.blue!).bg
                  : 'bg-zinc-700'
              }`} />
              <span className="text-[11px] text-zinc-400 font-medium truncate">
                {myPlayer.displayName} — Base
                {myPlayer.playerId === activePlayerId && <span className="ml-1 opacity-60 text-[10px]">(active)</span>}
              </span>
            </div>
          )}
          <div className="flex items-end gap-2.5 overflow-x-auto pb-0.5">
            {hasLocalDecks ? (
              <>
                {localGame.currentLegend ? (
                  <ExhaustableCard
                    card={localGame.currentLegend}
                    label="Legend"
                    exhausted={localGame.currentExhaustedUids.includes(localGame.currentLegend.uid)}
                    onTap={() => localGame.toggleCardExhaust(localGame.activePlayerIndex, localGame.currentLegend!.uid)}
                    width={CARD.base}
                  />
                ) : <ZoneSlot label="Legend" />}
                {localGame.currentChampion ? (
                  <ExhaustableCard
                    card={localGame.currentChampion}
                    label="Champion"
                    exhausted={localGame.currentExhaustedUids.includes(localGame.currentChampion.uid)}
                    onTap={() => localGame.toggleCardExhaust(localGame.activePlayerIndex, localGame.currentChampion!.uid)}
                    width={CARD.base}
                  />
                ) : <ZoneSlot label="Champion" />}

                {localGame.currentBase.length > 0 && (
                  <div className="w-px h-12 bg-[#c5a84a]/20 mx-0.5 flex-shrink-0" />
                )}

                {localGame.currentBase.map((card) => (
                  <ExhaustableCard
                    key={card.uid}
                    card={card}
                    label="Base"
                    exhausted={localGame.currentExhaustedUids.includes(card.uid)}
                    onTap={() => localGame.toggleCardExhaust(localGame.activePlayerIndex, card.uid)}
                    width={CARD.base}
                    dragZone="base"
                  />
                ))}

                {localGame.currentBase.length === 0 && (
                  <div
                    className="flex-shrink-0 rounded border border-dashed border-[#c5a84a]/15 flex items-center justify-center opacity-40"
                    style={{ width: `${CARD.base}px`, aspectRatio: '2/3' }}
                  >
                    <span className="text-[8px] text-[#c5a84a]/40">Drop here</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <ZoneSlot label="Legend" />
                <ZoneSlot label="Champion" />
              </>
            )}

            {hasLocalDecks && (
              <div className="ml-auto flex flex-col items-center gap-0.5 flex-shrink-0 pl-2">
                <div
                  className="rounded bg-[#0a1628] border border-[#c5a84a]/30 flex items-center justify-center"
                  style={{ width: `${CARD.deck}px`, aspectRatio: '2/3' }}
                >
                  <span className="text-sm font-bold text-[#c5a84a]/60">{localGame.currentDeckCount}</span>
                </div>
                <span className="text-[8px] text-zinc-500 leading-none">Deck</span>
              </div>
            )}
          </div>
        </DropZone>

        {/* ── 5. Channeled runes row ── */}
        <div className="shrink-0 border-t border-[#c5a84a]/10 bg-[#060e1a]/40 px-2 py-1">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-zinc-500">Runes ({localGame.currentChanneledRunes.length})</span>
            {hasLocalDecks && <span className="text-[10px] text-zinc-600 ml-1">deck: {localGame.currentRuneDeckCount}</span>}
          </div>
          {localGame.currentChanneledRunes.length > 0 ? (
            <div className="flex items-end gap-1.5 overflow-x-auto pb-0.5">
              {localGame.currentChanneledRunes.map((rune, i) => (
                <button
                  key={rune.card.uid}
                  onClick={() => localGame.toggleRuneExhaust(localGame.activePlayerIndex, i)}
                  className="flex-shrink-0 focus:outline-none"
                  title={rune.exhausted ? 'Exhausted — tap to ready' : 'Tap to exhaust'}
                >
                  <div
                    style={{
                      width: `${CARD.rune}px`, aspectRatio: '2/3',
                      transform: rune.exhausted ? 'rotate(90deg)' : 'none',
                      opacity: rune.exhausted ? 0.5 : 1,
                      transition: 'transform 0.15s ease, opacity 0.15s ease',
                      marginRight: rune.exhausted ? '20px' : '0',
                      marginLeft: rune.exhausted && i > 0 ? '20px' : '0',
                    }}
                    className="rounded bg-[#0a1628] border border-[#c5a84a]/30 overflow-hidden"
                  >
                    {rune.card.imageSmall ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={rune.card.imageSmall} alt={rune.card.name} className="w-full h-full object-cover" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-end justify-center pb-0.5">
                        <span className="text-[7px] text-[#c5a84a]/50 text-center px-0.5 leading-tight">{rune.card.name}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-zinc-600 italic">
              {hasLocalDecks ? 'No runes channeled yet' : 'No deck loaded'}
            </div>
          )}
        </div>

        {/* ── 6. Hand (DRAG SOURCE) + Trash (DROP TARGET) ── */}
        <div className="shrink-0 flex flex-col border-t border-[#c5a84a]/10" style={{ height: '160px' }}>
          <DropZone
            zone="hand"
            accepts={['base']}
            dropLabel="Return to Hand"
            highlightClass="ring-2 ring-blue-400/60"
            className="flex-1 min-h-0 bg-[#060e1a]/60 overflow-hidden"
          >
            {hasLocalDecks ? (
              <HandDisplay cards={localGame.currentHand} zone="hand" />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-zinc-600 italic">No deck loaded</div>
            )}
          </DropZone>

          <DropZone
            zone="trash"
            accepts={['hand', 'base']}
            dropLabel="Discard"
            highlightClass="ring-2 ring-red-400/60"
            className="shrink-0 border-t border-[#c5a84a]/10 bg-[#060e1a]/40 px-2 py-1 flex items-center gap-3"
          >
            <span className="text-[10px] text-zinc-500 tabular-nums">Trash: {localGame.currentTrash.length}</span>
            {localGame.currentTrash.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto">
                {localGame.currentTrash.slice(-5).map((card) => (
                  <div key={card.uid} className="w-7 h-10 rounded bg-[#0a1628] border border-zinc-700/40 overflow-hidden flex-shrink-0" title={card.name}>
                    {card.imageSmall && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.imageSmall} alt="" className="w-full h-full object-cover opacity-50" draggable={false} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </DropZone>
        </div>

        {/* ── 7. Controls bar ── */}
        <div className="border-t border-[#c5a84a]/20 bg-[#060e1a]/80 shrink-0">
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
                localMode={hasLocalDecks}
              />
            </div>
          )}
          {isSpectator && <p className="text-center text-xs text-zinc-500 py-2">Spectating — read only</p>}
          <TurnLog turnHistory={turnHistory} />
        </div>
      </div>
    </DragDropProvider>
  );
}
