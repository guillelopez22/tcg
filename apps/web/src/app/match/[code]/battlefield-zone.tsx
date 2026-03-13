'use client';

/**
 * BattlefieldZone — tappable battlefield card with card art background,
 * control state color ring, and haptic feedback on tap.
 */

import { useState } from 'react';

interface BattlefieldZoneProps {
  index: number;
  control: string; // 'uncontrolled' | 'contested' | playerId
  playerColors: Record<string, string>;
  cardArt?: string | null;
  cardName?: string | null;
  onTap: (index: number) => void;
  disabled?: boolean;
  /** Flash "+1" when score triggers */
  showScoreFlash?: boolean;
}

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

export function BattlefieldZone({
  index,
  control,
  playerColors,
  cardArt,
  cardName,
  onTap,
  disabled = false,
  showScoreFlash = false,
}: BattlefieldZoneProps) {
  const [isFlashing, setIsFlashing] = useState(false);

  const playerColor = playerColors[control];

  const borderClass =
    control === 'uncontrolled'
      ? CONTROL_STYLES.uncontrolled
      : control === 'contested'
        ? CONTROL_STYLES.contested
        : (COLOR_BORDER[playerColor ?? ''] ?? 'border-rift-500');

  const overlayClass =
    control !== 'uncontrolled' && control !== 'contested' && playerColor
      ? (COLOR_OVERLAY[playerColor] ?? 'bg-rift-900/30')
      : '';

  function handleTap() {
    if (disabled) return;

    // Haptic feedback on tap
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    onTap(index);
  }

  return (
    <button
      onClick={handleTap}
      disabled={disabled}
      className={`
        relative flex-1 min-h-32 rounded-xl border-2 overflow-hidden
        transition-all duration-150 active:scale-[0.97]
        ${borderClass}
        ${disabled ? 'opacity-60 pointer-events-none' : 'cursor-pointer hover:opacity-90'}
        ${isFlashing ? 'brightness-125' : ''}
      `}
      aria-label={`Battlefield ${index + 1}: ${control === 'uncontrolled' ? 'Uncontrolled' : control === 'contested' ? 'Contested' : 'Controlled'}`}
    >
      {/* Card art background */}
      {cardArt ? (
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
      {control === 'contested' && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #eab308 0px, #eab308 4px, transparent 4px, transparent 12px)',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-3 gap-1">
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider drop-shadow">
          BF {index + 1}
        </span>
        {cardName && (
          <span className="text-xs text-white/70 text-center drop-shadow line-clamp-2 max-w-[120px]">
            {cardName}
          </span>
        )}
        {control === 'uncontrolled' && (
          <span className="text-[10px] text-zinc-400">Tap to claim</span>
        )}
        {control === 'contested' && (
          <span className="text-[10px] text-yellow-400">Contested</span>
        )}
      </div>

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
