import { Injectable, Logger, Inject } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { desc, sql, count } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { newsArticles } from '@la-grieta/db';
import type { NewsArticle } from '@la-grieta/db';
import { NewsScraperService } from './news-scraper.service';
import type { ScrapedArticle } from './news-scraper.service';

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);
  private isSyncing = false;

  constructor(
    @Inject('DB_CLIENT') private readonly db: DbClient,
    private readonly scraper: NewsScraperService,
  ) {}

  /**
   * Fire-and-forget startup sync. We don't await so the app boots instantly.
   * If the table already has articles, we still sync to refresh — the cron
   * cadence handles throttling in production.
   */
  onModuleInit(): void {
    // Delay slightly so the DB connection pool is fully ready
    setTimeout(() => {
      void this.syncCron();
    }, 3_000);
  }

  /** Runs every 4 hours. */
  @Cron('0 */4 * * *')
  async syncCron(): Promise<void> {
    if (this.isSyncing) {
      this.logger.warn('News sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;
    try {
      this.logger.log('Starting news sync from riftbound.gg');
      const articles = await this.scraper.scrapeRiftboundGg();
      await this.upsertArticles(articles);
      this.logger.log(`News sync complete — upserted ${articles.length} articles`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`News sync failed: ${message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  async upsertArticles(articles: ScrapedArticle[]): Promise<void> {
    if (articles.length === 0) return;

    for (const article of articles) {
      await this.db
        .insert(newsArticles)
        .values({
          url: article.url,
          title: article.title,
          excerpt: article.excerpt ?? undefined,
          thumbnailUrl: article.thumbnailUrl ?? undefined,
          source: article.source,
          publishedAt: article.publishedAt ?? undefined,
          scrapedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: newsArticles.url,
          set: {
            title: article.title,
            excerpt: article.excerpt ?? undefined,
            thumbnailUrl: article.thumbnailUrl ?? undefined,
            publishedAt: article.publishedAt ?? undefined,
            scrapedAt: new Date(),
          },
        });
    }
  }

  async getLatest(limit = 20): Promise<NewsArticle[]> {
    return this.db
      .select()
      .from(newsArticles)
      .orderBy(desc(sql`COALESCE(${newsArticles.publishedAt}, ${newsArticles.scrapedAt})`))
      .limit(limit);
  }

  async getCount(): Promise<number> {
    const [row] = await this.db.select({ count: count() }).from(newsArticles);
    return Number(row?.count ?? 0);
  }

  getSyncStatus(): { isSyncing: boolean } {
    return { isSyncing: this.isSyncing };
  }
}
