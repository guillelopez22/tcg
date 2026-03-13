import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchService } from '../src/modules/match/match.service';

// ---------------------------------------------------------------------------
// Mock @la-grieta/db table schema objects so drizzle expressions can be built
// ---------------------------------------------------------------------------

// We use vi.mock to provide stable column stubs for eq(), and(), etc.
vi.mock('@la-grieta/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@la-grieta/db')>();

  // Create a column stub that satisfies drizzle's eq() etc.
  function makeColStub(name: string) {
    return {
      name,
      table: { _: { name } },
      getSQL: () => ({ type: 'column', name }),
      // drizzle internal markers
      _: { name, isNotNull: false },
      mapFromDriverValue: (v: unknown) => v,
      mapToDriverValue: (v: unknown) => v,
      // make it look like a Column
      column: name,
    } as unknown;
  }

  const matchSessionsStub = {
    id: makeColStub('id'),
    code: makeColStub('code'),
    format: makeColStub('format'),
    status: makeColStub('status'),
    hostUserId: makeColStub('host_user_id'),
    winTarget: makeColStub('win_target'),
    state: makeColStub('state'),
    winnerId: makeColStub('winner_id'),
    startedAt: makeColStub('started_at'),
    endedAt: makeColStub('ended_at'),
    createdAt: makeColStub('created_at'),
    updatedAt: makeColStub('updated_at'),
    _: { name: 'match_sessions' },
  };

  const matchPlayersStub = {
    id: makeColStub('id'),
    sessionId: makeColStub('session_id'),
    userId: makeColStub('user_id'),
    displayName: makeColStub('display_name'),
    role: makeColStub('role'),
    color: makeColStub('color'),
    finalScore: makeColStub('final_score'),
    isWinner: makeColStub('is_winner'),
    guestName: makeColStub('guest_name'),
    teamId: makeColStub('team_id'),
    joinedAt: makeColStub('joined_at'),
    _: { name: 'match_players' },
  };

  const cardsStub = {
    id: makeColStub('id'),
    name: makeColStub('name'),
    imageSmall: makeColStub('image_small'),
    _: { name: 'cards' },
  };

  return {
    ...actual,
    matchSessions: matchSessionsStub,
    matchPlayers: matchPlayersStub,
    cards: cardsStub,
  };
});

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

type MockChain = Record<string, unknown>;

function makeMockDb() {
  const selectResults: unknown[][] = [];
  let selectIdx = 0;

  const insertResults: unknown[][] = [];
  let insertIdx = 0;

  const updateResults: unknown[][] = [];
  let updateIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const data = () => selectResults[capturedIdx] ?? [];

    const chain: MockChain = {};
    // Make chain itself thenable (for queries terminated at .from() or .where())
    chain['then'] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(data()).then(onFulfilled);
    chain['from'] = vi.fn().mockImplementation(() => {
      const fromChain: MockChain = {};
      fromChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(data()).then(onFulfilled);
      fromChain['where'] = vi.fn().mockImplementation(() => {
        const whereChain: MockChain = {};
        whereChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(data()).then(onFulfilled);
        whereChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
        whereChain['orderBy'] = vi.fn().mockImplementation(() => {
          const orderChain: MockChain = {};
          orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(data()).then(onFulfilled);
          orderChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
          return orderChain;
        });
        whereChain['innerJoin'] = vi.fn().mockImplementation(() => {
          const joinChain: MockChain = {};
          joinChain['where'] = vi.fn().mockImplementation(() => {
            const jWhere: MockChain = {};
            jWhere['then'] = (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve(data()).then(onFulfilled);
            jWhere['orderBy'] = vi.fn().mockImplementation(() => {
              const jOrder: MockChain = {};
              jOrder['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
              jOrder['then'] = (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(data()).then(onFulfilled);
              return jOrder;
            });
            jWhere['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
            return jWhere;
          });
          return joinChain;
        });
        return whereChain;
      });
      fromChain['innerJoin'] = vi.fn().mockImplementation(() => {
        const joinChain: MockChain = {};
        joinChain['where'] = vi.fn().mockImplementation(() => {
          const jWhere: MockChain = {};
          jWhere['then'] = (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(data()).then(onFulfilled);
          jWhere['orderBy'] = vi.fn().mockImplementation(() => {
            const jOrder: MockChain = {};
            jOrder['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
            jOrder['then'] = (onFulfilled: (v: unknown) => unknown) =>
              Promise.resolve(data()).then(onFulfilled);
            return jOrder;
          });
          jWhere['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
          return jWhere;
        });
        return joinChain;
      });
      fromChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
      fromChain['orderBy'] = vi.fn().mockImplementation(() => {
        const orderChain: MockChain = {};
        orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(data()).then(onFulfilled);
        orderChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
        return orderChain;
      });
      return fromChain;
    });
    chain['where'] = vi.fn().mockImplementation(() => {
      const whereChain: MockChain = {};
      whereChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(data()).then(onFulfilled);
      whereChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
      return whereChain;
    });
    chain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
    return chain;
  });

  const insert = vi.fn().mockImplementation(() => {
    const capturedIdx = insertIdx++;
    const chain: MockChain = {};
    chain['values'] = vi.fn().mockImplementation(() => {
      const valChain: MockChain = {};
      valChain['returning'] = vi.fn().mockResolvedValue(insertResults[capturedIdx] ?? []);
      valChain['onConflictDoUpdate'] = vi.fn().mockResolvedValue(undefined);
      valChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
      return valChain;
    });
    return chain;
  });

  const update = vi.fn().mockImplementation(() => {
    const capturedIdx = updateIdx++;
    const chain: MockChain = {};
    chain['set'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['returning'] = vi.fn().mockResolvedValue(updateResults[capturedIdx] ?? []);
    chain['then'] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(updateResults[capturedIdx] ?? []).then(onFulfilled);
    return chain;
  });

  return {
    select,
    insert,
    update,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
    _pushInsert: (...rows: unknown[][]) => { insertResults.push(...rows); },
    _pushUpdate: (...rows: unknown[][]) => { updateResults.push(...rows); },
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SESSION_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const PLAYER_ID_1 = '33333333-3333-3333-3333-333333333333';
const PLAYER_ID_2 = '44444444-4444-4444-4444-444444444444';
const CARD_ID_1 = '55555555-5555-5555-5555-555555555555';

const defaultState = {
  format: '1v1',
  phase: 'A',
  turnNumber: 1,
  activePlayerId: PLAYER_ID_1,
  firstPlayerId: PLAYER_ID_1,
  winTarget: 8,
  players: [
    { playerId: PLAYER_ID_1, displayName: 'Player 1', score: 0, color: 'blue', teamId: null },
    { playerId: PLAYER_ID_2, displayName: 'Player 2', score: 0, color: 'red', teamId: null },
  ],
  battlefields: [
    { index: 0, control: 'uncontrolled', cardId: null },
    { index: 1, control: 'uncontrolled', cardId: null },
    { index: 2, control: 'uncontrolled', cardId: null },
  ],
  conqueredThisTurn: [],
  log: [],
};

function makeSession(overrides: Partial<{
  id: string;
  code: string;
  format: string;
  status: string;
  hostUserId: string | null;
  winTarget: number;
  state: unknown;
  winnerId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? SESSION_ID,
    code: overrides.code ?? 'ABC123',
    format: overrides.format ?? '1v1',
    status: overrides.status ?? 'waiting',
    hostUserId: overrides.hostUserId ?? USER_ID,
    winTarget: overrides.winTarget ?? 8,
    state: overrides.state ?? defaultState,
    winnerId: overrides.winnerId ?? null,
    startedAt: overrides.startedAt ?? null,
    endedAt: overrides.endedAt ?? null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function makePlayer(overrides: Partial<{
  id: string;
  sessionId: string;
  userId: string | null;
  displayName: string;
  role: string;
  color: string;
  finalScore: number | null;
  isWinner: boolean;
}> = {}) {
  return {
    id: overrides.id ?? PLAYER_ID_1,
    sessionId: overrides.sessionId ?? SESSION_ID,
    userId: overrides.userId ?? USER_ID,
    guestName: null,
    displayName: overrides.displayName ?? 'Player 1',
    role: overrides.role ?? 'player',
    teamId: null,
    color: overrides.color ?? 'blue',
    finalScore: overrides.finalScore ?? null,
    isWinner: overrides.isWinner ?? false,
    joinedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatchService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: MatchService;

  beforeEach(() => {
    db = makeMockDb();
    service = new MatchService(db as never);
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create()', () => {
    it('should return a code and sessionId when match is created', async () => {
      const session = makeSession();
      db._pushInsert([session]); // matchSessions insert
      db._pushInsert([]); // matchPlayers insert

      const result = await service.create(USER_ID, {
        format: '1v1',
        mode: 'casual',
        playerNames: ['Alice', 'Bob'],
        firstPlayerId: PLAYER_ID_1,
      });

      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('sessionId');
      expect(typeof result.code).toBe('string');
      expect(result.code.length).toBe(6);
      expect(result.sessionId).toBe(SESSION_ID);
    });

    it('should allow guest (null userId) to create a match', async () => {
      const session = makeSession({ hostUserId: null });
      db._pushInsert([session]);
      db._pushInsert([]);

      const result = await service.create(null, {
        format: '1v1',
        mode: 'casual',
        playerNames: ['Guest 1', 'Guest 2'],
        firstPlayerId: PLAYER_ID_1,
      });

      expect(result.code).toBeTruthy();
      expect(result.sessionId).toBe(SESSION_ID);
    });

    it('should throw INTERNAL_SERVER_ERROR when DB insert fails to return session', async () => {
      db._pushInsert([]); // empty returning

      await expect(
        service.create(USER_ID, {
          format: '1v1',
          mode: 'casual',
          playerNames: ['Alice', 'Bob'],
          firstPlayerId: PLAYER_ID_1,
        }),
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
    });
  });

  // =========================================================================
  // join()
  // =========================================================================

  describe('join()', () => {
    it('should join an existing waiting match and return state', async () => {
      const session = makeSession({ status: 'waiting' });
      const player1 = makePlayer({ id: PLAYER_ID_1 });
      const player2 = makePlayer({ id: PLAYER_ID_2, displayName: 'NewPlayer', color: 'red' });

      db._pushSelect([session]); // select session by code
      db._pushSelect([player1]); // select existing players
      db._pushInsert([]); // insert new player
      // getFullState: select session + players
      db._pushSelect([session]);
      db._pushSelect([player1, player2]);

      const result = await service.join(null, {
        code: 'ABC123',
        displayName: 'NewPlayer',
        role: 'player',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('players');
      expect(result.players.length).toBeGreaterThan(0);
    });

    it('should throw NOT_FOUND when match code does not exist', async () => {
      db._pushSelect([]); // session not found

      await expect(
        service.join(null, { code: 'XXXXXX', displayName: 'Guest', role: 'player' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should throw NOT_FOUND when match is completed', async () => {
      db._pushSelect([makeSession({ status: 'completed' })]);

      await expect(
        service.join(null, { code: 'ABC123', displayName: 'Guest', role: 'player' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // =========================================================================
  // getById()
  // =========================================================================

  describe('getById()', () => {
    it('should return full match data by UUID', async () => {
      const session = makeSession();
      const player = makePlayer();

      db._pushSelect([session]);
      db._pushSelect([player]);

      const result = await service.getById(SESSION_ID);

      expect(result.id).toBe(SESSION_ID);
      expect(result.code).toBe('ABC123');
      expect(result.format).toBe('1v1');
      expect(result.players).toHaveLength(1);
      expect(result.players[0]!.displayName).toBe('Player 1');
    });

    it('should throw NOT_FOUND when session UUID does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.getById('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('should return state jsonb on the session', async () => {
      const session = makeSession({ state: defaultState });
      db._pushSelect([session]);
      db._pushSelect([makePlayer()]);

      const result = await service.getById(SESSION_ID);

      expect(result.state).toBeDefined();
      expect((result.state as typeof defaultState).format).toBe('1v1');
    });

    it('should include startedAt and endedAt fields', async () => {
      const startedAt = new Date('2026-03-13T10:00:00Z');
      const endedAt = new Date('2026-03-13T10:30:00Z');
      const session = makeSession({ startedAt, endedAt });
      db._pushSelect([session]);
      db._pushSelect([]);

      const result = await service.getById(SESSION_ID);

      expect(result.startedAt).toEqual(startedAt);
      expect(result.endedAt).toEqual(endedAt);
    });
  });

  // =========================================================================
  // submitBattlefieldSelection()
  // =========================================================================

  describe('submitBattlefieldSelection()', () => {
    it('should store selection secretly and return allSubmitted=false when not all players submitted', async () => {
      const session = makeSession();
      const player1 = makePlayer({ id: PLAYER_ID_1, role: 'player' });
      const player2 = makePlayer({ id: PLAYER_ID_2, displayName: 'Player 2', color: 'red', role: 'player' });

      db._pushSelect([session]); // getFullState -> session
      db._pushSelect([player1, player2]); // getFullState -> players
      db._pushUpdate([]); // update state

      const result = await service.submitBattlefieldSelection('ABC123', PLAYER_ID_1, [CARD_ID_1]);

      expect(result).toHaveProperty('allSubmitted');
      expect(result.allSubmitted).toBe(false);
    });

    it('should return allSubmitted=true when all players have submitted', async () => {
      const stateWithPending = {
        ...defaultState,
        pendingBattlefieldSelections: { [PLAYER_ID_2]: [CARD_ID_1] },
      };
      const session = makeSession({ state: stateWithPending });
      const player1 = makePlayer({ id: PLAYER_ID_1, role: 'player' });
      const player2 = makePlayer({ id: PLAYER_ID_2, displayName: 'Player 2', color: 'red', role: 'player' });

      db._pushSelect([session]);
      db._pushSelect([player1, player2]);
      db._pushUpdate([]);

      const result = await service.submitBattlefieldSelection('ABC123', PLAYER_ID_1, [CARD_ID_1]);

      expect(result.allSubmitted).toBe(true);
    });

    it('should not reveal individual selection to other players (only stores server-side)', async () => {
      const session = makeSession();
      const player1 = makePlayer({ id: PLAYER_ID_1 });
      const player2 = makePlayer({ id: PLAYER_ID_2, displayName: 'Player 2', color: 'red' });

      db._pushSelect([session]);
      db._pushSelect([player1, player2]);
      db._pushUpdate([]);

      const result = await service.submitBattlefieldSelection('ABC123', PLAYER_ID_1, [CARD_ID_1]);

      // Result should NOT contain card IDs
      expect(result).not.toHaveProperty('cardIds');
      expect(Object.keys(result)).toEqual(['allSubmitted']);
    });
  });

  // =========================================================================
  // revealBattlefields()
  // =========================================================================

  describe('revealBattlefields()', () => {
    it('should populate battlefield card data and clear pendingBattlefieldSelections', async () => {
      const stateWithPending = {
        ...defaultState,
        pendingBattlefieldSelections: {
          [PLAYER_ID_1]: [CARD_ID_1, null, null],
        },
      };
      const session = makeSession({ state: stateWithPending, status: 'waiting' });
      const player1 = makePlayer({ id: PLAYER_ID_1 });

      db._pushSelect([session]); // getFullState -> session
      db._pushSelect([player1]); // getFullState -> players
      db._pushSelect([{ id: CARD_ID_1, name: 'Dragon Scale', imageSmall: 'https://img.example.com/card.jpg' }]); // card lookup
      db._pushUpdate([{ ...session, status: 'active' }]); // update session

      const result = await service.revealBattlefields('ABC123');

      expect(result).toBeDefined();
      expect(result.pendingBattlefieldSelections).toBeUndefined();
    });

    it('should set session status to active when it was waiting', async () => {
      const stateWithPending = {
        ...defaultState,
        pendingBattlefieldSelections: {
          [PLAYER_ID_1]: [CARD_ID_1],
        },
      };
      const session = makeSession({ state: stateWithPending, status: 'waiting' });
      db._pushSelect([session]);
      db._pushSelect([makePlayer()]);
      db._pushSelect([{ id: CARD_ID_1, name: 'Dragon Scale', imageSmall: null }]);
      db._pushUpdate([{ ...session, status: 'active' }]);

      await service.revealBattlefields('ABC123');

      expect(db.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // history()
  // =========================================================================

  describe('history()', () => {
    it('should return only the authenticated user matches', async () => {
      const row = {
        sessionId: SESSION_ID,
        code: 'ABC123',
        format: '1v1',
        status: 'completed',
        winnerId: USER_ID,
        startedAt: new Date('2026-03-13T10:00:00Z'),
        endedAt: new Date('2026-03-13T10:30:00Z'),
        playerDisplayName: 'Alice',
        playerColor: 'blue',
        playerFinalScore: 8,
        playerIsWinner: true,
      };

      db._pushSelect([row]);

      const result = await service.history(USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.sessionId).toBe(SESSION_ID);
      expect(result.items[0]!.players[0]!.isWinner).toBe(true);
    });

    it('should return empty list when user has no match history', async () => {
      db._pushSelect([]);

      const result = await service.history(USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should aggregate player data per session', async () => {
      const rows = [
        {
          sessionId: SESSION_ID,
          code: 'ABC123',
          format: '1v1',
          status: 'completed',
          winnerId: USER_ID,
          startedAt: new Date('2026-03-13T10:00:00Z'),
          endedAt: new Date('2026-03-13T10:30:00Z'),
          playerDisplayName: 'Alice',
          playerColor: 'blue',
          playerFinalScore: 8,
          playerIsWinner: true,
        },
        {
          sessionId: SESSION_ID,
          code: 'ABC123',
          format: '1v1',
          status: 'completed',
          winnerId: USER_ID,
          startedAt: new Date('2026-03-13T10:00:00Z'),
          endedAt: new Date('2026-03-13T10:30:00Z'),
          playerDisplayName: 'Bob',
          playerColor: 'red',
          playerFinalScore: 3,
          playerIsWinner: false,
        },
      ];

      db._pushSelect(rows);

      const result = await service.history(USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.players).toHaveLength(2);
    });
  });

  // =========================================================================
  // applyBattlefieldTap()
  // =========================================================================

  describe('applyBattlefieldTap()', () => {
    it('should delegate to scoring engine and update state', async () => {
      const session = makeSession();
      const player1 = makePlayer({ id: PLAYER_ID_1 });
      const player2 = makePlayer({ id: PLAYER_ID_2, displayName: 'Player 2', color: 'red' });

      db._pushSelect([session]);
      db._pushSelect([player1, player2]);
      db._pushUpdate([session]);

      const result = await service.applyBattlefieldTap('ABC123', {
        battlefieldIndex: 0,
        playerId: PLAYER_ID_1,
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('battlefields');
    });

    it('should throw BAD_REQUEST for invalid battlefield index', async () => {
      const session = makeSession();
      const player = makePlayer();

      db._pushSelect([session]);
      db._pushSelect([player]);

      await expect(
        service.applyBattlefieldTap('ABC123', { battlefieldIndex: 99, playerId: PLAYER_ID_1 }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });
});
