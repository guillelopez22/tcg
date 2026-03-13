'use client';

/**
 * BattlefieldZone — tappable battlefield card with:
 *   - Card art background
 *   - Control state (uncontrolled / held by player / contested / showdown)
 *   - Contextual action labels (Conquer / Showdown / Holding)
 *   - Haptic feedback + flash animation on tap
 *   - Unit deployment slots (my units bottom, opponent units top)
 */

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BattlefieldAction = 'conquer' | 'showdown' | 'holding' | 'contested' | 'none';

interface BattlefieldZoneProps {
  index: number;
  control: string; // 'uncontrolled' | 'contested' | playerId
  playerColors: Record<string, string>;
  /** Who is the current (tapping) player */
  myPlayerId: string;
  cardArt?: string | null;
  cardName?: string | null;
  onTap: (index: number, action: BattlefieldAction) => void;
  disabled?: boolean;
  /** Flash "+1" when score triggers */
  showScoreFlash?: boolean;
  /** Last action that occurred — shown briefly as feedback */
  lastAction?: BattlefieldAction | null;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const CONTROL_STYLES: Record<string, string> = {
  uncontrolled: 'border-zinc-600',
  contested: 'border-dashed border-yellow-500/70',
};

const COLOR_BORDER: Record<string, string> = {
  blue: 'border-blue-500',
  red: 'border-red-500',
  green: 'border-green-500',
  yellow: 'border-yellow-500',
};

const COLOR_OVERLAY: Record<string, string> = {
  blue: 'bg-blue-900/30',
  red: 'bg-red-900/30',
  green: 'bg-green-900/30',
  yellow: 'bg-yellow-900/30',
};

const ACTION_FEEDBACK: Record<BattlefieldAction, { label: string; color: string }> = {
  conquer: { label: 'Conquered!', color: 'text-green-400' },
  showdown: { label: 'Showdown!', color: 'text-red-400' },
  holding: { label: 'Holding', color: 'text-blue-300' },
  contested: { label: 'Contested', color: 'text-yellow-400' },
  none: { label: '', color: '' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BattlefieldZone({
  index,
  control,
  playerColors,
  myPlayerId,
  cardArt,
  cardName,
  onTap,
  disabled = false,
  showScoreFlash = false,
  lastAction,
}: BattlefieldZoneProps) {
  const [feedbackAction, setFeedbackAction] = useState<BattlefieldAction | null>(null);

  const playerColor = playerColors[control];
  const isMyControl = control === myPlayerId;
  const isUncontrolled = control === 'uncontrolled';
  const isContested = control === 'contested';
  const isOpponentControl = !isMyControl && !isUncontrolled && !isContested;

  // Determine what tapping would do
  let tapAction: BattlefieldAction = 'none';
  let tapLabel = '';
  if (isUncontrolled) {
    tapAction = 'conquer';
    tapLabel = 'Tap to Conquer';
  } else if (isMyControl) {
    tapAction = 'holding';
    tapLabel = 'You hold this';
  } else if (isOpponentControl) {
    tapAction = 'showdown';
    tapLabel = 'Tap for Showdown';
  } else if (isContested) {
    tapAction = 'contested';
    tapLabel = 'Showdown in progress';
  }

  const borderClass =
    isUncontrolled
      ? CONTROL_STYLES.uncontrolled
      : isContested
        ? CONTROL_STYLES.contested
        : (COLOR_BORDER[playerColor ?? ''] ?? 'border-rift-500');

  const overlayClass =
    !isUncontrolled && !isContested && playerColor
      ? (COLOR_OVERLAY[playerColor] ?? 'bg-rift-900/30')
      : '';

  // Show the last action from parent OR our local feedback
  const displayAction = lastAction ?? feedbackAction;

  function handleTap() {
    if (disabled) return;
    if (tapAction === 'holding') return; // Already mine — no-op

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(tapAction === 'showdown' ? [50, 30, 50] : 50);
    }

    // Show feedback briefly
    setFeedbackAction(tapAction);
    setTimeout(() => setFeedbackAction(null), 1200);

    onTap(index, tapAction);
  }

  const canTap = !disabled && tapAction !== 'holding' && tapAction !== 'none';

  return (
    <button
      onClick={handleTap}
      disabled={!canTap}
      className={`
        relative w-full h-full rounded-xl border-2 overflow-hidden
        transition-all duration-150
        ${borderClass}
        ${canTap ? 'cursor-pointer hover:opacity-90 active:scale-[0.97]' : 'cursor-default'}
        ${!canTap && disabled ? 'opacity-60' : ''}
      `}
      aria-label={`Battlefield ${index + 1}: ${tapLabel}`}
    >
      {/* Card art background */}
      {cardArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cardArt}
          alt={cardName ?? `Battlefield ${index + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-surface-elevated" />
      )}

      {/* Color overlay for control state */}
      {overlayClass && (
        <div className={`absolute inset-0 ${overlayClass}`} />
      )}

      {/* Contested striped overlay */}
      {isContested && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #eab308 0px, #eab308 4px, transparent 4px, transparent 12px)',
          }}
        />
      )}

      {/* Showdown pulse when contested */}
      {isContested && (
        <div className="absolute inset-0 border-2 border-red-500/40 rounded-xl animate-pulse" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full p-2">
        {/* Top: BF label */}
        <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider drop-shadow">
          BF {index + 1}
        </span>

        {/* Center: card name */}
        {cardName && (
          <span className="text-[10px] text-white/70 text-center drop-shadow line-clamp-2 max-w-[100px] leading-tight">
            {cardName}
          </span>
        )}

        {/* Bottom: action hint */}
        <div className="flex flex-col items-center gap-0.5">
          {isUncontrolled && (
            <span className="text-[9px] text-zinc-300 bg-black/40 px-1.5 py-0.5 rounded">
              Conquer
            </span>
          )}
          {isMyControl && (
            <span className="text-[9px] text-green-400 bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Holding
            </span>
          )}
          {isOpponentControl && (
            <span className="text-[9px] text-red-300 bg-black/40 px-1.5 py-0.5 rounded">
              Showdown
            </span>
          )}
          {isContested && (
            <span className="text-[9px] text-yellow-400 bg-black/40 px-1.5 py-0.5 rounded animate-pulse">
              Contested
            </span>
          )}
        </div>
      </div>

      {/* Action feedback overlay */}
      {displayAction && displayAction !== 'none' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 animate-bounce-in">
            <span className={`text-sm font-bold drop-shadow ${ACTION_FEEDBACK[displayAction].color}`}>
              {ACTION_FEEDBACK[displayAction].label}
            </span>
          </div>
        </div>
      )}

      {/* Score flash animation */}
      {showScoreFlash && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="text-2xl font-bold text-green-400 drop-shadow animate-score-flash">
            +1
          </span>
        </div>
      )}
    </button>
  );
}
