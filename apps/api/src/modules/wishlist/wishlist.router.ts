import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { WishlistService } from './wishlist.service';
import {
  wishlistToggleSchema,
  wishlistUpdateSchema,
  wishlistListSchema,
} from '@la-grieta/shared';

@Injectable()
export class WishlistRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly wishlistService: WishlistService,
  ) {}

  buildRouter() {
    const proc = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      toggle: proc
        .input(wishlistToggleSchema)
        .mutation(({ ctx, input }) => this.wishlistService.toggle(ctx.userId, input)),

      update: proc
        .input(wishlistUpdateSchema)
        .mutation(({ ctx, input }) => this.wishlistService.update(ctx.userId, input)),

      list: proc
        .input(wishlistListSchema)
        .query(({ ctx, input }) => this.wishlistService.list(ctx.userId, input)),

      getForCard: proc
        .input(z.object({ cardId: z.string().uuid() }))
        .query(({ ctx, input }) => this.wishlistService.getForCard(ctx.userId, input.cardId)),
    });
  }
}
