import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { AddCardToDeckDto } from './dto/add-card.dto';
import { UpdateDeckCardDto } from './dto/update-deck-card.dto';
import {
  DeckResponseDto,
  DeckListResponseDto,
  DeckValidationResult,
  DeckStatsResponse,
} from '@la-grieta/shared';
import { DeckValidationService } from './deck-validation.service';
import { DeckStatsService } from './deck-stats.service';

@Injectable()
export class DecksService {
  constructor(
    private prisma: PrismaService,
    private validationService: DeckValidationService,
    private statsService: DeckStatsService
  ) {}

  /**
   * Create a new deck
   */
  async create(userId: string, dto: CreateDeckDto): Promise<DeckResponseDto> {
    // Verify the legend card exists and is actually a LEGEND type
    const legendCard = await this.prisma.card.findUnique({
      where: { id: dto.legendId },
    });

    if (!legendCard) {
      throw new NotFoundException(`Legend card with ID ${dto.legendId} not found`);
    }

    if (legendCard.cardType !== 'LEGEND') {
      throw new BadRequestException(
        `Card "${legendCard.name}" is not a LEGEND card (type: ${legendCard.cardType}). Only LEGEND cards can be used as deck legends.`
      );
    }

    // Create the deck
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        legendId: dto.legendId,
        isPublic: dto.isPublic ?? false,
      },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    });

    // Fetch the legend card for response
    const legend = await this.prisma.card.findUnique({
      where: { id: deck.legendId },
    });

    return {
      ...deck,
      legend: legend as any || undefined,
      cardCount: 0,
    } as unknown as DeckResponseDto;
  }

  /**
   * Get all decks for a user
   */
  async findAll(userId: string): Promise<DeckListResponseDto[]> {
    const decks = await this.prisma.deck.findMany({
      where: { userId },
      include: {
        _count: {
          select: { cards: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Fetch all unique legend cards
    const legendIds = [...new Set(decks.map((d) => d.legendId))];
    const legends = await this.prisma.card.findMany({
      where: { id: { in: legendIds } },
    });
    const legendMap = new Map(legends.map((l) => [l.id, l]));

    return decks.map((deck) => ({
      id: deck.id,
      userId: deck.userId,
      name: deck.name,
      description: deck.description || undefined,
      legendId: deck.legendId,
      isPublic: deck.isPublic,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt,
      cardCount: deck._count.cards,
      legend: legendMap.get(deck.legendId) as any,
    })) as unknown as DeckListResponseDto[];
  }

  /**
   * Get a single deck with all its cards
   */
  async findOne(userId: string, deckId: string): Promise<DeckResponseDto> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: true,
          },
          orderBy: {
            zone: 'asc',
          },
        },
      },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    // Only the owner can view private decks
    if (deck.userId !== userId && !deck.isPublic) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    // Fetch the legend card
    const legend = await this.prisma.card.findUnique({
      where: { id: deck.legendId },
    });

    const totalCards = deck.cards.reduce((sum, card) => sum + card.quantity, 0);

    return {
      ...deck,
      legend: legend as any || undefined,
      cardCount: totalCards,
    } as unknown as DeckResponseDto;
  }

  /**
   * Update deck metadata (name, description, isPublic)
   */
  async update(userId: string, deckId: string, dto: UpdateDeckDto): Promise<DeckResponseDto> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    const updated = await this.prisma.deck.update({
      where: { id: deckId },
      data: {
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic,
      },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    });

    const legend = await this.prisma.card.findUnique({
      where: { id: updated.legendId },
    });

    const totalCards = updated.cards.reduce((sum, card) => sum + card.quantity, 0);

    return {
      ...updated,
      legend: legend as any || undefined,
      cardCount: totalCards,
    } as unknown as DeckResponseDto;
  }

  /**
   * Delete a deck
   */
  async remove(userId: string, deckId: string) {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        _count: {
          select: { cards: true },
        },
      },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    // Cards will be cascade deleted
    await this.prisma.deck.delete({
      where: { id: deckId },
    });

    return {
      message: 'Deck deleted successfully',
      deletedCardsCount: deck._count.cards,
    };
  }

  /**
   * Add a card to a deck
   */
  async addCard(userId: string, deckId: string, dto: AddCardToDeckDto) {
    // Verify deck ownership
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    // Verify card exists
    const card = await this.prisma.card.findUnique({
      where: { id: dto.cardId },
    });

    if (!card) {
      throw new NotFoundException(`Card with ID ${dto.cardId} not found`);
    }

    // Check if card already exists in this zone
    const existingCard = await this.prisma.deckCard.findUnique({
      where: {
        deckId_cardId_zone: {
          deckId,
          cardId: dto.cardId,
          zone: dto.zone,
        },
      },
    });

    let deckCard;

    if (existingCard) {
      // Update quantity (check max 3 copies rule)
      const newQuantity = existingCard.quantity + dto.quantity;
      if (newQuantity > 3) {
        throw new BadRequestException(
          `Adding ${dto.quantity} copies would result in ${newQuantity} copies of this card in the ${dto.zone} zone. Maximum is 3 copies per zone.`
        );
      }

      deckCard = await this.prisma.deckCard.update({
        where: { id: existingCard.id },
        data: {
          quantity: newQuantity,
        },
        include: {
          card: true,
        },
      });
    } else {
      // Create new entry
      deckCard = await this.prisma.deckCard.create({
        data: {
          deckId,
          cardId: dto.cardId,
          quantity: dto.quantity,
          zone: dto.zone,
        },
        include: {
          card: true,
        },
      });
    }

    return deckCard;
  }

  /**
   * Update a card in a deck (change quantity or zone)
   */
  async updateCard(
    userId: string,
    deckId: string,
    cardId: string,
    dto: UpdateDeckCardDto
  ) {
    // Verify deck ownership
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    // Find the deck card entry
    const deckCard = await this.prisma.deckCard.findFirst({
      where: {
        deckId,
        cardId,
      },
    });

    if (!deckCard) {
      throw new NotFoundException(`Card with ID ${cardId} not found in this deck`);
    }

    // If zone is being changed, check for duplicates
    if (dto.zone && dto.zone !== deckCard.zone) {
      const existingInZone = await this.prisma.deckCard.findUnique({
        where: {
          deckId_cardId_zone: {
            deckId,
            cardId,
            zone: dto.zone,
          },
        },
      });

      if (existingInZone) {
        throw new ConflictException(
          `This card already exists in the ${dto.zone} zone. Remove it from that zone first, or update that entry instead.`
        );
      }
    }

    // Update the card
    const updated = await this.prisma.deckCard.update({
      where: { id: deckCard.id },
      data: {
        quantity: dto.quantity,
        zone: dto.zone,
      },
      include: {
        card: true,
      },
    });

    return updated;
  }

  /**
   * Remove a card from a deck
   */
  async removeCard(userId: string, deckId: string, cardId: string) {
    // Verify deck ownership
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    // Find the deck card entry (could be in any zone)
    const deckCard = await this.prisma.deckCard.findFirst({
      where: {
        deckId,
        cardId,
      },
    });

    if (!deckCard) {
      throw new NotFoundException(`Card with ID ${cardId} not found in this deck`);
    }

    await this.prisma.deckCard.delete({
      where: { id: deckCard.id },
    });

    return {
      message: 'Card removed from deck successfully',
    };
  }

  /**
   * Validate deck against Riftbound rules
   */
  async validateDeck(userId: string, deckId: string): Promise<DeckValidationResult> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    // Only the owner can validate their decks
    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    // Fetch the legend card
    const legend = await this.prisma.card.findUnique({
      where: { id: deck.legendId },
    });

    const validationData = {
      legendId: deck.legendId,
      cards: deck.cards,
      legend: legend,
    };

    return this.validationService.validate(validationData);
  }

  /**
   * Get deck statistics
   */
  async getStats(userId: string, deckId: string): Promise<DeckStatsResponse> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: {
        cards: {
          include: {
            card: true,
          },
        },
      },
    });

    if (!deck) {
      throw new NotFoundException(`Deck with ID ${deckId} not found`);
    }

    // Only the owner can view stats
    if (deck.userId !== userId) {
      throw new ForbiddenException('You do not have access to this deck');
    }

    return this.statsService.calculateStats(deck.cards);
  }
}
