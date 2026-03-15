import { Module } from '@nestjs/common';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import { NewsScraperService } from './news-scraper.service';
import { NewsService } from './news.service';
import { NewsRouter } from './news.router';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    NewsScraperService,
    {
      provide: NewsService,
      useFactory: (db: DbClient, scraper: NewsScraperService) => new NewsService(db, scraper),
      inject: [DB_TOKEN, NewsScraperService],
    },
    NewsRouter,
  ],
  exports: [NewsRouter, NewsService, NewsScraperService],
})
export class NewsModule {}
