import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateListingDto,
  UpdateListingDto,
  ListingFiltersDto,
  ListingStatus,
  ListingType,
} from '@la-grieta/shared';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateListingDto) {
    // Validate listing type and required fields
    if (dto.type === ListingType.FIXED_PRICE && !dto.price) {
      throw new BadRequestException('Fixed price listings require a price');
    }

    if (dto.type === ListingType.AUCTION) {
      if (!dto.startingBid || !dto.endsAt) {
        throw new BadRequestException(
          'Auction listings require a starting bid and end date'
        );
      }
      if (new Date(dto.endsAt) <= new Date()) {
        throw new BadRequestException('Auction end date must be in the future');
      }
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Listing must include at least one item');
    }

    // Verify shop ownership if shopId provided
    if (dto.shopId) {
      const shop = await this.prisma.shop.findUnique({
        where: { id: dto.shopId },
      });

      if (!shop) {
        throw new NotFoundException(`Shop with ID ${dto.shopId} not found`);
      }

      if (shop.userId !== userId) {
        throw new ForbiddenException('You do not own this shop');
      }
    }

    // Verify all cards exist
    const cardIds = dto.items.map((item) => item.cardId);
    const cards = await this.prisma.card.findMany({
      where: { id: { in: cardIds } },
    });

    if (cards.length !== cardIds.length) {
      throw new BadRequestException('One or more cards not found');
    }

    // Create listing with items
    const listing = await this.prisma.listing.create({
      data: {
        sellerId: userId,
        shopId: dto.shopId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        status: ListingStatus.ACTIVE,
        price: dto.price,
        startingBid: dto.startingBid,
        currentBid: dto.startingBid,
        buyNowPrice: dto.buyNowPrice,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        items: {
          create: dto.items.map((item) => ({
            cardId: item.cardId,
            quantity: item.quantity,
            condition: item.condition,
          })),
        },
      },
      include: {
        items: {
          include: {
            card: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
        shop: true,
      },
    });

    return listing;
  }

  async findAll(filters: ListingFiltersDto) {
    const {
      status,
      type,
      cardId,
      sellerId,
      minPrice,
      maxPrice,
      search,
      shopId,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (shopId) {
      where.shopId = shopId;
    }

    if (cardId) {
      where.items = {
        some: {
          cardId: cardId,
        },
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              card: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
            },
          },
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            card: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        shop: true,
        bids: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    return listing;
  }

  async update(userId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You do not own this listing');
    }

    // Prevent updates to sold/expired listings
    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException('Cannot update a sold listing');
    }

    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        price: dto.price,
        buyNowPrice: dto.buyNowPrice,
        status: dto.status,
      },
      include: {
        items: {
          include: {
            card: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
        shop: true,
      },
    });

    return updated;
  }

  async remove(userId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    if (listing.sellerId !== userId) {
      throw new ForbiddenException('You do not own this listing');
    }

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException('Cannot delete a sold listing');
    }

    // Soft delete by marking as cancelled
    await this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.CANCELLED,
      },
    });

    return {
      message: 'Listing cancelled successfully',
    };
  }

  async purchase(userId: string, id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            card: true,
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${id} not found`);
    }

    if (listing.sellerId === userId) {
      throw new BadRequestException('You cannot purchase your own listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('This listing is not available for purchase');
    }

    if (listing.type !== ListingType.FIXED_PRICE) {
      throw new BadRequestException('Only fixed price listings can be purchased directly');
    }

    if (!listing.price) {
      throw new BadRequestException('This listing has no price set');
    }

    // Mark listing as sold
    const updated = await this.prisma.listing.update({
      where: { id },
      data: {
        status: ListingStatus.SOLD,
      },
      include: {
        items: {
          include: {
            card: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return {
      message: 'Listing purchased successfully',
      listing: updated,
    };
  }
}
