import { Module } from '@nestjs/common';
import { DeckService } from './deck.service';
import { DeckRouter } from './deck.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN, REDIS_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import type Redis from 'ioredis';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: DeckService,
      useFactory: (db: DbClient, redis: Redis) => new DeckService(db, redis),
      inject: [DB_TOKEN, REDIS_TOKEN],
    },
    DeckRouter,
  ],
  exports: [DeckRouter, DeckService],
})
export class DeckModule {}
