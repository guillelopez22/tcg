import { Module } from '@nestjs/common';
import { PriceSyncService } from './price-sync.service';
import { PriceSyncRouter } from './price-sync.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: PriceSyncService,
      useFactory: (db: DbClient) => new PriceSyncService(db),
      inject: [DB_TOKEN],
    },
    PriceSyncRouter,
  ],
  exports: [PriceSyncRouter, PriceSyncService],
})
export class PriceSyncModule {}
