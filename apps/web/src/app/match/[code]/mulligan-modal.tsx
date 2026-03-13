'use client';

import { useState } from 'react';
import Image from 'next/image';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MulliganCard {
  id: string;
  uid: string;
  name: string;
  cardType: string | null;
  imageSmall: string | null;
}

interface MulliganModalProps {
  playerName: string;
  hand: MulliganCard[];
  /** Max cards that can be returned (always 2 for Riftbound) */
  maxReturns: number;
  onConfirm: (cardIndices: number[]) => void;
  onSkip: () => void;
}

// ---------------------------------------------------------------------------
// MulliganModal
// ---------------------------------------------------------------------------

export function MulliganModal({
  playerName,
  hand,
  maxReturns,
  onConfirm,
  onSkip,
}: MulliganModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  function toggleCard(index: number) {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= maxReturns) {
        // Replace the oldest selection once at capacity
        return [...prev.slice(1), index];
      }
      return [...prev, index];
    });
  }

  function handleConfirm() {
    if (selectedIndices.length === 0) return;
    onConfirm(selectedIndices);
  }

  const selectedCount = selectedIndices.length;
  const mulliganButtonLabel =
    selectedCount === 0
      ? 'Mulligan'
      : `Mulligan ${selectedCount}`;

  return (
    /* Fixed full-screen overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mulligan-title"
    >
      <div className="lg-card w-full max-w-sm flex flex-col gap-5 p-5">

        {/* Header */}
        <div className="space-y-1 text-center">
          <h2
            id="mulligan-title"
            className="lg-page-title"
          >
            {playerName} &mdash; Mulligan
          </h2>
          <p className="lg-text-secondary text-xs">
            Select up to {maxReturns} cards to put back and redraw
          </p>
        </div>

        {/* Selection counter */}
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: maxReturns }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < selectedCount
                  ? 'bg-rift-400'
                  : 'bg-surface-elevated border border-surface-border'
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-zinc-400">
            {selectedCount}/{maxReturns} selected
          </span>
        </div>

        {/* Hand grid */}
        <div className="grid grid-cols-4 gap-2.5">
          {hand.map((card, index) => {
            const isSelected = selectedIndices.includes(index);
            return (
              <button
                key={card.uid}
                onClick={() => toggleCard(index)}
                aria-label={`${card.name}${isSelected ? ' — selected' : ''}`}
                aria-pressed={isSelected}
                className={`
                  relative aspect-[2/3] rounded-lg overflow-hidden
                  border-2 transition-all duration-150
                  focus-visible:ring-2 focus-visible:ring-rift-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card
                  ${isSelected
                    ? 'border-rift-400 ring-1 ring-rift-400/40 scale-[0.97]'
                    : 'border-surface-border hover:border-surface-hover hover:scale-[0.98]'
                  }
                `}
              >
                {/* Card image */}
                {card.imageSmall ? (
                  <Image
                    src={card.imageSmall}
                    alt={card.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-1">
                    <span className="text-zinc-500 text-[8px] text-center leading-tight">
                      {card.cardType ?? 'Card'}
                    </span>
                  </div>
                )}

                {/* Card name bar */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pt-4 pb-0.5 px-0.5">
                  <p className="text-white text-[7px] font-medium truncate text-center leading-tight">
                    {card.name}
                  </p>
                </div>

                {/* Selection checkmark */}
                {isSelected && (
                  <div className="absolute inset-0 bg-rift-500/15 flex items-start justify-end p-1">
                    <div className="w-5 h-5 rounded-full bg-rift-500 flex items-center justify-center shadow-md">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
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
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={onSkip}
            className="lg-btn-secondary flex-1 text-sm"
          >
            Keep Hand
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            className="lg-btn-primary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mulliganButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
