'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useDragDrop, type ZoneId } from './drag-drop-context';
import type { GameCardInfo } from '@/hooks/use-local-game-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HandDisplayProps {
  cards: GameCardInfo[];
  /** Show cards face-down (for opponent or during pass-the-phone transition) */
  faceDown?: boolean;
  /** Zone this hand belongs to (default: 'hand') */
  zone?: ZoneId;
}

// ---------------------------------------------------------------------------
// CardBack — reusable face-down card visual
// ---------------------------------------------------------------------------

function CardBack() {
  return (
    <div className="w-full h-full rounded-lg bg-gradient-to-br from-rift-900 to-surface-elevated border border-rift-800/50 flex items-center justify-center">
      <div className="w-5 h-5 rounded-full bg-rift-600/30 border border-rift-600/50" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DraggableCard — card tile that initiates drag on pointer down
// ---------------------------------------------------------------------------

const DRAG_THRESHOLD = 8; // px before drag starts

function DraggableCard({
  card,
  faceDown,
  zone,
}: {
  card: GameCardInfo;
  faceDown: boolean;
  zone: ZoneId;
}) {
  const { startDrag, dragState } = useDragDrop();
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const isDraggingThis = dragState?.card.uid === card.uid;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (faceDown) return;
      // Capture the pointer so we get move events even if finger moves off element
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      pointerStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    },
    [faceDown],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = pointerStartRef.current;
      if (!start || dragState) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        pointerStartRef.current = null;
        startDrag(card, zone, e.clientX, e.clientY);
      }
    },
    [card, zone, startDrag, dragState],
  );

  const handlePointerUp = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`
        relative flex-shrink-0 w-[108px] aspect-[2/3] rounded-lg overflow-hidden
        border border-surface-border touch-none select-none
        transition-all duration-150 ease-out
        ${isDraggingThis ? 'opacity-30 scale-95' : 'hover:scale-105 active:scale-95'}
      `}
      style={{ transformOrigin: 'bottom center' }}
    >
      {faceDown ? (
        <CardBack />
      ) : (
        <>
          {card.imageSmall ? (
            <Image
              src={card.imageSmall}
              alt={card.name}
              fill
              className="object-cover pointer-events-none"
              sizes="108px"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-1">
              <span className="text-zinc-500 text-[8px] text-center leading-tight">
                {card.cardType ?? 'Card'}
              </span>
            </div>
          )}

          {/* Card name gradient bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent pt-4 pb-0.5 px-1 pointer-events-none">
            <p className="text-white text-[9px] font-medium truncate leading-tight">
              {card.name}
            </p>
          </div>

          {/* Cost pip */}
          {(card.energyCost != null || card.might != null) && (
            <div className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 rounded-full bg-black/70 border border-zinc-700/60 flex items-center justify-center px-0.5 pointer-events-none">
              <span className="text-[7px] font-bold text-zinc-200">
                {card.energyCost ?? card.might}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HandDisplay
// ---------------------------------------------------------------------------

export function HandDisplay({ cards, faceDown = false, zone = 'hand' }: HandDisplayProps) {
  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-14 text-zinc-600 text-xs">
        {faceDown ? 'No cards' : 'Empty hand'}
      </div>
    );
  }

  // When there are many cards, apply negative margins so they overlap slightly.
  const useOverlap = cards.length > 5;

  return (
    <div
      className="overflow-x-auto pb-1"
      style={{ scrollbarWidth: 'none' }}
    >
      <div
        className="flex items-end px-2 py-1 min-w-max"
        style={useOverlap ? { gap: 0 } : { gap: '6px' }}
      >
        {cards.map((card, index) => (
          <div
            key={card.uid}
            style={
              useOverlap
                ? {
                    marginLeft: index === 0 ? 0 : '-14px',
                    zIndex: index,
                    position: 'relative',
                  }
                : { position: 'relative', zIndex: 1 }
            }
          >
            <DraggableCard card={card} faceDown={faceDown} zone={zone} />
          </div>
        ))}
      </div>
    </div>
  );
}
