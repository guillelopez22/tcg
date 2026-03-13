import { Injectable, Logger, Inject } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, desc, sql } from 'drizzle-orm';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { DbClient } from '@la-grieta/db';
import { newsArticles } from '@la-grieta/db';
import type { NewsArticle } from '@la-grieta/db';

export interface ScrapedArticle {
  url: string;
  title: string;
  excerpt: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  source: string;
}

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);
  private isSyncing = false;

  constructor(
    @Inject('DB_CLIENT') private readonly db: DbClient,
  ) {}

  /** Sync on startup so dev environments get news data immediately. */
  async onModuleInit(): Promise<void> {
    await this.syncCron();
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
      this.logger.log('Starting news sync from riftbound.gg/blog');
      const articles = await this.scrapeRiftboundGg();
      await this.upsertArticles(articles);
      this.logger.log(`News sync complete — upserted ${articles.length} articles`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`News sync failed: ${message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  async scrapeRiftboundGg(): Promise<ScrapedArticle[]> {
    try {
      const response = await axios.get<string>('https://riftbound.gg/blog', {
        timeout: 10_000,
        headers: { 'User-Agent': 'LaGrieta-Bot/1.0 (Riftbound TCG companion app)' },
      });

      const $ = cheerio.load(response.data);
      const articles: ScrapedArticle[] = [];

      // Common blog listing patterns — try article, .post, .blog-post selectors
      const selectors = ['article', '.post', '.blog-post', '.entry', '[class*="article"]', '[class*="post"]'];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length === 0) continue;

        elements.each((_i, el) => {
          const $el = $(el);

          const titleEl = $el.find('h1, h2, h3, h4').first();
          const title = titleEl.text().trim();
          if (!title) return;

          const linkEl = $el.find('a').first();
          const href = linkEl.attr('href') ?? titleEl.closest('a').attr('href') ?? '';
          if (!href) return;

          const url = href.startsWith('http')
            ? href
            : `https://riftbound.gg${href.startsWith('/') ? '' : '/'}${href}`;

          const excerpt = $el.find('p').first().text().trim() || null;

          const imgEl = $el.find('img').first();
          const thumbnailUrl = imgEl.attr('src') ?? imgEl.attr('data-src') ?? null;

          const timeEl = $el.find('time').first();
          const dateStr = timeEl.attr('datetime') ?? timeEl.text().trim();
          let publishedAt: Date | null = null;
          if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              publishedAt = parsed;
            }
          }

          articles.push({
            url,
            title,
            excerpt: excerpt ?? null,
            thumbnailUrl: thumbnailUrl ?? null,
            publishedAt,
            source: 'riftbound.gg',
          });
        });

        if (articles.length > 0) break;
      }

      return articles;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to scrape riftbound.gg: ${message}`);
      return [];
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

  getSyncStatus(): { isSyncing: boolean } {
    return { isSyncing: this.isSyncing };
  }
}
