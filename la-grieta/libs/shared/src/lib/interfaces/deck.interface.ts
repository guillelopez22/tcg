import { Card } from './card.interface';

export interface Deck {
  id: string;
  userId: string;
  name: string;
  description?: string;
  legendId: string;
  isPublic: boolean;
  cards: DeckCard[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckCard {
  id: string;
  deckId: string;
  cardId: string;
  card?: Card;
  quantity: number;
  zone: DeckZone;
}

export enum DeckZone {
  MAIN = 'MAIN',
  RUNE = 'RUNE',
  BATTLEFIELD = 'BATTLEFIELD',
}
