'use client';

import { useState } from 'react';
import Image from 'next/image';
import { drawHand, type HandCard } from '@la-grieta/shared';

interface HandSimulatorProps {
  cards: Array<{
    cardId: string;
    quantity: number;
    name: string;
    imageSmall: string | null;
    zone: string;
  }>;
}

export function HandSimulator({ cards }: HandSimulatorProps) {
  const [hand, setHand] = useState<HandCard[]>([]);
  const [mulliganMode, setMulliganMode] = useState(false);
  const [selectedForMulligan, setSelectedForMulligan] = useState<Set<number>>(new Set());

  const mainCards = cards.filter((c) => c.zone === 'main');

  function handleDrawHand() {
    const drawn = drawHand(mainCards, 4);
    setHand(drawn);
    setMulliganMode(false);
    setSelectedForMulligan(new Set());
  }

  function handleMulliganToggle(idx: number) {
    setSelectedForMulligan((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else if (next.size < 2) {
        next.add(idx);
      }
      return next;
    });
  }

  function handleConfirmMulligan() {
    const returnedIndices = selectedForMulligan;
    const keptCards = hand.filter((_, i) => !returnedIndices.has(i));
    const numToReplace = returnedIndices.size;

    // Build remaining pool: main pool minus currently kept cards
    // We draw fresh replacements from a re-shuffled pool
    const replacements = drawHand(mainCards, numToReplace + keptCards.length);
    // Take only numToReplace from the fresh draw that aren't already in kept
    const newCards = replacements.slice(0, numToReplace);

    setHand([...keptCards, ...newCards]);
    setMulliganMode(false);
    setSelectedForMulligan(new Set());
  }

  if (mainCards.length === 0) return null;

  return (
    <div className="lg-card px-5 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="lg-section-title">Sample Hand</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDrawHand} className="lg-btn-secondary">
            {hand.length === 0 ? 'Draw Sample Hand' : 'Draw Again'}
          </button>
          {hand.length > 0 && !mulliganMode && (
            <button
              onClick={() => setMulliganMode(true)}
              className="lg-btn-secondary"
            >
              Mulligan
            </button>
          )}
          {mulliganMode && (
            <button
              onClick={handleConfirmMulligan}
              className="lg-btn-secondary"
            >
              Confirm Mulligan ({selectedForMulligan.size})
            </button>
          )}
        </div>
      </div>

      {hand.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-4">
          Draw a sample opening hand to preview what you might start with.
        </p>
      )}

      {hand.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {hand.map((card, idx) => {
            const isSelected = selectedForMulligan.has(idx);
            return (
              <div
                key={`${card.cardId}-${idx}`}
                className={`flex-shrink-0 flex flex-col items-center gap-1 cursor-default transition-opacity ${
                  mulliganMode ? 'cursor-pointer' : ''
                } ${mulliganMode && isSelected ? 'opacity-40' : 'opacity-100'}`}
                onClick={() => {
                  if (mulliganMode) handleMulliganToggle(idx);
                }}
                role={mulliganMode ? 'checkbox' : undefined}
                aria-checked={mulliganMode ? isSelected : undefined}
                aria-label={mulliganMode ? `${isSelected ? 'Unselect' : 'Select'} ${card.name} for mulligan` : card.name}
              >
                {card.imageSmall ? (
                  <div className="relative w-20 h-28 rounded overflow-hidden border border-zinc-700">
                    <Image
                      src={card.imageSmall}
                      alt={card.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-28 rounded bg-surface-elevated border border-surface-border flex items-center justify-center">
                    <span className="text-zinc-600 text-xs text-center px-1">{card.name}</span>
                  </div>
                )}
                <span className="text-xs text-zinc-400 text-center max-w-[80px] truncate">
                  {card.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {mulliganMode && (
        <p className="text-xs text-zinc-500">
          Click up to 2 cards to return them. Confirm to draw replacements.
        </p>
      )}
    </div>
  );
}
