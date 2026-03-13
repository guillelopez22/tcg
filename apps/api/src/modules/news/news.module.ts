import { Module } from '@nestjs/common';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import { NewsService } from './news.service';
import { NewsRouter } from './news.router';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: NewsService,
      useFactory: (db: DbClient) => new NewsService(db),
      inject: [DB_TOKEN],
    },
    NewsRouter,
  ],
  exports: [NewsRouter, NewsService],
})
export class NewsModule {}
