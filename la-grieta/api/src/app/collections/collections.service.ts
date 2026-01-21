import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddCardToCollectionDto } from './dto/add-card.dto';
import { UpdateCollectionItemDto } from './dto/update-item.dto';
import {
  CollectionResponseDto,
  CollectionStatsResponseDto,
} from '@la-grieta/shared';

@Injectable()
export class CollectionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateCollectionDto) {
    // If no name provided, generate a default name
    let collectionName = dto.name;
    if (!collectionName || collectionName.trim() === '') {
      const userCollections = await this.prisma.collection.count({
        where: { userId },
      });
      collectionName = `My Collection #${userCollections + 1}`;
    }

    const collection = await this.prisma.collection.create({
      data: {
        userId,
        name: collectionName,
        description: dto.description,
      },
      include: {
        items: {
          include: {
            card: true,
          },
        },
      },
    });

    return {
      ...collection,
      itemCount: collection.items.length,
    };
  }

  async findAll(userId: string) {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return collections.map((collection) => ({
      id: collection.id,
      userId: collection.userId,
      name: collection.name,
      description: collection.description,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      itemCount: collection._count.items,
    }));
  }

  async findOne(userId: string, id: string): Promise<CollectionResponseDto> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            card: true,
          },
          orderBy: {
            acquiredAt: 'desc',
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    return {
      ...collection,
      itemCount: collection.items.length,
    };
  }

  async update(userId: string, id: string, dto: UpdateCollectionDto) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    const updated = await this.prisma.collection.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        items: {
          include: {
            card: true,
          },
        },
      },
    });

    return {
      ...updated,
      itemCount: updated.items.length,
    };
  }

  async remove(userId: string, id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${id} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    // Note: Items will be cascade deleted due to schema configuration
    await this.prisma.collection.delete({
      where: { id },
    });

    return {
      message: 'Collection deleted successfully',
      deletedItemsCount: collection._count.items,
    };
  }

  async addCard(userId: string, collectionId: string, dto: AddCardToCollectionDto) {
    // Verify collection ownership
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${collectionId} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    // Verify card exists
    const card = await this.prisma.card.findUnique({
      where: { id: dto.cardId },
    });

    if (!card) {
      throw new NotFoundException(`Card with ID ${dto.cardId} not found`);
    }

    // Check if card already exists with same condition
    const existingItem = await this.prisma.collectionItem.findUnique({
      where: {
        collectionId_cardId_condition: {
          collectionId,
          cardId: dto.cardId,
          condition: dto.condition,
        },
      },
    });

    let collectionItem;

    if (existingItem) {
      // Increment quantity
      collectionItem = await this.prisma.collectionItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + dto.quantity,
        },
        include: {
          card: true,
        },
      });
    } else {
      // Create new item
      collectionItem = await this.prisma.collectionItem.create({
        data: {
          collectionId,
          cardId: dto.cardId,
          quantity: dto.quantity,
          condition: dto.condition,
        },
        include: {
          card: true,
        },
      });
    }

    return collectionItem;
  }

  async updateItem(
    userId: string,
    collectionId: string,
    itemId: string,
    dto: UpdateCollectionItemDto
  ) {
    // Verify collection ownership
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${collectionId} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    // Verify item exists in this collection
    const item = await this.prisma.collectionItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Collection item with ID ${itemId} not found`);
    }

    if (item.collectionId !== collectionId) {
      throw new BadRequestException('Item does not belong to this collection');
    }

    // If condition is being changed, check for duplicates
    if (dto.condition && dto.condition !== item.condition) {
      const existingWithCondition = await this.prisma.collectionItem.findUnique({
        where: {
          collectionId_cardId_condition: {
            collectionId,
            cardId: item.cardId,
            condition: dto.condition,
          },
        },
      });

      if (existingWithCondition) {
        throw new ConflictException(
          `Card already exists in collection with condition ${dto.condition}`
        );
      }
    }

    const updated = await this.prisma.collectionItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        condition: dto.condition,
      },
      include: {
        card: true,
      },
    });

    return updated;
  }

  async removeItem(userId: string, collectionId: string, itemId: string) {
    // Verify collection ownership
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${collectionId} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    // Verify item exists in this collection
    const item = await this.prisma.collectionItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`Collection item with ID ${itemId} not found`);
    }

    if (item.collectionId !== collectionId) {
      throw new BadRequestException('Item does not belong to this collection');
    }

    await this.prisma.collectionItem.delete({
      where: { id: itemId },
    });

    return {
      message: 'Card removed from collection successfully',
    };
  }

  async getStats(
    userId: string,
    collectionId: string
  ): Promise<CollectionStatsResponseDto> {
    // Verify collection ownership
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        items: {
          include: {
            card: true,
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${collectionId} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    // Calculate statistics
    const totalUniqueCards = collection.items.length;
    const totalQuantity = collection.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // Group by rarity
    const cardsByRarity: Record<string, number> = {};
    collection.items.forEach((item) => {
      const rarity = item.card.rarity;
      cardsByRarity[rarity] = (cardsByRarity[rarity] || 0) + item.quantity;
    });

    // Group by card type
    const cardsByType: Record<string, number> = {};
    collection.items.forEach((item) => {
      const cardType = item.card.cardType;
      cardsByType[cardType] = (cardsByType[cardType] || 0) + item.quantity;
    });

    // Calculate estimated market value
    const estimatedMarketValue = collection.items.reduce((sum, item) => {
      const price = item.card.marketPrice || 0;
      return sum + price * item.quantity;
    }, 0);

    return {
      totalUniqueCards,
      totalQuantity,
      cardsByRarity,
      cardsByType,
      estimatedMarketValue: Math.round(estimatedMarketValue * 100) / 100, // Round to 2 decimals
    };
  }

  async seedCollection(userId: string, collectionId: string) {
    // Verify collection ownership
    const collection = await this.prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new NotFoundException(`Collection with ID ${collectionId} not found`);
    }

    if (collection.userId !== userId) {
      throw new ForbiddenException('You do not have access to this collection');
    }

    // Get random cards from database
    const cards = await this.prisma.card.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (cards.length === 0) {
      throw new BadRequestException('No cards available in database to seed');
    }

    const conditions = ['MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'PLAYED'];
    const addedItems = [];

    for (const card of cards) {
      const randomCondition =
        conditions[Math.floor(Math.random() * conditions.length)];
      const randomQuantity = Math.floor(Math.random() * 5) + 1; // 1-5 cards

      try {
        const item = await this.prisma.collectionItem.upsert({
          where: {
            collectionId_cardId_condition: {
              collectionId,
              cardId: card.id,
              condition: randomCondition,
            },
          },
          update: {
            quantity: {
              increment: randomQuantity,
            },
          },
          create: {
            collectionId,
            cardId: card.id,
            quantity: randomQuantity,
            condition: randomCondition,
          },
          include: {
            card: true,
          },
        });
        addedItems.push(item);
      } catch (error) {
        // Skip if there's a unique constraint violation
        continue;
      }
    }

    return {
      message: `Successfully added ${addedItems.length} cards to collection`,
      items: addedItems,
    };
  }
}
