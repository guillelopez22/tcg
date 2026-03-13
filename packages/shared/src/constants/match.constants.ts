export const WIN_TARGET_1V1 = 8;
export const WIN_TARGET_2V2 = 11;
export const WIN_TARGET_FFA = 8;

export const BATTLEFIELDS_1V1 = 2;
export const BATTLEFIELDS_2V2 = 3;
export const BATTLEFIELDS_FFA = 3;

export const MATCH_PHASES = ['A', 'B', 'C', 'D'] as const;
export type MatchPhase = (typeof MATCH_PHASES)[number];

export const PLAYER_COLORS = ['blue', 'red', 'green', 'yellow'] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const MATCH_FORMATS = ['1v1', '2v2', 'ffa'] as const;
export type MatchFormat = (typeof MATCH_FORMATS)[number];

export const MATCH_STATUSES = ['waiting', 'active', 'completed', 'abandoned'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const PLAYER_ROLES = ['player', 'spectator'] as const;
export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const MATCH_MODES = ['local', 'synced'] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

export const UNCONTROLLED = 'uncontrolled' as const;
export const CONTESTED = 'contested' as const;
