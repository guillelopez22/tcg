import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core/core.module';
import { TrpcModule } from './trpc/trpc.module';
import { HealthModule } from './modules/health/health.module';
import { DeckSyncModule } from './modules/deck-sync/deck-sync.module';
import { MatchModule } from './modules/match/match.module';
import { NewsModule } from './modules/news/news.module';

@Module({
  imports: [ScheduleModule.forRoot(), CoreModule, TrpcModule, HealthModule, DeckSyncModule, MatchModule, NewsModule],
})
export class AppModule {}
