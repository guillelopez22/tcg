import { Module } from '@nestjs/common';
import { DeckSyncService } from './deck-sync.service';
import { DeckSyncRouter } from './deck-sync.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';

@Module({
  imports: [TrpcCoreModule],
  providers: [DeckSyncService, DeckSyncRouter],
  exports: [DeckSyncRouter, DeckSyncService],
})
export class DeckSyncModule {}
