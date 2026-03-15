'use client';

// VerticalScoreTracker — per-player score bubble column

const PLAYER_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400' },
  red: { bg: 'bg-red-500', border: 'border-red-500', text: 'text-red-400' },
  green: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400' },
  yellow: { bg: 'bg-yellow-400', border: 'border-yellow-400', text: 'text-yellow-400' },
};

interface VerticalScoreTrackerProps {
  score: number;
  winTarget: number;
  color: string;
  side: 'left' | 'right';
}

export function VerticalScoreTracker({ score, winTarget, color, side }: VerticalScoreTrackerProps) {
  const colorClasses = PLAYER_COLOR_CLASSES[color] ?? PLAYER_COLOR_CLASSES.blue!;
  const max = Math.max(winTarget, 8);
  const points = Array.from({ length: max + 1 }, (_, i) => i);

  return (
    <div className={`flex flex-col items-center gap-[3px] py-1 px-1 ${side === 'left' ? 'items-start' : 'items-end'}`}>
      {[...points].reverse().map((point) => {
        const isCurrent = point === score;
        const isFilled = point <= score;
        return (
          <div
            key={point}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all border
              ${isCurrent ? `${colorClasses.bg} border-transparent text-white scale-110 shadow-sm`
                : isFilled ? `${colorClasses.bg} border-transparent text-white opacity-60`
                : 'bg-[#0a1628] border-[#c5a84a]/30 text-[#c5a84a]/40'}`}
          >
            {point}
          </div>
        );
      })}
    </div>
  );
}
