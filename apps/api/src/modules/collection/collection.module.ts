import { Module } from '@nestjs/common';
import { CollectionService } from './collection.service';
import { CollectionRouter } from './collection.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN, REDIS_TOKEN, R2_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import type Redis from 'ioredis';
import type { R2Service } from './collection.service';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: CollectionService,
      useFactory: (db: DbClient, redis: Redis, r2: R2Service) =>
        new CollectionService(db, redis, r2),
      inject: [DB_TOKEN, REDIS_TOKEN, R2_TOKEN],
    },
    CollectionRouter,
  ],
  exports: [CollectionRouter, CollectionService],
})
export class CollectionModule {}
