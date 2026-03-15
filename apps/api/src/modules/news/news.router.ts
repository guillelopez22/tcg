import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { NewsService } from './news.service';

@Injectable()
export class NewsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly newsService: NewsService,
  ) {}

  buildRouter() {
    return this.trpc.router({
      getLatest: this.trpc.rateLimitedPublicProcedure
        .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
        .query(({ input }) => this.newsService.getLatest(input?.limit ?? 20)),

      getCount: this.trpc.rateLimitedPublicProcedure
        .query(() => this.newsService.getCount()),

      getSyncStatus: this.trpc.rateLimitedPublicProcedure
        .query(() => this.newsService.getSyncStatus()),

      triggerSync: this.trpc.rateLimitedProtectedProcedure
        .mutation(async () => {
          // Non-blocking — returns immediately, sync runs in background
          void this.newsService.syncCron();
          return { success: true };
        }),
    });
  }
}
