import { Injectable, Inject } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq, and, gt, desc, inArray } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import type { DbClient } from '@la-grieta/db';
import { matchSessions, matchPlayers, cards } from '@la-grieta/db';
import type { MatchSession, MatchPlayer } from '@la-grieta/db';
import {
  createInitialState,
  cycleBattlefieldControl,
  scoreConquest,
  scoreBeginningPhase,
  validateWinCondition,
  advancePhase as advancePhaseFn,
  advanceTurn as advanceTurnFn,
} from './match-scoring';
import type {
  MatchState,
  MatchCreateInput,
  MatchJoinInput,
  MatchHistoryInput,
} from '@la-grieta/shared';
import { PLAYER_COLORS, UNCONTROLLED, CONTESTED } from '@la-grieta/shared';
import { buildPaginatedResult } from '@la-grieta/shared';
import type { PaginatedResult } from '@la-grieta/shared';

const nanoidAlphabet = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export type MatchWithPlayers = MatchSession & {
  players: MatchPlayer[];
};

export type MatchSummary = {
  id: string;
  sessionId: string;
  code: string;
  format: string;
  status: string;
  players: Array<{
    displayName: string;
    color: string;
    finalScore: number | null;
    isWinner: boolean;
  }>;
  winnerId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
};

export type BattlefieldSubmitResult = {
  allSubmitted: boolean;
};

@Injectable()
export class MatchService {
  constructor(
    @Inject('DB_CLIENT') private readonly db: DbClient,
  ) {}

  async create(
    userId: string | null,
    input: MatchCreateInput,
  ): Promise<{ code: string; sessionId: string }> {
    const code = nanoidAlphabet();

    const playerIds = input.playerNames.map((_, i) => `guest-${i}-${Date.now()}`);
    const state = createInitialState(input.format, playerIds, input.firstPlayerId);

    const [session] = await this.db
      .insert(matchSessions)
      .values({
        code,
        format: input.format,
        status: 'waiting',
        hostUserId: userId ?? undefined,
        winTarget: state.winTarget,
        state: state as unknown as Record<string, unknown>,
      })
      .returning();

    if (!session) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create match' });
    }

    // Create match_players rows for each player
    const playerValues = input.playerNames.map((name, i) => ({
      sessionId: session.id,
      userId: userId && i === 0 ? userId : undefined,
      displayName: name,
      role: 'player' as const,
      color: (PLAYER_COLORS[i % PLAYER_COLORS.length] ?? 'blue') as string,
    }));

    await this.db.insert(matchPlayers).values(playerValues);

    return { code, sessionId: session.id };
  }

  async join(
    userId: string | null,
    input: MatchJoinInput,
  ): Promise<MatchWithPlayers> {
    const [session] = await this.db
      .select()
      .from(matchSessions)
      .where(eq(matchSessions.code, input.code))
      .limit(1);

    if (!session || (session.status !== 'waiting' && session.status !== 'active')) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found or not joinable' });
    }

    const existingPlayers = await this.db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.sessionId, session.id));

    const usedColors = new Set(existingPlayers.map((p) => p.color));
    const nextColor = PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[0] ?? 'blue';

    await this.db.insert(matchPlayers).values({
      sessionId: session.id,
      userId: userId ?? undefined,
      displayName: input.displayName,
      role: input.role ?? 'player',
      color: nextColor as string,
    });

    return this.getFullState(input.code);
  }

  async getFullState(code: string): Promise<MatchWithPlayers> {
    const [session] = await this.db
      .select()
      .from(matchSessions)
      .where(eq(matchSessions.code, code))
      .limit(1);

    if (!session) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' });
    }

    const players = await this.db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.sessionId, session.id));

    return { ...session, players };
  }

  async getById(sessionId: string): Promise<MatchWithPlayers> {
    const [session] = await this.db
      .select()
      .from(matchSessions)
      .where(eq(matchSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Match not found' });
    }

    const players = await this.db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.sessionId, session.id));

    return { ...session, players };
  }

  async applyBattlefieldTap(
    code: string,
    data: { battlefieldIndex: number; playerId: string },
  ): Promise<MatchState> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState;
    const playerIds = match.players
      .filter((p) => p.role === 'player')
      .map((p) => p.id);

    const bf = state.battlefields[data.battlefieldIndex];
    if (!bf) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid battlefield index' });
    }

    const newControl = cycleBattlefieldControl(bf.control, playerIds);

    // Determine if this is a conquest (control changed to a specific player)
    let newState: MatchState = {
      ...state,
      battlefields: state.battlefields.map((b, i) =>
        i === data.battlefieldIndex ? { ...b, control: newControl } : b,
      ),
    };

    const isConquest =
      newControl !== UNCONTROLLED &&
      newControl !== CONTESTED;

    if (isConquest) {
      newState = scoreConquest(newState, data.battlefieldIndex, newControl);

      // Check win condition
      const conqueredAll = newState.battlefields.every(
        (b) => b.control === newControl,
      );
      const winResult = validateWinCondition(state, newControl, conqueredAll);
      if (winResult.valid && newState.players.find((p) => p.playerId === newControl)?.score !== undefined) {
        const updatedPlayer = newState.players.find((p) => p.playerId === newControl);
        if (updatedPlayer && updatedPlayer.score >= newState.winTarget) {
          newState = {
            ...newState,
            log: [
              ...newState.log,
              {
                turn: newState.turnNumber,
                phase: newState.phase,
                event: `Player ${newControl} wins!`,
                timestamp: Date.now(),
              },
            ],
          };
        }
      }
    }

    await this.db
      .update(matchSessions)
      .set({ state: newState as unknown as Record<string, unknown> })
      .where(eq(matchSessions.code, code));

    return newState;
  }

  async advancePhase(code: string, _playerId: string): Promise<MatchState> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState;

    const nextPhase = advancePhaseFn(state.phase);
    let newState: MatchState = { ...state, phase: nextPhase };

    // If entering 'B' phase, score beginning phase
    if (nextPhase === 'B') {
      newState = scoreBeginningPhase(newState);
    }

    await this.db
      .update(matchSessions)
      .set({ state: newState as unknown as Record<string, unknown> })
      .where(eq(matchSessions.code, code));

    return newState;
  }

  async advanceTurn(code: string): Promise<MatchState> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState;

    const newState = advanceTurnFn(state);

    await this.db
      .update(matchSessions)
      .set({ state: newState as unknown as Record<string, unknown> })
      .where(eq(matchSessions.code, code));

    return newState;
  }

  async pauseMatch(code: string): Promise<MatchState> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState;

    const newState: MatchState = {
      ...state,
      log: [
        ...state.log,
        {
          turn: state.turnNumber,
          phase: state.phase,
          event: 'paused',
          timestamp: Date.now(),
        },
      ],
    };

    await this.db
      .update(matchSessions)
      .set({ state: newState as unknown as Record<string, unknown> })
      .where(eq(matchSessions.code, code));

    return newState;
  }

  async endMatch(
    code: string,
    winnerId: string | null,
    _reason: 'score' | 'concession',
  ): Promise<MatchSummary> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState;

    const [updated] = await this.db
      .update(matchSessions)
      .set({
        status: 'completed',
        endedAt: new Date(),
        winnerId: winnerId,
      })
      .where(eq(matchSessions.code, code))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to end match' });
    }

    // Update match_players with finalScore and isWinner
    if (state.players && state.players.length > 0) {
      for (const player of match.players) {
        const scoreEntry = state.players.find((p) => {
          // Match by player record id or by displayName
          return p.playerId === player.id || p.displayName === player.displayName;
        });
        await this.db
          .update(matchPlayers)
          .set({
            finalScore: scoreEntry?.score ?? 0,
            isWinner: player.id === winnerId || player.userId === winnerId,
          })
          .where(eq(matchPlayers.id, player.id));
      }
    }

    const durationMs =
      updated.startedAt && updated.endedAt
        ? updated.endedAt.getTime() - updated.startedAt.getTime()
        : null;

    return {
      id: updated.id,
      sessionId: updated.id,
      code: updated.code,
      format: updated.format,
      status: updated.status,
      players: match.players.map((p) => ({
        displayName: p.displayName,
        color: p.color,
        finalScore: p.finalScore,
        isWinner: p.isWinner,
      })),
      winnerId: updated.winnerId,
      startedAt: updated.startedAt,
      endedAt: updated.endedAt,
      durationMs,
    };
  }

  async submitBattlefieldSelection(
    code: string,
    playerId: string,
    cardIds: string[],
  ): Promise<BattlefieldSubmitResult> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState & {
      pendingBattlefieldSelections?: Record<string, string[]>;
    };

    const pending = state.pendingBattlefieldSelections ?? {};
    pending[playerId] = cardIds;

    const newState = {
      ...state,
      pendingBattlefieldSelections: pending,
    };

    await this.db
      .update(matchSessions)
      .set({ state: newState as unknown as Record<string, unknown> })
      .where(eq(matchSessions.code, code));

    // Check if all 'player' role participants have submitted
    const playerMembers = match.players.filter((p) => p.role === 'player');
    const allSubmitted = playerMembers.every((p) => p.id in pending);

    return { allSubmitted };
  }

  async revealBattlefields(code: string): Promise<MatchState & { pendingBattlefieldSelections?: Record<string, string[]> }> {
    const match = await this.getFullState(code);
    const state = match.state as unknown as MatchState & {
      pendingBattlefieldSelections?: Record<string, string[]>;
    };

    const pending = state.pendingBattlefieldSelections ?? {};

    // Collect all submitted card IDs
    const allCardIds = Object.values(pending).flat().filter((id): id is string => typeof id === 'string');

    // Look up card data from DB
    let cardDataMap = new Map<string, { name: string; imageSmall: string | null }>();
    if (allCardIds.length > 0) {
      const cardRows = await this.db
        .select({ id: cards.id, name: cards.name, imageSmall: cards.imageSmall })
        .from(cards)
        .where(
          allCardIds.length === 1
            ? eq(cards.id, allCardIds[0]!)
            : inArray(cards.id, allCardIds),
        );
      cardDataMap = new Map(cardRows.map((r) => [r.id, { name: r.name, imageSmall: r.imageSmall }]));
    }

    // Populate battlefields with card data from pending selections
    const updatedBattlefields = state.battlefields.map((bf, i) => {
      // Find which player submitted a card for this battlefield index
      for (const [_pid, selectedCardIds] of Object.entries(pending)) {
        if (selectedCardIds[i]) {
          const cardId = selectedCardIds[i]!;
          const cardData = cardDataMap.get(cardId);
          return {
            ...bf,
            cardId,
            cardName: cardData?.name ?? null,
            cardArt: cardData?.imageSmall ?? null,
          };
        }
      }
      return bf;
    });

    const newState = {
      ...state,
      battlefields: updatedBattlefields,
      pendingBattlefieldSelections: undefined,
      status: 'active' as const,
    };

    await this.db
      .update(matchSessions)
      .set({
        state: newState as unknown as Record<string, unknown>,
        status: 'active',
        startedAt: match.status === 'waiting' ? new Date() : match.startedAt,
      })
      .where(eq(matchSessions.code, code));

    return newState;
  }

  async history(
    userId: string,
    input: MatchHistoryInput,
  ): Promise<PaginatedResult<MatchSummary>> {
    const conditions = [eq(matchPlayers.userId, userId)];

    if (input.cursor) {
      conditions.push(gt(matchSessions.id, input.cursor));
    }

    const rows = await this.db
      .select({
        sessionId: matchSessions.id,
        code: matchSessions.code,
        format: matchSessions.format,
        status: matchSessions.status,
        winnerId: matchSessions.winnerId,
        startedAt: matchSessions.startedAt,
        endedAt: matchSessions.endedAt,
        playerDisplayName: matchPlayers.displayName,
        playerColor: matchPlayers.color,
        playerFinalScore: matchPlayers.finalScore,
        playerIsWinner: matchPlayers.isWinner,
      })
      .from(matchPlayers)
      .innerJoin(matchSessions, eq(matchPlayers.sessionId, matchSessions.id))
      .where(and(...conditions))
      .orderBy(desc(matchSessions.endedAt))
      .limit(input.limit + 1);

    // Group by session
    const sessionMap = new Map<string, MatchSummary>();
    for (const row of rows) {
      if (!sessionMap.has(row.sessionId)) {
        sessionMap.set(row.sessionId, {
          id: row.sessionId,
          sessionId: row.sessionId,
          code: row.code,
          format: row.format,
          status: row.status,
          players: [],
          winnerId: row.winnerId,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          durationMs:
            row.startedAt && row.endedAt
              ? row.endedAt.getTime() - row.startedAt.getTime()
              : null,
        });
      }
      const summary = sessionMap.get(row.sessionId)!;
      summary.players.push({
        displayName: row.playerDisplayName,
        color: row.playerColor,
        finalScore: row.playerFinalScore,
        isWinner: row.playerIsWinner,
      });
    }

    const items = Array.from(sessionMap.values());
    return buildPaginatedResult(items, input.limit);
  }
}
