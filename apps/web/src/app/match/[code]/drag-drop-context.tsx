'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react';
import type { GameCardInfo } from '@/hooks/use-local-game-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Zones a card can be dragged from / dropped into */
export type ZoneId =
  | 'hand'
  | 'base'
  | 'trash'
  | 'runes'
  | 'battlefield-0'
  | 'battlefield-1'
  | 'battlefield-2';

interface DragState {
  card: GameCardInfo;
  sourceZone: ZoneId;
  /** Current pointer position (viewport coords) */
  x: number;
  y: number;
}

interface DragDropContextValue {
  dragState: DragState | null;
  /** Which drop zone the pointer is currently over */
  activeDropZone: ZoneId | null;
  /** Start dragging a card */
  startDrag: (card: GameCardInfo, sourceZone: ZoneId, x: number, y: number) => void;
  /** Register a drop zone element ref */
  registerDropZone: (zone: ZoneId, el: HTMLElement | null) => void;
  /** Unregister a drop zone */
  unregisterDropZone: (zone: ZoneId) => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DragDropProviderProps {
  children: ReactNode;
  /** Called when a card is dropped on a valid zone */
  onDrop: (card: GameCardInfo, sourceZone: ZoneId, targetZone: ZoneId) => void;
}

export function DragDropProvider({ children, onDrop }: DragDropProviderProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<ZoneId | null>(null);
  const dropZoneRefs = useRef<Map<ZoneId, HTMLElement>>(new Map());
  const dragStateRef = useRef<DragState | null>(null);
  const activeDropRef = useRef<ZoneId | null>(null);

  // Keep refs in sync with state
  dragStateRef.current = dragState;
  activeDropRef.current = activeDropZone;

  const registerDropZone = useCallback((zone: ZoneId, el: HTMLElement | null) => {
    if (el) {
      dropZoneRefs.current.set(zone, el);
    } else {
      dropZoneRefs.current.delete(zone);
    }
  }, []);

  const unregisterDropZone = useCallback((zone: ZoneId) => {
    dropZoneRefs.current.delete(zone);
  }, []);

  const hitTestDropZones = useCallback((x: number, y: number): ZoneId | null => {
    for (const [zone, el] of dropZoneRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return zone;
      }
    }
    return null;
  }, []);

  const startDrag = useCallback((card: GameCardInfo, sourceZone: ZoneId, x: number, y: number) => {
    const state: DragState = { card, sourceZone, x, y };
    setDragState(state);
    dragStateRef.current = state;

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, []);

  // Global pointer move + up handlers
  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      if (!dragStateRef.current) return;
      e.preventDefault();

      setDragState((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
      );

      const zone = hitTestDropZones(e.clientX, e.clientY);
      if (zone !== activeDropRef.current) {
        setActiveDropZone(zone);
        activeDropRef.current = zone;
        // Haptic on zone entry
        if (zone && typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
    }

    function handlePointerUp(e: PointerEvent) {
      const ds = dragStateRef.current;
      if (!ds) return;

      const targetZone = hitTestDropZones(e.clientX, e.clientY);
      if (targetZone && targetZone !== ds.sourceZone) {
        onDrop(ds.card, ds.sourceZone, targetZone);
      }

      setDragState(null);
      setActiveDropZone(null);
      dragStateRef.current = null;
      activeDropRef.current = null;
    }

    function handlePointerCancel() {
      setDragState(null);
      setActiveDropZone(null);
      dragStateRef.current = null;
      activeDropRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [hitTestDropZones, onDrop]);

  return (
    <DragDropContext.Provider
      value={{ dragState, activeDropZone, startDrag, registerDropZone, unregisterDropZone }}
    >
      {children}

      {/* Drag ghost overlay */}
      {dragState && (
        <div
          className="fixed pointer-events-none z-[200]"
          style={{
            left: dragState.x - 54,
            top: dragState.y - 81,
          }}
        >
          <div className="w-[108px] aspect-[2/3] rounded-lg overflow-hidden border-2 border-rift-400 shadow-xl shadow-rift-500/30 opacity-90 rotate-3">
            {dragState.card.imageSmall ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dragState.card.imageSmall}
                alt={dragState.card.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-surface-elevated flex items-center justify-center p-1">
                <span className="text-zinc-400 text-[8px] text-center">
                  {dragState.card.name}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </DragDropContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDragDrop() {
  const ctx = useContext(DragDropContext);
  if (!ctx) throw new Error('useDragDrop must be used inside DragDropProvider');
  return ctx;
}

/** Safe version that returns null outside the provider (e.g., for optional drag support) */
export function useDragDropSafe() {
  return useContext(DragDropContext);
}

// ---------------------------------------------------------------------------
// DropZone component — wraps children and registers as a drop target
// ---------------------------------------------------------------------------

interface DropZoneProps {
  zone: ZoneId;
  children: ReactNode;
  className?: string;
  /** Extra highlight class when this zone is the active drop target */
  highlightClass?: string;
  /** Label shown when dragging over this zone */
  dropLabel?: string;
  /** Accepted source zones — if omitted, accepts all */
  accepts?: ZoneId[];
}

export function DropZone({
  zone,
  children,
  className = '',
  highlightClass = 'ring-2 ring-rift-400/60',
  dropLabel,
  accepts,
}: DropZoneProps) {
  const { dragState, activeDropZone, registerDropZone } = useDragDrop();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerDropZone(zone, ref.current);
    return () => registerDropZone(zone, null);
  }, [zone, registerDropZone]);

  const isDragging = !!dragState;
  const isOver = activeDropZone === zone;
  const isAccepted =
    isDragging &&
    dragState.sourceZone !== zone &&
    (!accepts || accepts.includes(dragState.sourceZone));

  return (
    <div
      ref={ref}
      className={`
        relative transition-all duration-150
        ${className}
        ${isAccepted && isOver ? highlightClass : ''}
        ${isAccepted && !isOver ? 'opacity-100' : ''}
      `}
    >
      {children}

      {/* Drop overlay when dragging and this zone is a valid target */}
      {isAccepted && (
        <div
          className={`
            absolute inset-0 rounded-lg border-2 border-dashed pointer-events-none z-10 transition-all duration-150
            flex items-center justify-center
            ${isOver
              ? 'border-rift-400 bg-rift-500/15'
              : 'border-zinc-600/40 bg-transparent'
            }
          `}
        >
          {dropLabel && isOver && (
            <span className="text-[11px] font-medium text-rift-300 bg-black/60 px-2 py-0.5 rounded">
              {dropLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
