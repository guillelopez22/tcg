'use client';

/**
 * ScoreDisplay — shows a player's score in "N/target" format with
 * color accent, player name, and a glow pulse when it's their turn.
 */

interface ScoreDisplayProps {
  playerName: string;
  score: number;
  winTarget: number;
  color: string;
  isCurrentTurn: boolean;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: 'border-blue-500 ring-blue-500/30',
  red: 'border-red-500 ring-red-500/30',
  green: 'border-green-500 ring-green-500/30',
  yellow: 'border-yellow-500 ring-yellow-500/30',
};

const COLOR_TEXT: Record<string, string> = {
  blue: 'text-blue-400',
  red: 'text-red-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
};

export function ScoreDisplay({
  playerName,
  score,
  winTarget,
  color,
  isCurrentTurn,
}: ScoreDisplayProps) {
  const borderClass = COLOR_CLASSES[color] ?? 'border-rift-500 ring-rift-500/30';
  const textClass = COLOR_TEXT[color] ?? 'text-rift-400';

  return (
    <div
      className={`
        flex flex-col items-center px-4 py-2 rounded-xl border-2
        transition-all duration-300
        ${borderClass}
        ${isCurrentTurn ? 'ring-2 shadow-lg animate-pulse-slow' : ''}
      `}
    >
      <span className="text-xs text-zinc-400 font-medium truncate max-w-[120px]">{playerName}</span>
      <span className={`text-3xl font-bold leading-none mt-0.5 ${textClass}`}>
        {score}
        <span className="text-base font-normal text-zinc-500">/{winTarget}</span>
      </span>
      {isCurrentTurn && (
        <span className="text-[10px] text-zinc-500 mt-0.5">Your turn</span>
      )}
    </div>
  );
}
