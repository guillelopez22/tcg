import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Mock card data since Riot API might not be available
const MOCK_CARDS = [
  {
    id: '1',
    riotCardId: 'riftbound_001',
    name: 'Armed Assailant',
    cardType: 'UNIT',
    isToken: false,
    energyCost: 2,
    powerCost: [{ domain: 'FURY', count: 1 }],
    might: 3,
    domains: ['FURY'],
    region: 'NOXUS',
    rarity: 'COMMON',
    abilityText: 'Quick: This unit strikes immediately when played.',
    flavorText: 'Strike first, ask questions never.',
    keywords: ['Quick'],
    setCode: 'SFD',
    setName: 'Saga of the First Dawn',
    collectorNumber: '002',
    imageUrl: 'https://dd.b.pvp.net/riftbound/armed-assailant.png',
    marketPrice: 0.50,
  },
  {
    id: '2',
    riotCardId: 'riftbound_002',
    name: 'Darius',
    cardType: 'LEGEND',
    isToken: false,
    energyCost: null,
    powerCost: null,
    might: null,
    domains: ['FURY', 'BODY'],
    region: 'NOXUS',
    rarity: 'LEGENDARY',
    abilityText: 'Your deck can only contain Fury and Body cards.',
    flavorText: 'The Hand of Noxus.',
    keywords: [],
    setCode: 'SFD',
    setName: 'Saga of the First Dawn',
    collectorNumber: '001',
    imageUrl: 'https://dd.b.pvp.net/riftbound/darius.png',
    marketPrice: 15.00,
  },
  {
    id: '3',
    riotCardId: 'riftbound_003',
    name: 'Demacian Banner',
    cardType: 'RUNE',
    isToken: false,
    energyCost: null,
    powerCost: null,
    might: null,
    domains: ['ORDER'],
    region: 'DEMACIA',
    rarity: 'COMMON',
    abilityText: 'Provides 1 Order power.',
    flavorText: 'For justice and honor.',
    keywords: [],
    setCode: 'SFD',
    setName: 'Saga of the First Dawn',
    collectorNumber: '120',
    imageUrl: 'https://dd.b.pvp.net/riftbound/demacian-banner.png',
    marketPrice: 0.10,
  },
  {
    id: '4',
    riotCardId: 'riftbound_004',
    name: 'Mystic Shot',
    cardType: 'SPELL',
    isToken: false,
    energyCost: 2,
    powerCost: [{ domain: 'MIND', count: 1 }],
    might: null,
    domains: ['MIND'],
    region: 'PILTOVER',
    rarity: 'COMMON',
    abilityText: 'Deal 2 damage to any target.',
    flavorText: 'Precision is the difference between a laugh and an apology.',
    keywords: [],
    setCode: 'SFD',
    setName: 'Saga of the First Dawn',
    collectorNumber: '045',
    imageUrl: 'https://dd.b.pvp.net/riftbound/mystic-shot.png',
    marketPrice: 0.75,
  },
  {
    id: '5',
    riotCardId: 'riftbound_005',
    name: 'The Great Battlefield',
    cardType: 'BATTLEFIELD',
    isToken: false,
    energyCost: null,
    powerCost: null,
    might: null,
    domains: [],
    region: null,
    rarity: 'RARE',
    abilityText: 'When a unit enters this battlefield, it gets +1 Might until end of turn.',
    flavorText: 'Where legends are forged.',
    keywords: [],
    setCode: 'SFD',
    setName: 'Saga of the First Dawn',
    collectorNumber: '200',
    imageUrl: 'https://dd.b.pvp.net/riftbound/great-battlefield.png',
    marketPrice: 3.50,
  },
];

export interface CardFilters {
  search?: string;
  cardType?: string;
  domains?: string[];
  region?: string;
  rarity?: string;
  setCode?: string;
}

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    filters?: CardFilters,
    page = 0,
    limit = 24
  ) {
    // Build Prisma where clause from filters
    const where: any = {};

    if (filters) {
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { abilityText: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.cardType) {
        where.cardType = filters.cardType;
      }

      if (filters.domains && filters.domains.length > 0) {
        where.domains = { hasSome: filters.domains };
      }

      if (filters.region) {
        where.region = filters.region;
      }

      if (filters.rarity) {
        where.rarity = filters.rarity;
      }

      if (filters.setCode) {
        where.setCode = filters.setCode;
      }
    }

    // Query database with pagination
    const [cards, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        skip: page * limit,
        take: limit,
        orderBy: [
          { setCode: 'asc' },
          { collectorNumber: 'asc' },
        ],
      }),
      this.prisma.card.count({ where }),
    ]);

    return {
      cards,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
    });

    if (!card) {
      throw new NotFoundException(`Card with ID ${id} not found`);
    }

    return card;
  }

  async getSets() {
    // Get unique sets from database
    const cards = await this.prisma.card.findMany({
      select: {
        setCode: true,
        setName: true,
      },
      distinct: ['setCode'],
      orderBy: {
        setCode: 'asc',
      },
    });

    return cards.map((card) => ({
      code: card.setCode,
      name: card.setName,
    }));
  }

  // Admin function to sync cards from Riot API (not implemented yet)
  async syncCards() {
    // TODO: Implement Riot API integration when available
    // For now, seed the database with mock cards

    const existingCards = await this.prisma.card.findMany();

    if (existingCards.length === 0) {
      // Seed with mock cards
      await this.prisma.card.createMany({
        data: MOCK_CARDS.map((card) => ({
          riotCardId: card.riotCardId,
          name: card.name,
          cardType: card.cardType,
          isToken: card.isToken,
          energyCost: card.energyCost,
          powerCost: card.powerCost ? card.powerCost : null,
          might: card.might,
          domains: card.domains,
          region: card.region,
          rarity: card.rarity,
          abilityText: card.abilityText,
          flavorText: card.flavorText,
          keywords: card.keywords,
          setCode: card.setCode,
          setName: card.setName,
          collectorNumber: card.collectorNumber,
          imageUrl: card.imageUrl,
          marketPrice: card.marketPrice,
        })),
      });

      return {
        message: 'Mock cards synced successfully',
        count: MOCK_CARDS.length,
      };
    }

    return {
      message: 'Cards already exist in database',
      count: existingCards.length,
    };
  }
}
