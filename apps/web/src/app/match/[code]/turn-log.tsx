'use client';

/**
 * TurnLog — collapsible turn history panel.
 *
 * Shows a scrollable list of match log entries, auto-scrolling to
 * the latest entry. Hidden by default with a toggle button.
 */

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  turn: number;
  phase: string;
  event: string;
  timestamp: number;
}

interface TurnLogProps {
  turnHistory: LogEntry[];
}

export function TurnLog({ turnHistory }: TurnLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive and panel is open
  useEffect(() => {
    if (isExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turnHistory, isExpanded]);

  function formatEvent(entry: LogEntry): string {
    const evt = entry.event;
    if (evt.startsWith('conquest:')) {
      const [, bfIndex, playerId] = evt.split(':');
      return `conquered BF${Number(bfIndex ?? 0) + 1} (+1) — player ${playerId?.slice(0, 6) ?? '?'}`;
    }
    if (evt === 'paused') return 'match paused';
    if (evt === 'phase_advanced') return `advanced to ${entry.phase}`;
    return evt;
  }

  return (
    <div className="border-t border-surface-border/50">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <span>Turn History ({turnHistory.length})</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* History list */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="max-h-40 overflow-y-auto px-3 pb-2 space-y-0.5"
        >
          {turnHistory.length === 0 ? (
            <p className="text-xs text-zinc-600 py-1">No events yet</p>
          ) : (
            turnHistory.map((entry, i) => (
              <div key={i} className="text-[11px] text-zinc-400 leading-relaxed">
                <span className="text-zinc-600 mr-1">
                  T{entry.turn}/{entry.phase}:
                </span>
                {formatEvent(entry)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
