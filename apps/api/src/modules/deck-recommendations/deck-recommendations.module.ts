import { Module } from '@nestjs/common';
import { DeckRecommendationsService } from './deck-recommendations.service';
import { DeckRecommendationsRouter } from './deck-recommendations.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN, REDIS_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import type Redis from 'ioredis';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: DeckRecommendationsService,
      useFactory: (db: DbClient, redis: Redis) =>
        new DeckRecommendationsService(db, redis),
      inject: [DB_TOKEN, REDIS_TOKEN],
    },
    DeckRecommendationsRouter,
  ],
  exports: [DeckRecommendationsRouter, DeckRecommendationsService],
})
export class DeckRecommendationsModule {}
