'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type {
  MatchSocket,
  BattlefieldRevealPayload,
} from '@/lib/match-socket';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/types/router';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardData = inferRouterOutputs<AppRouter>['card']['list']['items'][number];

interface RevealedBattlefield {
  index: number;
  playerId: string;
  cards: Array<{
    cardId: string;
    cardName: string;
    imageSmall: string | null;
    imageLarge: string | null;
  }>;
}

export interface MatchState {
  battlefields: RevealedBattlefield[];
  players: Array<{
    id: string;
    displayName: string;
    role: string;
    color: string;
    score: number;
  }>;
}

interface BattlefieldSelectionProps {
  code: string;
  playerId: string;
  battlefieldCards: CardData[];
  /** Number of battlefield cards each player picks (always 1) */
  required: number;
  socket: MatchSocket;
  /** Called after the reveal animation completes */
  onRevealed: (state: MatchState) => void;
  /** Whether this is local match mode (single device, sequential picks) */
  localMode?: boolean;
  /** All player names for local mode sequential display */
  localPlayerNames?: string[];
  /** Per-player battlefield cards for local mode (each player sees only their own) */
  localPlayerCards?: CardData[][];
  /** Battlefield card IDs already used in previous matches of a series */
  usedBattlefieldIds?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BattlefieldSelection({
  code,
  playerId,
  battlefieldCards,
  required,
  socket,
  onRevealed,
  localMode = false,
  localPlayerNames = [],
  localPlayerCards,
  usedBattlefieldIds = [],
}: BattlefieldSelectionProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [localPlayerIndex, setLocalPlayerIndex] = useState(0);
  const [localSubmissions, setLocalSubmissions] = useState<string[][]>([]);
  const [revealed, setRevealed] = useState(false);
  const [revealedState, setRevealedState] = useState<BattlefieldRevealPayload | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  // Store all active timeouts so we can clean them all up (not just the last one)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Stable ref for onRevealed so useEffect doesn't re-run on every render
  const onRevealedRef = useRef(onRevealed);
  onRevealedRef.current = onRevealed;

  const isSelectionComplete = selectedIds.length === required;
  const totalLocalPlayers = localMode ? Math.max(localPlayerNames.length, 1) : 1;

  // In local mode, each player sees only their own battlefield cards
  // Also exclude cards used in previous matches of a series
  const usedSet = new Set(usedBattlefieldIds);
  const availableCards = localMode && localPlayerCards
    ? (localPlayerCards[localPlayerIndex] ?? []).filter((c) => !usedSet.has(c.id))
    : battlefieldCards.filter((c) => !usedSet.has(c.id));

  // Helper: clear all pending timeouts
  const clearAllTimeouts = useCallback(() => {
    for (const id of timeoutIdsRef.current) clearTimeout(id);
    timeoutIdsRef.current = [];
  }, []);

  // Helper: schedule a timeout and track it
  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timeoutIdsRef.current.push(id);
    return id;
  }, []);

  // Helper: run reveal animation (shared between local and socket paths)
  const runRevealAnimation = useCallback(
    (payload: BattlefieldRevealPayload) => {
      setRevealedState(payload);
      setRevealed(true);

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }

      // Staggered flip animation
      payload.battlefields.forEach((bf, bfIndex) => {
        bf.cards.forEach((_card, cardIndex) => {
          const delay = (bfIndex * bf.cards.length + cardIndex) * 120;
          schedule(() => {
            setFlipped((prev) => new Set([...prev, `${bfIndex}-${cardIndex}`]));
          }, delay);
        });
      });

      // After all flips complete, transition to match board
      const totalCards = payload.battlefields.reduce(
        (sum, bf) => sum + bf.cards.length,
        0,
      );
      const totalAnimationMs = totalCards * 120 + 600 + 400;

      schedule(() => {
        onRevealedRef.current({
          battlefields: payload.battlefields,
          players: [],
        });
      }, totalAnimationMs);
    },
    [schedule],
  );

  // ---------------------------------------------------------------
  // Socket listeners (synced mode only)
  // ---------------------------------------------------------------

  useEffect(() => {
    // Local mode handles reveal directly — no socket listeners needed
    if (localMode) return;

    function onSubmitted() {
      // Server acknowledged our submission — UI already updated optimistically
    }

    function onReveal(payload: BattlefieldRevealPayload) {
      runRevealAnimation(payload);
    }

    socket.on('battlefield:submitted', onSubmitted);
    socket.on('battlefield:reveal', onReveal);

    return () => {
      socket.off('battlefield:submitted', onSubmitted);
      socket.off('battlefield:reveal', onReveal);
    };
  }, [socket, localMode, runRevealAnimation]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  // ---------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------

  function toggleCard(cardId: string) {
    if (submitted) return;
    setSelectedIds((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= required) {
        // Replace last if at capacity
        return [...prev.slice(0, required - 1), cardId];
      }
      return [...prev, cardId];
    });
  }

  function handleConfirm() {
    if (!isSelectionComplete) return;

    if (localMode) {
      // Local mode: store this player's selection and move to next player
      const nextSubmissions = [...localSubmissions, selectedIds];
      setLocalSubmissions(nextSubmissions);
      setSelectedIds([]);

      if (localPlayerIndex + 1 < totalLocalPlayers) {
        setLocalPlayerIndex((i) => i + 1);
      } else {
        // All local players submitted — trigger reveal locally
        setSubmitted(true);

        // Build reveal payload from each player's card pool
        const allCards = localPlayerCards
          ? localPlayerCards.flat()
          : battlefieldCards;
        const localRevealPayload: BattlefieldRevealPayload = {
          battlefields: nextSubmissions.map((cardIds, index) => ({
            index,
            playerId: `local-player-${index}`,
            cards: cardIds.map((cid) => {
              const card = allCards.find((c) => c.id === cid);
              return {
                cardId: cid,
                cardName: card?.name ?? cid,
                imageSmall: card?.imageSmall ?? null,
                imageLarge: card?.imageLarge ?? null,
              };
            }),
          })),
        };

        // Send ALL selected card IDs to the server so match state is populated
        const allSelectedCardIds = nextSubmissions.flat();
        socket.emit('battlefield:set-local', { code, cardIds: allSelectedCardIds });

        runRevealAnimation(localRevealPayload);
      }
    } else {
      // Synced mode: emit to server
      socket.emit('battlefield:submit', { playerId, cardIds: selectedIds });
      setSubmitted(true);
    }
  }

  // ---------------------------------------------------------------
  // Reveal animation view
  // ---------------------------------------------------------------

  if (revealed && revealedState) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-bold text-white">Battlefield Reveal!</h2>
          <p className="text-sm lg-text-secondary">Flipping cards...</p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center">
          {revealedState.battlefields.map((bf, bfIndex) => (
            <div key={bfIndex} className="space-y-2">
              <p className="text-xs text-zinc-500 text-center">
                {localMode
                  ? (localPlayerNames[bfIndex] ?? `Player ${bfIndex + 1}`)
                  : `Player ${bfIndex + 1}`}
              </p>
              <div className="flex gap-2">
                {bf.cards.map((card, cardIndex) => {
                  const flipKey = `${bfIndex}-${cardIndex}`;
                  const isFlipped = flipped.has(flipKey);
                  return (
                    <div
                      key={card.cardId}
                      className="w-20 aspect-[2/3]"
                      style={{ perspective: '600px' }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          position: 'relative',
                          transformStyle: 'preserve-3d',
                          transition: 'transform 600ms ease',
                          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        }}
                      >
                        {/* Card back */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                          }}
                          className="rounded-lg bg-gradient-to-br from-rift-900 to-surface-elevated border border-rift-800/50 flex items-center justify-center"
                        >
                          <div className="w-6 h-6 rounded-full bg-rift-600/30 border border-rift-600/50" />
                        </div>
                        {/* Card front */}
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                          }}
                          className="rounded-lg overflow-hidden border border-surface-border"
                        >
                          {card.imageSmall ? (
                            <Image
                              src={card.imageSmall}
                              alt={card.cardName}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-1">
                              <span className="text-zinc-500 text-[10px] text-center">
                                {card.cardName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Waiting view (synced mode only — after submission, before reveal)
  // ---------------------------------------------------------------

  if (submitted && !localMode) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-green-900/30 border border-green-700/40 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">Selection submitted</h2>
          <p className="text-sm lg-text-secondary">
            Waiting for other players...
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {selectedIds.map((_, i) => (
            <div
              key={i}
              className="w-8 h-12 rounded bg-rift-900/30 border border-rift-700/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Selection view
  // ---------------------------------------------------------------

  const currentPlayerName = localMode
    ? (localPlayerNames[localPlayerIndex] ?? `Player ${localPlayerIndex + 1}`)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        {localMode && currentPlayerName && (
          <p className="text-sm font-medium text-rift-400">{currentPlayerName}&apos;s turn</p>
        )}
        <h2 className="text-lg font-bold text-white">
          Choose Your Battlefield
        </h2>
        <p className="text-sm lg-text-secondary">
          {localMode
            ? 'Pick 1 battlefield card. Previously used battlefields are excluded.'
            : 'Your selection is secret until all players have chosen.'}
        </p>
      </div>

      {/* Selection progress */}
      <div className="flex items-center gap-2 justify-center">
        {Array.from({ length: required }).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-12 rounded border-2 transition-all ${
              i < selectedIds.length
                ? 'border-rift-400 bg-rift-900/30'
                : 'border-surface-border bg-surface-elevated'
            }`}
          />
        ))}
        <span className="text-sm text-zinc-500 ml-2">
          {selectedIds.length}/{required}
        </span>
      </div>

      {/* Battlefield card grid */}
      {availableCards.length === 0 ? (
        <div className="lg-card p-4 text-center">
          <p className="text-sm lg-text-secondary">No battlefield cards available.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Make sure your deck includes Battlefield cards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableCards.map((card) => {
            const isSelected = selectedIds.includes(card.id);
            return (
              <button
                key={card.id}
                onClick={() => toggleCard(card.id)}
                className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${
                  isSelected
                    ? 'border-rift-400 ring-2 ring-rift-400/40 scale-[0.98]'
                    : 'border-surface-border hover:border-surface-hover hover:scale-[0.98]'
                }`}
              >
                {card.imageSmall ? (
                  <Image
                    src={card.imageSmall}
                    alt={card.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 45vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-2">
                    <span className="text-zinc-500 text-xs text-center">{card.name}</span>
                  </div>
                )}
                {isSelected && (
                  <div className="absolute inset-0 bg-rift-500/20 flex items-start justify-end p-1.5">
                    <div className="w-6 h-6 rounded-full bg-rift-500 flex items-center justify-center">
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs font-medium truncate">{card.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={handleConfirm}
        disabled={!isSelectionComplete}
        className="lg-btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {localMode && localPlayerIndex < totalLocalPlayers - 1
          ? `Confirm — Pass to ${localPlayerNames[localPlayerIndex + 1] ?? 'next player'}`
          : 'Confirm Selection'}
      </button>

      {!isSelectionComplete && (
        <p className="text-center text-xs text-zinc-600">
          Select {required - selectedIds.length} more card{required - selectedIds.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
