'use client';

/**
 * useMatchSocket — React hook for Socket.IO match state management.
 *
 * Connects to the /match namespace via getMatchSocket(code),
 * listens for server events, and exposes typed emit helpers.
 */

import { useState, useEffect, useCallback } from 'react';
import { getMatchSocket, disconnectMatchSocket } from '@/lib/match-socket';
import type { MatchStatePayload, MatchEndedPayload } from '@/lib/match-socket';
import type { MatchState, PlayerScore } from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// Re-exports for consumers
// ---------------------------------------------------------------------------

export type { MatchEndedPayload };

export interface UseMatchSocketReturn {
  /** Full session state from state:full (initial load + session metadata) */
  fullState: MatchStatePayload | null;
  /** Scoring engine state from state:patch (incremental updates) */
  matchState: MatchState | null;
  /** Live player scores derived from matchState, falls back to fullState */
  players: PlayerScore[];
  isConnected: boolean;
  isReconnecting: boolean;
  /** Set when match:ended fires */
  matchEndedPayload: MatchEndedPayload | null;

  // Emit helpers
  tapBattlefield: (bfIndex: number, playerId: string) => void;
  advancePhase: (playerId: string) => void;
  advanceTurn: () => void;
  pauseMatch: () => void;
  endMatch: (winnerId: string | null, reason: 'score' | 'concession') => void;
  undoAction: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useMatchSocket(code: string): UseMatchSocketReturn {
  const [fullState, setFullState] = useState<MatchStatePayload | null>(null);
  const [matchState, setMatchState] = useState<MatchState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [matchEndedPayload, setMatchEndedPayload] = useState<MatchEndedPayload | null>(null);

  useEffect(() => {
    const socket = getMatchSocket(code);

    // Connection events
    const handleConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
    };
    const handleDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    // state:full — MatchWithPlayers (full session on connect)
    const handleStateFull = (payload: MatchStatePayload) => {
      setFullState(payload);
      if (payload.state) {
        setMatchState(payload.state);
      }
      setIsConnected(true);
    };

    // state:patch — MatchState (incremental updates from scoring engine)
    const handleStatePatch = (payload: MatchState) => {
      setMatchState(payload);
    };

    // match:ended — MatchSummary from the API
    const handleMatchEnded = (payload: MatchEndedPayload) => {
      setMatchEndedPayload(payload);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('state:full', handleStateFull);
    socket.on('state:patch', handleStatePatch);
    socket.on('match:ended', handleMatchEnded);

    // If socket is already connected, mark as connected
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('state:full', handleStateFull);
      socket.off('state:patch', handleStatePatch);
      socket.off('match:ended', handleMatchEnded);
      disconnectMatchSocket();
    };
  }, [code]);

  // Derive players: prefer matchState.players (live scores) over fullState.players
  const players: PlayerScore[] = matchState?.players ?? [];

  // ---------------------------------------------------------------------------
  // Emit helpers
  // ---------------------------------------------------------------------------

  const tapBattlefield = useCallback(
    (bfIndex: number, playerId: string) => {
      const socket = getMatchSocket(code);
      socket.emit('battlefield:tap', { code, battlefieldIndex: bfIndex, playerId });
    },
    [code],
  );

  const advancePhase = useCallback(
    (playerId: string) => {
      const socket = getMatchSocket(code);
      socket.emit('phase:advance', { code, playerId });
    },
    [code],
  );

  const advanceTurn = useCallback(() => {
    const socket = getMatchSocket(code);
    socket.emit('turn:advance', { code });
  }, [code]);

  const pauseMatch = useCallback(() => {
    const socket = getMatchSocket(code);
    socket.emit('match:pause', { code });
  }, [code]);

  const endMatch = useCallback(
    (winnerId: string | null, reason: 'score' | 'concession') => {
      const socket = getMatchSocket(code);
      socket.emit('match:end', { code, winnerId, reason });
    },
    [code],
  );

  const undoAction = useCallback(() => {
    const socket = getMatchSocket(code);
    socket.emit('match:undo', { code });
  }, [code]);

  return {
    fullState,
    matchState,
    players,
    isConnected,
    isReconnecting,
    matchEndedPayload,
    tapBattlefield,
    advancePhase,
    advanceTurn,
    pauseMatch,
    endMatch,
    undoAction,
  };
}
