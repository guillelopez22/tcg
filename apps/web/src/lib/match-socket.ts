/**
 * Socket.IO singleton client for match real-time sync.
 *
 * Uses the /match namespace on the API server.
 * Designed for the web client — call getMatchSocket(code) to connect,
 * disconnectMatchSocket() when leaving a match.
 */

import { io, type Socket } from 'socket.io-client';
import type { MatchState } from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// Typed event interfaces
// ---------------------------------------------------------------------------

export interface BattlefieldSubmitPayload {
  playerId: string;
  cardIds: string[];
}

export interface BattlefieldSubmittedPayload {
  playerId: string;
  submitted: true;
}

export interface BattlefieldRevealCard {
  cardId: string;
  cardName: string;
  imageSmall: string | null;
  imageLarge: string | null;
}

export interface BattlefieldRevealPayload {
  battlefields: Array<{
    index: number;
    playerId: string;
    cards: BattlefieldRevealCard[];
  }>;
}

export interface MatchPlayerJoinedPayload {
  playerId: string;
  displayName: string;
  role: 'player' | 'spectator';
}

export interface MatchStatePayload {
  sessionId: string;
  code: string;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  format: '1v1' | '2v2' | 'ffa';
  state: MatchState | null;
  players: Array<{
    id: string;
    displayName: string;
    role: string;
    color: string;
    finalScore: number | null;
    isWinner: boolean;
  }>;
  winnerId: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface MatchEndedPayload {
  winnerId: string | null;
  winnerName: string | null;
  isConcession: boolean;
  finalScores: Array<{ playerId: string; displayName: string; score: number }>;
}

export interface PlayerDisconnectedPayload {
  socketId: string;
}

// ---------------------------------------------------------------------------
// Typed socket
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  /** Initial full match state on connection (MatchWithPlayers from API) */
  'state:full': (payload: MatchStatePayload) => void;
  /** Incremental state update (MatchState from scoring engine) */
  'state:patch': (payload: MatchState) => void;
  /** A player disconnected from the socket */
  'player:disconnected': (payload: PlayerDisconnectedPayload) => void;
  /** Match has ended */
  'match:ended': (payload: MatchEndedPayload) => void;
  /** Battlefield submission acknowledged */
  'battlefield:submitted': (payload: BattlefieldSubmittedPayload) => void;
  /** All battlefields revealed simultaneously */
  'battlefield:reveal': (payload: BattlefieldRevealPayload) => void;
  /** Player joined (legacy) */
  'match:player-joined': (payload: MatchPlayerJoinedPayload) => void;
  /** Error from server */
  'error': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  /** Submit battlefield card IDs (setup phase) */
  'battlefield:submit': (payload: BattlefieldSubmitPayload) => void;
  /** Set battlefields directly for local mode (single submission, all cards) */
  'battlefield:set-local': (payload: { code: string; cardIds: string[] }) => void;
  /** Tap a battlefield to cycle its control */
  'battlefield:tap': (payload: { code: string; battlefieldIndex: number; playerId: string }) => void;
  /** Advance current phase (A->B->C->D->A) */
  'phase:advance': (payload: { code: string; playerId: string }) => void;
  /** Advance to next player's turn */
  'turn:advance': (payload: { code: string }) => void;
  /** Toggle match pause */
  'match:pause': (payload: { code: string }) => void;
  /** End match (by score or concession) */
  'match:end': (payload: { code: string; winnerId: string | null; reason: 'score' | 'concession' }) => void;
  /** Undo last action */
  'match:undo': (payload: { code: string }) => void;
  /** Keep-alive ping */
  'match:ping': () => void;
}

export type MatchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let _socket: MatchSocket | null = null;

/**
 * Returns the existing socket if connected to the same code,
 * otherwise creates a new Socket.IO connection to the /match namespace.
 */
export function getMatchSocket(code: string): MatchSocket {
  if (_socket?.connected) {
    return _socket;
  }

  // Disconnect stale socket if any
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  const apiBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '')
      : '') || window.location.origin.replace(':3000', ':3001');

  _socket = io(`${apiBase}/match`, {
    query: { code },
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket'],
  }) as MatchSocket;

  return _socket;
}

/**
 * Disconnects and nulls the singleton socket.
 * Call when leaving a match or unmounting the match view.
 */
export function disconnectMatchSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/**
 * Returns true if a socket exists and is currently connected.
 */
export function isMatchSocketConnected(): boolean {
  return _socket?.connected ?? false;
}
