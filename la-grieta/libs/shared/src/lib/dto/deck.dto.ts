import { Deck, DeckCard } from '../interfaces/deck.interface';
import { Card } from '../interfaces/card.interface';

// ==================== CREATE DECK ====================
export interface CreateDeckDto {
  name: string;
  description?: string;
  legendId: string;
  isPublic?: boolean;
}

// ==================== UPDATE DECK ====================
export interface UpdateDeckDto {
  name?: string;
  description?: string;
  isPublic?: boolean;
}

// ==================== ADD CARD TO DECK ====================
export interface AddCardToDeckDto {
  cardId: string;
  quantity: number;
  zone: string; // 'MAIN' | 'RUNE' | 'BATTLEFIELD'
}

// ==================== UPDATE CARD IN DECK ====================
export interface UpdateDeckCardDto {
  quantity?: number;
  zone?: string;
}

// ==================== VALIDATION ====================
export interface ValidationError {
  rule: string;
  message: string;
  details?: any;
}

export interface DeckValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ==================== STATISTICS ====================
export interface DeckStatsResponse {
  totalCards: number;
  cardsByZone: {
    MAIN: number;
    RUNE: number;
    BATTLEFIELD: number;
  };
  cardsByType: Record<string, number>;
  domainDistribution: Record<string, number>;
  manaCurve: Record<number, number>;
  estimatedValue: number;
}

// ==================== RESPONSE DTOs ====================
export interface DeckResponseDto extends Deck {
  legend?: Card;
  cardCount?: number;
}

export interface DeckListResponseDto {
  id: string;
  userId: string;
  name: string;
  description?: string;
  legendId: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  cardCount: number;
  legend?: Card;
}
