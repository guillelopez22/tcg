'use client';

/**
 * TurnControls — ABCD phase indicator, Next Turn button, undo, pause, concede.
 *
 * Renders a compact control strip for the active match board.
 */

import { useState } from 'react';
import type { MatchPhaseInput } from '@la-grieta/shared';

interface TurnControlsProps {
  phase: MatchPhaseInput;
  activePlayerId: string;
  myPlayerId: string;
  turnNumber: number;
  onAdvancePhase: () => void;
  onAdvanceTurn: () => void;
  onPause: () => void;
  onEndMatch: (winnerId: string | null, reason: 'concession') => void;
  onUndo: () => void;
  disabled?: boolean;
  /** In local mode both players share one device — never block controls */
  localMode?: boolean;
}

const PHASE_LABELS: Record<MatchPhaseInput, string> = {
  A: 'Awaken',
  B: 'Beginning',
  C: 'Channel',
  D: 'Draw',
};

const NEXT_PHASE: Record<MatchPhaseInput, MatchPhaseInput> = {
  A: 'B',
  B: 'C',
  C: 'D',
  D: 'A',
};

export function TurnControls({
  phase,
  activePlayerId,
  myPlayerId,
  turnNumber,
  onAdvancePhase,
  onAdvanceTurn,
  onPause,
  onEndMatch,
  onUndo,
  disabled = false,
  localMode = false,
}: TurnControlsProps) {
  const [showConcedeDialog, setShowConcedeDialog] = useState(false);
  const isMyTurn = localMode || activePlayerId === myPlayerId;

  function handleConcedeConfirm() {
    setShowConcedeDialog(false);
    onEndMatch(null, 'concession');
  }

  return (
    <>
      {/* First-turn rune reminder */}
      {turnNumber === 1 && phase === 'C' && (
        <div className="text-center text-[10px] bg-rift-900/50 text-rift-400 px-2 py-1 rounded border border-rift-700/40 mb-1">
          First turn: draw 3 runes instead of 2
        </div>
      )}

      {/* Not-my-turn indicator */}
      {!isMyTurn && (
        <div className="text-center text-xs text-zinc-500 mb-1">
          Opponent&apos;s turn
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={disabled}
          title="Undo last action (5s window)"
          className="p-2 rounded-lg border border-surface-border text-zinc-400 hover:text-white hover:border-rift-500 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>

        {/* Phase advance or End Turn */}
        {phase === 'D' ? (
          <button
            onClick={onAdvanceTurn}
            disabled={disabled || !isMyTurn}
            className="flex-1 lg-btn-primary py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            End Turn
          </button>
        ) : (
          <button
            onClick={onAdvancePhase}
            disabled={disabled || !isMyTurn}
            className="flex-1 lg-btn-secondary py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {phase} → {NEXT_PHASE[phase]}
            <span className="ml-1 text-zinc-400 text-xs">({PHASE_LABELS[NEXT_PHASE[phase]]})</span>
          </button>
        )}

        {/* Pause */}
        <button
          onClick={onPause}
          disabled={disabled}
          title="Pause match"
          className="p-2 rounded-lg border border-surface-border text-zinc-400 hover:text-white hover:border-yellow-500 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Concede */}
        <button
          onClick={() => setShowConcedeDialog(true)}
          disabled={disabled}
          title="Concede match"
          className="p-2 rounded-lg border border-red-800/50 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        </button>
      </div>

      {/* Concede confirmation dialog */}
      {showConcedeDialog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="lg-card p-5 space-y-4 w-full max-w-sm">
            <p className="text-base font-semibold text-white">Concede Match?</p>
            <p className="text-sm text-zinc-400">
              Are you sure? This will end the match as a concession.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConcedeDialog(false)}
                className="flex-1 lg-btn-secondary py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConcedeConfirm}
                className="flex-1 lg-btn-danger py-2 text-sm"
              >
                Concede
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
