import { Injectable } from '@nestjs/common';
import { TrpcService } from '../../trpc/trpc.service';
import { DeckRecommendationsService } from './deck-recommendations.service';

@Injectable()
export class DeckRecommendationsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly deckRecommendationsService: DeckRecommendationsService,
  ) {}

  buildRouter() {
    const proc = this.trpc.rateLimitedProtectedProcedure;

    return this.trpc.router({
      getRecommendations: proc
        .query(({ ctx }) => this.deckRecommendationsService.getRecommendations(ctx.userId)),
    });
  }
}
