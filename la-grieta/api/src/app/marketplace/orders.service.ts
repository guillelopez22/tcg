import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrderDto,
  UpdateOrderStatusDto,
  OrderStatus,
  OrderFiltersDto,
  ListingStatus,
} from '@la-grieta/shared';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  private calculatePlatformFee(subtotal: number): number {
    // 5% platform fee
    return Math.round(subtotal * 0.05 * 100) / 100;
  }

  private calculateShippingCost(itemCount: number): number {
    // Simple shipping calculation: $5 base + $1 per additional item
    return itemCount > 0 ? 5 + (itemCount - 1) * 1 : 0;
  }

  async create(userId: string, dto: CreateOrderDto) {
    // Get listing with items
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
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

    if (!listing) {
      throw new NotFoundException(`Listing with ID ${dto.listingId} not found`);
    }

    if (listing.sellerId === userId) {
      throw new BadRequestException('You cannot purchase your own listing');
    }

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('This listing is not available for purchase');
    }

    if (!listing.price) {
      throw new BadRequestException('This listing has no price set');
    }

    // Calculate costs
    const subtotal = listing.price;
    const itemCount = listing.items.reduce((sum, item) => sum + item.quantity, 0);
    const shippingCost = this.calculateShippingCost(itemCount);
    const platformFee = this.calculatePlatformFee(subtotal);
    const total = subtotal + shippingCost + platformFee;

    // Create order and mark listing as sold in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Mark listing as sold
      await tx.listing.update({
        where: { id: dto.listingId },
        data: {
          status: ListingStatus.SOLD,
        },
      });

      // Create order
      const newOrder = await tx.order.create({
        data: {
          buyerId: userId,
          sellerId: listing.sellerId,
          listingId: dto.listingId,
          subtotal,
          shippingCost,
          platformFee,
          total,
          status: OrderStatus.PENDING_PAYMENT,
          shippingAddress: dto.shippingAddress as any,
        },
        include: {
          buyer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      return newOrder;
    });

    return order;
  }

  async findUserOrders(userId: string, filters: OrderFiltersDto) {
    const { status, page = 1, limit = 20 } = filters;

    const where: any = {
      buyerId: userId,
    };

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          seller: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findUserSales(userId: string, filters: OrderFiltersDto) {
    const { status, page = 1, limit = 20 } = filters;

    const where: any = {
      sellerId: userId,
    };

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          buyer: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only buyer or seller can view order details
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async updateStatus(userId: string, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only seller can update order status
    if (order.sellerId !== userId) {
      throw new ForbiddenException('Only the seller can update order status');
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAYMENT_HELD, OrderStatus.CANCELLED],
      [OrderStatus.PAYMENT_HELD]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${dto.status}`
      );
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        trackingNumber: dto.trackingNumber,
        updatedAt: new Date(),
      },
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  async confirmReceipt(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only buyer can confirm receipt
    if (order.buyerId !== userId) {
      throw new ForbiddenException('Only the buyer can confirm receipt');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Order must be in DELIVERED status to confirm receipt');
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.COMPLETED,
        escrowReleasedAt: new Date(),
      },
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    return updated;
  }

  async cancel(userId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: true,
        seller: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Both buyer and seller can cancel under certain conditions
    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You do not have access to this order');
    }

    // Can only cancel if not shipped or completed
    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(
      order.status as OrderStatus
    )) {
      throw new BadRequestException(
        'Cannot cancel order that has been shipped or completed'
      );
    }

    // Update order and listing in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Reactivate the listing
      await tx.listing.update({
        where: { id: order.listingId },
        data: {
          status: ListingStatus.ACTIVE,
        },
      });

      // Cancel the order
      const cancelledOrder = await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: {
          buyer: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });

      return cancelledOrder;
    });

    return updated;
  }
}
