'use client';

import { useState, useEffect, useRef } from 'react';
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
  /** Number of battlefield cards required (2 for 1v1, 3 for 2v2/FFA) */
  required: number;
  socket: MatchSocket;
  /** Called after the reveal animation completes */
  onRevealed: (state: MatchState) => void;
  /** Whether this is local match mode (single device, sequential picks) */
  localMode?: boolean;
  /** All player names for local mode sequential display */
  localPlayerNames?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BattlefieldSelection({
  code: _code,
  playerId,
  battlefieldCards,
  required,
  socket,
  onRevealed,
  localMode = false,
  localPlayerNames = [],
}: BattlefieldSelectionProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [localPlayerIndex, setLocalPlayerIndex] = useState(0);
  const [localSubmissions, setLocalSubmissions] = useState<string[][]>([]);
  const [revealed, setRevealed] = useState(false);
  const [revealedState, setRevealedState] = useState<BattlefieldRevealPayload | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSelectionComplete = selectedIds.length === required;
  const totalLocalPlayers = localMode ? Math.max(localPlayerNames.length, 1) : 1;

  // ---------------------------------------------------------------
  // Socket listeners
  // ---------------------------------------------------------------

  useEffect(() => {
    function onSubmitted() {
      // Server acknowledged our submission — UI already updated optimistically
    }

    function onReveal(payload: BattlefieldRevealPayload) {
      setRevealedState(payload);
      setRevealed(true);

      // Staggered flip animation: flip each card 100ms apart
      payload.battlefields.forEach((bf, bfIndex) => {
        bf.cards.forEach((card, cardIndex) => {
          const delay = (bfIndex * bf.cards.length + cardIndex) * 120;
          revealTimeoutRef.current = setTimeout(() => {
            setFlipped((prev) => new Set([...prev, `${bfIndex}-${cardIndex}`]));
          }, delay);
        });
      });

      // Vibrate on reveal
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }

      // After all flips complete, transition to match board
      const totalCards = payload.battlefields.reduce(
        (sum, bf) => sum + bf.cards.length,
        0,
      );
      const totalAnimationMs = totalCards * 120 + 600 + 400; // animation + buffer

      revealTimeoutRef.current = setTimeout(() => {
        onRevealed({
          battlefields: payload.battlefields,
          players: [],
        });
      }, totalAnimationMs);
    }

    socket.on('battlefield:submitted', onSubmitted);
    socket.on('battlefield:reveal', onReveal);

    return () => {
      socket.off('battlefield:submitted', onSubmitted);
      socket.off('battlefield:reveal', onReveal);
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    };
  }, [socket, onRevealed]);

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
        // All local players submitted — emit all selections and trigger reveal locally
        // For local mode, we emit battlefield:submit for the host player
        // and directly trigger the reveal animation since it's single device
        socket.emit('battlefield:submit', { playerId, cardIds: nextSubmissions[0] ?? [] });
        setSubmitted(true);

        // Simulate reveal for local mode using the local submissions
        const localRevealPayload: BattlefieldRevealPayload = {
          battlefields: nextSubmissions.map((cardIds, index) => ({
            index,
            playerId: `local-player-${index}`,
            cards: cardIds.map((cid) => {
              const card = battlefieldCards.find((c) => c.id === cid);
              return {
                cardId: cid,
                cardName: card?.name ?? cid,
                imageSmall: card?.imageSmall ?? null,
                imageLarge: card?.imageLarge ?? null,
              };
            }),
          })),
        };

        setRevealedState(localRevealPayload);
        setRevealed(true);

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(100);
        }

        // Staggered flip animation
        localRevealPayload.battlefields.forEach((bf, bfIndex) => {
          bf.cards.forEach((_card, cardIndex) => {
            const delay = (bfIndex * bf.cards.length + cardIndex) * 120;
            revealTimeoutRef.current = setTimeout(() => {
              setFlipped((prev) => new Set([...prev, `${bfIndex}-${cardIndex}`]));
            }, delay);
          });
        });

        const totalCards = nextSubmissions.reduce((sum, ids) => sum + ids.length, 0);
        const totalAnimationMs = totalCards * 120 + 600 + 400;
        revealTimeoutRef.current = setTimeout(() => {
          onRevealed({ battlefields: localRevealPayload.battlefields, players: [] });
        }, totalAnimationMs);
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
                Player {bfIndex + 1}
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
  // Waiting view (after submission, before reveal)
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
          Choose {required} Battlefield Card{required > 1 ? 's' : ''}
        </h2>
        <p className="text-sm lg-text-secondary">
          Your selection is secret until all players have chosen.
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
      {battlefieldCards.length === 0 ? (
        <div className="lg-card p-4 text-center">
          <p className="text-sm lg-text-secondary">No battlefield cards available in this deck.</p>
          <p className="text-xs text-zinc-600 mt-1">
            Make sure your deck includes Battlefield cards.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {battlefieldCards.map((card) => {
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
