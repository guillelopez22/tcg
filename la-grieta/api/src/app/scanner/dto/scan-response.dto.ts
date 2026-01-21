import { Card } from '@la-grieta/shared';

export type MatchType = 'EXACT' | 'FUZZY' | 'PARTIAL';

export interface CardMatch {
  card: Card;
  confidence: number;
  matchType: MatchType;
}

export interface ScanResultDto {
  success: boolean;
  match?: CardMatch;
  alternatives?: CardMatch[];
  extractedText?: string[];
  error?: string;
}

export interface ScanBulkResponseDto {
  results: ScanResultDto[];
  summary: {
    total: number;
    matched: number;
    failed: number;
  };
}

export interface ScannerStatusDto {
  available: boolean;
  mode: 'MOCK' | 'LIVE';
  quotaRemaining?: number;
}
