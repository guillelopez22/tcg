import { Module } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { WishlistRouter } from './wishlist.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN, REDIS_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import type Redis from 'ioredis';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: WishlistService,
      useFactory: (db: DbClient, redis: Redis) => new WishlistService(db, redis),
      inject: [DB_TOKEN, REDIS_TOKEN],
    },
    WishlistRouter,
  ],
  exports: [WishlistRouter, WishlistService],
})
export class WishlistModule {}
