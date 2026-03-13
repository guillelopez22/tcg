/**
 * Socket.IO singleton client for match real-time sync.
 *
 * Uses the /match namespace on the API server.
 * Designed for the web client — call getMatchSocket(code) to connect,
 * disconnectMatchSocket() when leaving a match.
 */

import { io, type Socket } from 'socket.io-client';

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
  players: Array<{
    id: string;
    displayName: string;
    role: string;
    color: string;
    score: number;
  }>;
}

export interface MatchEndedPayload {
  winnerId: string | null;
  winnerName: string | null;
  isConcession: boolean;
  finalScores: Array<{ playerId: string; displayName: string; score: number }>;
}

// ---------------------------------------------------------------------------
// Typed socket
// ---------------------------------------------------------------------------

export interface ServerToClientEvents {
  'battlefield:submitted': (payload: BattlefieldSubmittedPayload) => void;
  'battlefield:reveal': (payload: BattlefieldRevealPayload) => void;
  'match:player-joined': (payload: MatchPlayerJoinedPayload) => void;
  'match:state': (payload: MatchStatePayload) => void;
  'match:ended': (payload: MatchEndedPayload) => void;
  'error': (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  'battlefield:submit': (payload: BattlefieldSubmitPayload) => void;
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
