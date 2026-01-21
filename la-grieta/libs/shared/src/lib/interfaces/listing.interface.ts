import { ListingStatus, ListingType } from '../enums/listing-status.enum';
import { Card } from './card.interface';

export interface Listing {
  id: string;
  sellerId: string;
  shopId?: string;
  title: string;
  description?: string;
  type: ListingType;
  status: ListingStatus;

  // Pricing
  price?: number;
  startingBid?: number;
  currentBid?: number;
  buyNowPrice?: number;

  // Auction
  endsAt?: Date;

  items: ListingItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingItem {
  id: string;
  listingId: string;
  cardId: string;
  card?: Card;
  quantity: number;
  condition: string;
}

export enum CardCondition {
  MINT = 'MINT',
  NEAR_MINT = 'NEAR_MINT',
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  PLAYED = 'PLAYED',
  POOR = 'POOR',
}

export const CARD_CONDITIONS = Object.values(CardCondition);
