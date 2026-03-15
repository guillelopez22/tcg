'use client';

import { useRef } from 'react';
import { useDragDropSafe, type ZoneId } from '../drag-drop-context';
import type { GameCardInfo } from '@/hooks/use-local-game-state';

// Card size constants (re-exported so callers share one definition)
export const CARD = {
  hand: 108,
  base: 92,
  rune: 68,
  opponentCard: 64,
  opponentRune: 48,
  deck: 92,
  ghost: 108,
} as const;

// ---------------------------------------------------------------------------
// ExhaustableCard — tappable card that can be exhausted (rotated 90deg)
// ---------------------------------------------------------------------------

interface ExhaustableCardProps {
  card: GameCardInfo;
  label: string;
  exhausted: boolean;
  onTap?: () => void;
  width?: number;
  dragZone?: ZoneId;
}

export function ExhaustableCard({ card, label, exhausted, onTap, width = CARD.base, dragZone }: ExhaustableCardProps) {
  const dragCtx = useDragDropSafe();
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    dragStartedRef.current = false;
  }

  function handlePointerMove(e: React.PointerEvent) {
    const start = pointerStartRef.current;
    if (!start || dragStartedRef.current) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8 && dragZone && dragCtx) {
      pointerStartRef.current = null;
      dragStartedRef.current = true;
      dragCtx.startDrag(card, dragZone, e.clientX, e.clientY);
    }
  }

  function handlePointerUp() {
    if (pointerStartRef.current && !dragStartedRef.current) {
      onTap?.();
    }
    pointerStartRef.current = null;
    dragStartedRef.current = false;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="flex flex-col items-center gap-0.5 flex-shrink-0 touch-none select-none cursor-pointer"
      title={exhausted ? 'Exhausted — tap to ready' : 'Tap to exhaust'}
      style={{
        marginRight: exhausted ? `${width * 0.3}px` : '0',
        marginLeft: exhausted ? `${width * 0.3}px` : '0',
      }}
    >
      <div
        style={{
          width: `${width}px`,
          aspectRatio: '2/3',
          transform: exhausted ? 'rotate(90deg)' : 'none',
          opacity: exhausted ? 0.5 : 1,
          transition: 'transform 0.15s ease, opacity 0.15s ease',
        }}
        className="rounded bg-[#0a1628] border border-[#c5a84a]/30 overflow-hidden"
      >
        {card.imageSmall ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageSmall} alt={card.name} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-end justify-center pb-0.5">
            <span className="text-[8px] text-[#c5a84a]/50 text-center px-0.5 leading-tight">{card.name}</span>
          </div>
        )}
      </div>
      <span className="text-[8px] text-zinc-500 leading-none">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoneSlot — empty placeholder card slot
// ---------------------------------------------------------------------------

export function ZoneSlot({ label, width = CARD.base }: { label: string; width?: number }) {
  return (
    <div
      className="flex-shrink-0 rounded bg-[#0a1628] border border-[#c5a84a]/30 flex items-end justify-center pb-1"
      style={{ width: `${width}px`, aspectRatio: '2/3' }}
    >
      <span className="text-[8px] font-medium text-[#c5a84a]/60 text-center leading-tight px-0.5">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UnitZone — large droppable area for deploying units beside battlefields
// ---------------------------------------------------------------------------

export function UnitZone({ side, label }: { side: 'opponent' | 'mine'; label: string }) {
  return (
    <div
      className={`flex-1 min-w-[80px] rounded-lg border-2 border-dashed flex items-center justify-center
        ${side === 'opponent' ? 'border-red-700/20 bg-red-950/5' : 'border-blue-700/20 bg-blue-950/5'}`}
    >
      <span className="text-[10px] text-zinc-500 font-medium text-center px-1">{label}</span>
    </div>
  );
}
