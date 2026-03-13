import { z } from 'zod';
import { MATCH_FORMATS, MATCH_MODES, MATCH_PHASES, PLAYER_COLORS, PLAYER_ROLES, MATCH_STATUSES, UNCONTROLLED, CONTESTED, } from '../constants/match.constants';
// --- Base enums ---
export const matchFormatSchema = z.enum(MATCH_FORMATS);
export const matchModeSchema = z.enum(MATCH_MODES);
export const matchPhaseSchema = z.enum(MATCH_PHASES);
export const playerColorSchema = z.enum(PLAYER_COLORS);
export const playerRoleSchema = z.enum(PLAYER_ROLES);
export const matchStatusSchema = z.enum(MATCH_STATUSES);
// Battlefield control: 'uncontrolled' | 'contested' | playerId (string)
export const battlefieldControlSchema = z.union([
    z.literal(UNCONTROLLED),
    z.literal(CONTESTED),
    z.string().uuid(),
]);
// --- Battlefield state ---
export const battlefieldStateSchema = z.object({
    index: z.number().int().min(0),
    control: battlefieldControlSchema,
    cardId: z.string().uuid().nullable(),
});
// --- Player score state ---
export const playerScoreSchema = z.object({
    playerId: z.string(),
    displayName: z.string(),
    score: z.number().int().min(0),
    color: playerColorSchema,
    teamId: z.number().int().nullable(),
});
// --- Full match state (stored as jsonb) ---
export const matchStateSchema = z.object({
    format: matchFormatSchema,
    phase: matchPhaseSchema,
    turnNumber: z.number().int().min(1),
    activePlayerId: z.string(),
    firstPlayerId: z.string(),
    winTarget: z.number().int().min(1),
    players: z.array(playerScoreSchema),
    battlefields: z.array(battlefieldStateSchema),
    conqueredThisTurn: z.array(z.number().int()),
    log: z.array(z.object({
        turn: z.number().int(),
        phase: matchPhaseSchema,
        event: z.string(),
        timestamp: z.number(),
    })),
});
// --- Input schemas ---
export const matchCreateSchema = z.object({
    format: matchFormatSchema,
    mode: matchModeSchema,
    playerNames: z.array(z.string().min(1).max(50)).min(1).max(4),
    firstPlayerId: z.string(),
});
export const matchJoinSchema = z.object({
    code: z.string().length(6),
    displayName: z.string().min(1).max(50),
    role: playerRoleSchema.default('player'),
});
export const matchHistorySchema = z.object({
    cursor: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(20),
});
// --- Win condition validation result ---
export const winValidationResultSchema = z.object({
    valid: z.boolean(),
    reason: z.string().optional(),
});
