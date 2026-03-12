import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { CollectionService } from './collection.service';
import {
  collectionListSchema,
  collectionAddSchema,
  collectionUpdateSchema,
  collectionRemoveSchema,
  collectionAddBulkSchema,
  collectionGetByCardSchema,
} from '@la-grieta/shared';

@Injectable()
export class CollectionRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly collectionService: CollectionService,
  ) {}

  buildRouter() {
    const proc = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      list: proc
        .input(collectionListSchema)
        .query(({ ctx, input }) => this.collectionService.list(ctx.userId, input)),

      add: proc
        .input(collectionAddSchema)
        .mutation(({ ctx, input }) => this.collectionService.add(ctx.userId, input)),

      addBulk: proc
        .input(collectionAddBulkSchema)
        .mutation(({ ctx, input }) => this.collectionService.addBulk(ctx.userId, input)),

      update: proc
        .input(collectionUpdateSchema)
        .mutation(({ ctx, input }) => this.collectionService.update(ctx.userId, input)),

      remove: proc
        .input(collectionRemoveSchema)
        .mutation(({ ctx, input }) => this.collectionService.remove(ctx.userId, input)),

      getByCard: proc
        .input(collectionGetByCardSchema)
        .query(({ ctx, input }) => this.collectionService.getByCard(ctx.userId, input)),

      getUploadUrl: proc
        .input(z.object({ contentType: z.string() }))
        .mutation(({ ctx, input }) => this.collectionService.getUploadUrl(ctx.userId, input)),

      stats: proc
        .query(({ ctx }) => this.collectionService.stats(ctx.userId)),
    });
  }
}
