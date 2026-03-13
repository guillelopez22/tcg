'use client';

/**
 * MatchEndOverlay — win celebration with confetti, victory chime, and score summary.
 *
 * Fires confetti and haptic feedback on mount. Provides Rematch and End Session actions.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface FinalScore {
  playerId: string;
  displayName: string;
  score: number;
}

interface MatchEndOverlayProps {
  winnerId: string | null;
  winnerName: string | null;
  isConcession: boolean;
  finalScores: FinalScore[];
  onRematch?: () => void;
}

function playVictoryChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Simple ascending victory chime: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch {
    // AudioContext not available — silent fallback
  }
}

export function MatchEndOverlay({
  winnerId,
  winnerName,
  isConcession,
  finalScores,
  onRematch,
}: MatchEndOverlayProps) {
  const router = useRouter();

  useEffect(() => {
    const isWin = !!winnerId;

    // Confetti
    if (isWin) {
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 200,
          spread: 70,
          origin: { y: 0.6 },
        });
      }).catch(() => {
        // Optional — confetti failure is non-blocking
      });
    }

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (isWin) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      } else {
        navigator.vibrate(100);
      }
    }

    // Victory chime (only for wins, not draws)
    if (isWin) {
      playVictoryChime();
    }
  }, [winnerId]);

  function handleEnd() {
    router.push('/match');
  }

  const title = isConcession
    ? `${winnerName ?? 'Opponent'} wins by concession`
    : winnerId
    ? `${winnerName ?? 'Player'} Wins!`
    : 'Match Drawn';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="lg-card p-6 mx-4 w-full max-w-sm text-center space-y-5">
        {/* Title */}
        <div className="space-y-1">
          {winnerId && (
            <div className="text-4xl mb-2">
              {/* Trophy icon */}
              <svg className="w-12 h-12 mx-auto text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V18H8v2h8v-2h-3v-2.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zm-2 3.82A5.002 5.002 0 0117 9V7h2v1c0 .97-.37 1.85-.95 2.47L17 10.82zm-10 0L5.95 9.47A3.985 3.985 0 015 8V7h2v2c0 .31.04.6.09.88L7 10.82z" />
              </svg>
            </div>
          )}
          <p className="text-2xl font-bold text-white">{title}</p>
        </div>

        {/* Final scores */}
        <div className="space-y-2">
          {finalScores.map((s) => (
            <div
              key={s.playerId}
              className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                s.playerId === winnerId
                  ? 'bg-rift-900/40 border border-rift-700/40'
                  : 'bg-surface-elevated'
              }`}
            >
              <span className="text-sm text-zinc-200">{s.displayName}</span>
              <span className={`text-sm font-bold ${s.playerId === winnerId ? 'text-rift-400' : 'text-zinc-300'}`}>
                {s.score} pts
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onRematch && (
            <button onClick={onRematch} className="flex-1 lg-btn-primary py-2.5 text-sm">
              Rematch
            </button>
          )}
          <button onClick={handleEnd} className="flex-1 lg-btn-secondary py-2.5 text-sm">
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}
