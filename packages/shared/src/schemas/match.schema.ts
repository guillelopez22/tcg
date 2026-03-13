import { z } from 'zod';
import {
  MATCH_FORMATS,
  MATCH_MODES,
  MATCH_PHASES,
  PLAYER_COLORS,
  PLAYER_ROLES,
  MATCH_STATUSES,
  UNCONTROLLED,
  CONTESTED,
} from '../constants/match.constants';

// --- Base enums ---

export const matchFormatSchema = z.enum(MATCH_FORMATS);
export type MatchFormatInput = z.infer<typeof matchFormatSchema>;

export const matchModeSchema = z.enum(MATCH_MODES);
export type MatchModeInput = z.infer<typeof matchModeSchema>;

export const matchPhaseSchema = z.enum(MATCH_PHASES);
export type MatchPhaseInput = z.infer<typeof matchPhaseSchema>;

export const playerColorSchema = z.enum(PLAYER_COLORS);
export type PlayerColorInput = z.infer<typeof playerColorSchema>;

export const playerRoleSchema = z.enum(PLAYER_ROLES);
export type PlayerRoleInput = z.infer<typeof playerRoleSchema>;

export const matchStatusSchema = z.enum(MATCH_STATUSES);
export type MatchStatusInput = z.infer<typeof matchStatusSchema>;

// Battlefield control: 'uncontrolled' | 'contested' | playerId (string)
export const battlefieldControlSchema = z.union([
  z.literal(UNCONTROLLED),
  z.literal(CONTESTED),
  z.string().uuid(),
]);
export type BattlefieldControl = z.infer<typeof battlefieldControlSchema>;

// --- Battlefield state ---

export const battlefieldStateSchema = z.object({
  index: z.number().int().min(0),
  control: battlefieldControlSchema,
  cardId: z.string().uuid().nullable(),
});
export type BattlefieldState = z.infer<typeof battlefieldStateSchema>;

// --- Player score state ---

export const playerScoreSchema = z.object({
  playerId: z.string(),
  displayName: z.string(),
  score: z.number().int().min(0),
  color: playerColorSchema,
  teamId: z.number().int().nullable(),
});
export type PlayerScore = z.infer<typeof playerScoreSchema>;

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
  log: z.array(
    z.object({
      turn: z.number().int(),
      phase: matchPhaseSchema,
      event: z.string(),
      timestamp: z.number(),
    }),
  ),
});
export type MatchState = z.infer<typeof matchStateSchema>;

// --- Input schemas ---

export const matchCreateSchema = z.object({
  format: matchFormatSchema,
  mode: matchModeSchema,
  playerNames: z.array(z.string().min(1).max(50)).min(1).max(4),
  firstPlayerId: z.string(),
});
export type MatchCreateInput = z.infer<typeof matchCreateSchema>;

export const matchJoinSchema = z.object({
  code: z.string().length(6),
  displayName: z.string().min(1).max(50),
  role: playerRoleSchema.default('player'),
});
export type MatchJoinInput = z.infer<typeof matchJoinSchema>;

export const matchHistorySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type MatchHistoryInput = z.infer<typeof matchHistorySchema>;

// --- Win condition validation result ---

export const winValidationResultSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
});
export type WinValidationResult = z.infer<typeof winValidationResultSchema>;
