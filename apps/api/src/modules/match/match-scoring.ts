/**
 * Pure match scoring engine — no I/O, no side effects, no DI.
 * All functions take state in and return new state out (immutable).
 */
import {
  WIN_TARGET_1V1,
  WIN_TARGET_2V2,
  WIN_TARGET_FFA,
  BATTLEFIELDS_1V1,
  BATTLEFIELDS_2V2,
  BATTLEFIELDS_FFA,
  UNCONTROLLED,
  CONTESTED,
  PLAYER_COLORS,
} from '@la-grieta/shared';
import type {
  MatchState,
  MatchFormatInput,
  MatchPhaseInput,
  WinValidationResult,
  BattlefieldControl,
  PlayerColor,
} from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

/**
 * Create the initial MatchState for a new match.
 *
 * @param format - '1v1' | '2v2' | 'ffa'
 * @param playerIds - ordered list of player UUIDs (index 0 = first color assigned)
 * @param firstPlayerId - which player goes first
 * @param overrides - optional field overrides for testing
 */
export function createInitialState(
  format: MatchFormatInput,
  playerIds: string[],
  firstPlayerId: string,
  overrides: Partial<MatchState> = {},
): MatchState {
  const winTarget = getWinTarget(format);
  const bfCount = getBattlefieldCount(format);

  const players = playerIds.map((id, i) => ({
    playerId: id,
    displayName: id,
    score: 0,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length] as PlayerColor,
    teamId: null,
  }));

  const battlefields = Array.from({ length: bfCount }, (_, i) => ({
    index: i,
    control: UNCONTROLLED as BattlefieldControl,
    cardId: null,
  }));

  return {
    format,
    phase: 'A' as MatchPhaseInput,
    turnNumber: 1,
    activePlayerId: firstPlayerId,
    firstPlayerId,
    winTarget,
    players,
    battlefields,
    conqueredThisTurn: [],
    log: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// cycleBattlefieldControl
// ---------------------------------------------------------------------------

/**
 * Cycle battlefield control:
 *   uncontrolled -> player[0] -> player[1] -> ... -> player[n-1] -> contested -> uncontrolled
 */
export function cycleBattlefieldControl(
  current: BattlefieldControl,
  playerIds: string[],
): BattlefieldControl {
  if (current === UNCONTROLLED) {
    return playerIds[0] as BattlefieldControl;
  }

  if (current === CONTESTED) {
    return UNCONTROLLED;
  }

  // current is a playerId
  const idx = playerIds.indexOf(current);
  if (idx === -1) {
    // Unknown player — reset to uncontrolled
    return UNCONTROLLED;
  }

  const next = idx + 1;
  if (next < playerIds.length) {
    return playerIds[next] as BattlefieldControl;
  }

  // Last player -> contested
  return CONTESTED;
}

// ---------------------------------------------------------------------------
// scoreConquest
// ---------------------------------------------------------------------------

/**
 * Award +1 to the conquerer when they take control of a battlefield.
 * Updates the battlefield's control to the conquerer's ID.
 * Records the battlefield index in conqueredThisTurn.
 */
export function scoreConquest(
  state: MatchState,
  bfIndex: number,
  newControllerId: string,
): MatchState {
  const players = state.players.map((p) =>
    p.playerId === newControllerId ? { ...p, score: p.score + 1 } : { ...p },
  );

  const battlefields = state.battlefields.map((bf, i) =>
    i === bfIndex ? { ...bf, control: newControllerId as BattlefieldControl } : { ...bf },
  );

  const conqueredThisTurn = [...state.conqueredThisTurn, bfIndex];

  return { ...state, players, battlefields, conqueredThisTurn };
}

// ---------------------------------------------------------------------------
// scoreBeginningPhase
// ---------------------------------------------------------------------------

/**
 * During the Beginning (B) phase, award +1 per controlled battlefield
 * to each player who controls at least one battlefield.
 * Contested and uncontrolled battlefields do not score.
 */
export function scoreBeginningPhase(state: MatchState): MatchState {
  const delta: Record<string, number> = {};

  for (const bf of state.battlefields) {
    if (bf.control !== UNCONTROLLED && bf.control !== CONTESTED) {
      delta[bf.control] = (delta[bf.control] ?? 0) + 1;
    }
  }

  const players = state.players.map((p) => ({
    ...p,
    score: p.score + (delta[p.playerId] ?? 0),
  }));

  return { ...state, players };
}

// ---------------------------------------------------------------------------
// validateWinCondition
// ---------------------------------------------------------------------------

/**
 * Check whether a candidate winner satisfies the 8th point rule.
 *
 * The final winning point must come from:
 *   (a) Holding at least 1 battlefield (scored during Beginning phase), OR
 *   (b) Conquering ALL battlefields in the same turn
 *
 * @param state - current game state (BEFORE the potentially winning score is applied)
 * @param candidateWinnerId - playerId who wants to claim victory
 * @param conqueredAllThisTurn - caller signals whether candidate conquered every BF this turn
 */
export function validateWinCondition(
  state: MatchState,
  candidateWinnerId: string,
  conqueredAllThisTurn: boolean,
): WinValidationResult {
  const player = state.players.find((p) => p.playerId === candidateWinnerId);

  if (!player) {
    return { valid: false, reason: 'Player not found in state' };
  }

  // Must be at exactly winTarget - 1 (one point away from winning)
  if (player.score !== state.winTarget - 1) {
    return {
      valid: false,
      reason: `Player score ${player.score} must be ${state.winTarget - 1} to trigger win condition check`,
    };
  }

  // Path (b): conquered ALL battlefields this turn
  if (conqueredAllThisTurn) {
    return { valid: true };
  }

  // Path (a): currently holds at least 1 battlefield (non-contested, non-uncontrolled)
  const controlledCount = state.battlefields.filter(
    (bf) => bf.control === candidateWinnerId,
  ).length;

  if (controlledCount > 0) {
    return { valid: true };
  }

  return {
    valid: false,
    reason:
      '8th point rule: the final winning point must come from holding a battlefield or conquering all battlefields in one turn',
  };
}

// ---------------------------------------------------------------------------
// advancePhase
// ---------------------------------------------------------------------------

const PHASE_CYCLE: Record<string, MatchPhaseInput> = {
  A: 'B',
  B: 'C',
  C: 'D',
  D: 'A',
};

/**
 * Advance to the next ABCD phase. Wraps D -> A.
 */
export function advancePhase(current: MatchPhaseInput): MatchPhaseInput {
  return PHASE_CYCLE[current] ?? 'A';
}

// ---------------------------------------------------------------------------
// advanceTurn
// ---------------------------------------------------------------------------

/**
 * Advance to the next player's turn:
 *   - Increment turnNumber
 *   - Set activePlayerId to the next player (wrapping)
 *   - Reset phase to 'A'
 *   - Clear conqueredThisTurn
 */
export function advanceTurn(state: MatchState): MatchState {
  const playerIds = state.players.map((p) => p.playerId);
  const currentIdx = playerIds.indexOf(state.activePlayerId);
  const nextIdx = (currentIdx + 1) % playerIds.length;

  return {
    ...state,
    turnNumber: state.turnNumber + 1,
    activePlayerId: playerIds[nextIdx] as string,
    phase: 'A',
    conqueredThisTurn: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWinTarget(format: MatchFormatInput): number {
  switch (format) {
    case '1v1':
      return WIN_TARGET_1V1;
    case '2v2':
      return WIN_TARGET_2V2;
    case 'ffa':
      return WIN_TARGET_FFA;
  }
}

function getBattlefieldCount(format: MatchFormatInput): number {
  switch (format) {
    case '1v1':
      return BATTLEFIELDS_1V1;
    case '2v2':
      return BATTLEFIELDS_2V2;
    case 'ffa':
      return BATTLEFIELDS_FFA;
  }
}
