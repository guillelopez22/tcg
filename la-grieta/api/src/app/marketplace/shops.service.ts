import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShopDto, UpdateShopDto } from '@la-grieta/shared';

@Injectable()
export class ShopsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateShopDto) {
    // Check if user already has a shop
    const existingShop = await this.prisma.shop.findUnique({
      where: { userId },
    });

    if (existingShop) {
      throw new ConflictException('User already has a shop');
    }

    // Check if slug is already taken
    const slugExists = await this.prisma.shop.findUnique({
      where: { slug: dto.slug },
    });

    if (slugExists) {
      throw new ConflictException('Shop slug is already taken');
    }

    // Validate slug format (alphanumeric and hyphens only)
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(dto.slug)) {
      throw new BadRequestException(
        'Shop slug must contain only lowercase letters, numbers, and hyphens'
      );
    }

    const shop = await this.prisma.shop.create({
      data: {
        userId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        logoUrl: dto.logoUrl,
      },
    });

    return shop;
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
          _count: {
            select: {
              listings: {
                where: {
                  status: 'ACTIVE',
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.shop.count(),
    ]);

    return {
      shops: shops.map((shop) => ({
        ...shop,
        activeListingsCount: shop._count.listings,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        listings: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: {
                card: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop with ID ${id} not found`);
    }

    return shop;
  }

  async findBySlug(slug: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
        listings: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: {
                card: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop with slug '${slug}' not found`);
    }

    return shop;
  }

  async getMyShop(userId: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { userId },
      include: {
        listings: {
          include: {
            items: {
              include: {
                card: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException('You do not have a shop yet');
    }

    return shop;
  }

  async update(userId: string, id: string, dto: UpdateShopDto) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      throw new NotFoundException(`Shop with ID ${id} not found`);
    }

    if (shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    const updated = await this.prisma.shop.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        logoUrl: dto.logoUrl,
      },
      include: {
        listings: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: {
                card: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  async delete(userId: string, id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            listings: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!shop) {
      throw new NotFoundException(`Shop with ID ${id} not found`);
    }

    if (shop.userId !== userId) {
      throw new ForbiddenException('You do not own this shop');
    }

    if (shop._count.listings > 0) {
      throw new BadRequestException(
        'Cannot delete shop with active listings. Cancel or complete all listings first.'
      );
    }

    await this.prisma.shop.delete({
      where: { id },
    });

    return {
      message: 'Shop deleted successfully',
    };
  }
}
