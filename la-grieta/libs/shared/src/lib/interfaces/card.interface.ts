import { CardType } from '../enums/card-type.enum';
import { Domain } from '../enums/domain.enum';
import { CardRarity } from '../enums/rarity.enum';

export interface Card {
  id: string;
  riotCardId: string;
  name: string;
  cardType: CardType;
  isToken: boolean;

  // Costs
  energyCost?: number;
  powerCost?: PowerCost[];

  // Stats
  might?: number;

  // Classification
  domains: Domain[];
  region?: string;
  rarity: CardRarity;

  // Text
  abilityText?: string;
  flavorText?: string;
  keywords: string[];

  // Set info
  setCode: string;
  setName: string;
  collectorNumber: string;

  // Media
  imageUrl: string;

  // Market
  marketPrice?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface PowerCost {
  domain: Domain;
  count: number;
}
