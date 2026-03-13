import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  cycleBattlefieldControl,
  scoreConquest,
  scoreBeginningPhase,
  validateWinCondition,
  advancePhase,
  advanceTurn,
} from '../src/modules/match/match-scoring';
import {
  WIN_TARGET_1V1,
  WIN_TARGET_2V2,
  WIN_TARGET_FFA,
  BATTLEFIELDS_1V1,
  BATTLEFIELDS_2V2,
  BATTLEFIELDS_FFA,
  UNCONTROLLED,
  CONTESTED,
} from '@la-grieta/shared';
import type { MatchState } from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const PLAYER_A = '00000000-0000-0000-0000-000000000001';
const PLAYER_B = '00000000-0000-0000-0000-000000000002';
const PLAYER_C = '00000000-0000-0000-0000-000000000003';
const PLAYER_D = '00000000-0000-0000-0000-000000000004';

function makeState(overrides: Partial<MatchState> = {}): MatchState {
  return createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_A, overrides);
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('createInitialState', () => {
  it('1v1 returns 2 battlefields all uncontrolled', () => {
    const state = createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_A);
    expect(state.battlefields).toHaveLength(BATTLEFIELDS_1V1);
    expect(state.battlefields.every((bf) => bf.control === UNCONTROLLED)).toBe(true);
  });

  it('1v1 sets win target to 8', () => {
    const state = createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_A);
    expect(state.winTarget).toBe(WIN_TARGET_1V1);
  });

  it('2v2 returns 3 battlefields', () => {
    const state = createInitialState('2v2', [PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D], PLAYER_A);
    expect(state.battlefields).toHaveLength(BATTLEFIELDS_2V2);
  });

  it('2v2 sets win target to 11', () => {
    const state = createInitialState('2v2', [PLAYER_A, PLAYER_B, PLAYER_C, PLAYER_D], PLAYER_A);
    expect(state.winTarget).toBe(WIN_TARGET_2V2);
  });

  it('ffa returns 3 battlefields', () => {
    const state = createInitialState('ffa', [PLAYER_A, PLAYER_B, PLAYER_C], PLAYER_A);
    expect(state.battlefields).toHaveLength(BATTLEFIELDS_FFA);
  });

  it('ffa sets win target to 8', () => {
    const state = createInitialState('ffa', [PLAYER_A, PLAYER_B, PLAYER_C], PLAYER_A);
    expect(state.winTarget).toBe(WIN_TARGET_FFA);
  });

  it('starts at phase A, turn 1', () => {
    const state = createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_A);
    expect(state.phase).toBe('A');
    expect(state.turnNumber).toBe(1);
  });

  it('sets activePlayerId to firstPlayerId', () => {
    const state = createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_B);
    expect(state.activePlayerId).toBe(PLAYER_B);
    expect(state.firstPlayerId).toBe(PLAYER_B);
  });

  it('initializes all player scores to 0', () => {
    const state = createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_A);
    expect(state.players.every((p) => p.score === 0)).toBe(true);
  });

  it('sets log and conqueredThisTurn to empty arrays', () => {
    const state = createInitialState('1v1', [PLAYER_A, PLAYER_B], PLAYER_A);
    expect(state.log).toEqual([]);
    expect(state.conqueredThisTurn).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// cycleBattlefieldControl
// ---------------------------------------------------------------------------

describe('cycleBattlefieldControl', () => {
  it('uncontrolled -> first player (playerIds[0])', () => {
    const result = cycleBattlefieldControl(UNCONTROLLED, [PLAYER_A, PLAYER_B]);
    expect(result).toBe(PLAYER_A);
  });

  it('first player -> second player (playerIds[1])', () => {
    const result = cycleBattlefieldControl(PLAYER_A, [PLAYER_A, PLAYER_B]);
    expect(result).toBe(PLAYER_B);
  });

  it('second player -> contested (for 1v1 with 2 players)', () => {
    const result = cycleBattlefieldControl(PLAYER_B, [PLAYER_A, PLAYER_B]);
    expect(result).toBe(CONTESTED);
  });

  it('contested -> uncontrolled', () => {
    const result = cycleBattlefieldControl(CONTESTED, [PLAYER_A, PLAYER_B]);
    expect(result).toBe(UNCONTROLLED);
  });

  it('in FFA with 3 players: cycles through all player IDs before contested', () => {
    const players = [PLAYER_A, PLAYER_B, PLAYER_C];
    expect(cycleBattlefieldControl(UNCONTROLLED, players)).toBe(PLAYER_A);
    expect(cycleBattlefieldControl(PLAYER_A, players)).toBe(PLAYER_B);
    expect(cycleBattlefieldControl(PLAYER_B, players)).toBe(PLAYER_C);
    expect(cycleBattlefieldControl(PLAYER_C, players)).toBe(CONTESTED);
    expect(cycleBattlefieldControl(CONTESTED, players)).toBe(UNCONTROLLED);
  });
});

// ---------------------------------------------------------------------------
// scoreConquest
// ---------------------------------------------------------------------------

describe('scoreConquest', () => {
  it('adds +1 to the conquerer score', () => {
    const state = makeState();
    const before = state.players.find((p) => p.playerId === PLAYER_A)!.score;
    const newState = scoreConquest(state, 0, PLAYER_A);
    const after = newState.players.find((p) => p.playerId === PLAYER_A)!.score;
    expect(after).toBe(before + 1);
  });

  it('updates the battlefield control to the conquerer', () => {
    const state = makeState();
    const newState = scoreConquest(state, 0, PLAYER_A);
    expect(newState.battlefields[0].control).toBe(PLAYER_A);
  });

  it('records the battlefield index in conqueredThisTurn', () => {
    const state = makeState();
    const newState = scoreConquest(state, 1, PLAYER_A);
    expect(newState.conqueredThisTurn).toContain(1);
  });

  it('does not mutate the original state (immutable)', () => {
    const state = makeState();
    const original = state.players.find((p) => p.playerId === PLAYER_A)!.score;
    scoreConquest(state, 0, PLAYER_A);
    expect(state.players.find((p) => p.playerId === PLAYER_A)!.score).toBe(original);
  });

  it('does not affect the other player score', () => {
    const state = makeState();
    const bBefore = state.players.find((p) => p.playerId === PLAYER_B)!.score;
    const newState = scoreConquest(state, 0, PLAYER_A);
    const bAfter = newState.players.find((p) => p.playerId === PLAYER_B)!.score;
    expect(bAfter).toBe(bBefore);
  });
});

// ---------------------------------------------------------------------------
// scoreBeginningPhase
// ---------------------------------------------------------------------------

describe('scoreBeginningPhase', () => {
  it('adds +1 per controlled battlefield to controlling player', () => {
    const state = makeState();
    // Set BF 0 controlled by A, BF 1 uncontrolled
    const withControl: MatchState = {
      ...state,
      battlefields: [
        { ...state.battlefields[0], control: PLAYER_A },
        { ...state.battlefields[1], control: UNCONTROLLED },
      ],
    };
    const scored = scoreBeginningPhase(withControl);
    const aScore = scored.players.find((p) => p.playerId === PLAYER_A)!.score;
    expect(aScore).toBe(1);
  });

  it('awards points to each controller when different players control each battlefield', () => {
    const state = makeState();
    const withControl: MatchState = {
      ...state,
      battlefields: [
        { ...state.battlefields[0], control: PLAYER_A },
        { ...state.battlefields[1], control: PLAYER_B },
      ],
    };
    const scored = scoreBeginningPhase(withControl);
    const aScore = scored.players.find((p) => p.playerId === PLAYER_A)!.score;
    const bScore = scored.players.find((p) => p.playerId === PLAYER_B)!.score;
    expect(aScore).toBe(1);
    expect(bScore).toBe(1);
  });

  it('does not award points for contested or uncontrolled battlefields', () => {
    const state = makeState();
    const withControl: MatchState = {
      ...state,
      battlefields: [
        { ...state.battlefields[0], control: CONTESTED },
        { ...state.battlefields[1], control: UNCONTROLLED },
      ],
    };
    const scored = scoreBeginningPhase(withControl);
    expect(scored.players.every((p) => p.score === 0)).toBe(true);
  });

  it('awards +2 for controlling both battlefields in 1v1', () => {
    const state = makeState();
    const withControl: MatchState = {
      ...state,
      battlefields: [
        { ...state.battlefields[0], control: PLAYER_A },
        { ...state.battlefields[1], control: PLAYER_A },
      ],
    };
    const scored = scoreBeginningPhase(withControl);
    const aScore = scored.players.find((p) => p.playerId === PLAYER_A)!.score;
    expect(aScore).toBe(2);
  });

  it('does not mutate the original state (immutable)', () => {
    const state = makeState();
    scoreBeginningPhase(state);
    expect(state.players.every((p) => p.score === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateWinCondition
// ---------------------------------------------------------------------------

describe('validateWinCondition', () => {
  function stateWithScores(aScore: number, bScore: number, bfControls: string[]): MatchState {
    const base = makeState();
    return {
      ...base,
      players: [
        { ...base.players[0], score: aScore },
        { ...base.players[1], score: bScore },
      ],
      battlefields: base.battlefields.map((bf, i) => ({
        ...bf,
        control: bfControls[i] ?? UNCONTROLLED,
      })),
    };
  }

  it('valid: player at winTarget-1 holds at least 1 BF (beginning phase win)', () => {
    // A needs 8 points, currently at 7, holds BF0 — scores +1 via beginning phase
    const state = stateWithScores(7, 0, [PLAYER_A, UNCONTROLLED]);
    const result = validateWinCondition(state, PLAYER_A, false);
    expect(result.valid).toBe(true);
  });

  it('invalid: player at winTarget-1 holds 0 BFs (8th point rule blocks)', () => {
    // A is at 7 but holds no battlefields — cannot score the 8th point via holding
    const state = stateWithScores(7, 0, [UNCONTROLLED, UNCONTROLLED]);
    const result = validateWinCondition(state, PLAYER_A, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('valid: player at winTarget-1 who conquered ALL battlefields this turn', () => {
    // A conquered all battlefields this turn — wins via conquest all
    const state: MatchState = {
      ...stateWithScores(7, 0, [PLAYER_A, PLAYER_A]),
      conqueredThisTurn: [0, 1],
    };
    const result = validateWinCondition(state, PLAYER_A, true);
    expect(result.valid).toBe(true);
  });

  it('invalid: player NOT at winTarget-1 cannot win even holding BFs', () => {
    // A is at 5, not at winTarget-1 (7)
    const state = stateWithScores(5, 0, [PLAYER_A, PLAYER_A]);
    const result = validateWinCondition(state, PLAYER_A, false);
    expect(result.valid).toBe(false);
  });

  it('8th point rule: player at winTarget-1 with contested BF cannot win via holding', () => {
    // A holds no non-contested BF — contested doesn't count
    const state = stateWithScores(7, 0, [CONTESTED, UNCONTROLLED]);
    const result = validateWinCondition(state, PLAYER_A, false);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// advancePhase
// ---------------------------------------------------------------------------

describe('advancePhase', () => {
  it('A -> B', () => expect(advancePhase('A')).toBe('B'));
  it('B -> C', () => expect(advancePhase('B')).toBe('C'));
  it('C -> D', () => expect(advancePhase('C')).toBe('D'));
  it('D -> A', () => expect(advancePhase('D')).toBe('A'));
});

// ---------------------------------------------------------------------------
// advanceTurn
// ---------------------------------------------------------------------------

describe('advanceTurn', () => {
  it('increments turnNumber', () => {
    const state = makeState();
    const newState = advanceTurn(state);
    expect(newState.turnNumber).toBe(state.turnNumber + 1);
  });

  it('resets phase to A', () => {
    const state: MatchState = { ...makeState(), phase: 'C' };
    const newState = advanceTurn(state);
    expect(newState.phase).toBe('A');
  });

  it('advances to next player (wraps from last to first)', () => {
    const state = makeState(); // activePlayer = PLAYER_A
    const newState = advanceTurn(state);
    expect(newState.activePlayerId).toBe(PLAYER_B);
  });

  it('wraps from last player back to first', () => {
    const state: MatchState = { ...makeState(), activePlayerId: PLAYER_B };
    const newState = advanceTurn(state);
    expect(newState.activePlayerId).toBe(PLAYER_A);
  });

  it('resets conqueredThisTurn', () => {
    const state: MatchState = { ...makeState(), conqueredThisTurn: [0, 1] };
    const newState = advanceTurn(state);
    expect(newState.conqueredThisTurn).toEqual([]);
  });

  it('does not mutate the original state', () => {
    const state = makeState();
    const origTurn = state.turnNumber;
    advanceTurn(state);
    expect(state.turnNumber).toBe(origTurn);
  });
});
