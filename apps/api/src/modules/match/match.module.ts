import { Module } from '@nestjs/common';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import { MatchService } from './match.service';
import { MatchRouter } from './match.router';
import { MatchGateway } from './match.gateway';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: MatchService,
      useFactory: (db: DbClient) => new MatchService(db),
      inject: [DB_TOKEN],
    },
    MatchRouter,
    MatchGateway,
  ],
  exports: [MatchRouter, MatchService],
})
export class MatchModule {}
