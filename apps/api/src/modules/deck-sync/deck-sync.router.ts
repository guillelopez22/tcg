import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DeckSyncService } from './deck-sync.service';

@Injectable()
export class DeckSyncRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly deckSyncService: DeckSyncService,
  ) {}

  buildRouter() {
    const protected_ = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      /**
       * Manually trigger a riftdecks.com sync.
       * Requires authentication. Returns sync results when the job completes.
       */
      trigger: protected_.mutation(() => this.deckSyncService.syncNow()),

      /**
       * Returns whether a sync is currently in progress.
       */
      status: protected_.query(() => this.deckSyncService.getSyncStatus()),
    });
  }
}
