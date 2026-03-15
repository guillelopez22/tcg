import { Injectable, Logger, Inject } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { desc, sql, count } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import { newsArticles } from '@la-grieta/db';
import type { NewsArticle } from '@la-grieta/db';
import { NewsScraperService } from './news-scraper.service';
import type { ScrapedArticle } from './news-scraper.service';

/**
 * Domain allowlist for scraped content.
 * Only URLs whose hostname ends with one of these values are accepted.
 * This prevents open-redirect / SSRF-via-stored-link attacks if the scrapers
 * ever encounter a malicious redirect or injected content.
 */
const ALLOWED_DOMAINS = [
  'riftbound.leagueoflegends.com',
  'riftbound.gg',
  'riftdecks.com',
  'x.com',
  'twitter.com',
  'discord.com',
] as const;

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
   * The isSyncing guard prevents double-runs if the cron fires before the
   * startup sync completes.
   */
  onModuleInit(): void {
    void this.syncCron();
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
      const allArticles: ScrapedArticle[] = [];

      // Source 1: riftbound.gg (community wiki)
      try {
        this.logger.log('Syncing from riftbound.gg...');
        const gg = await this.scraper.scrapeRiftboundGg();
        allArticles.push(...gg);
        this.logger.log(`  riftbound.gg: ${gg.length} articles`);
      } catch (err) {
        this.logger.warn(`  riftbound.gg failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Source 2: official Riftbound news (Riot)
      try {
        this.logger.log('Syncing from official Riftbound...');
        const official = await this.scraper.scrapeOfficialRiftbound();
        allArticles.push(...official);
        this.logger.log(`  official: ${official.length} articles`);
      } catch (err) {
        this.logger.warn(`  official failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Source 3: riftdecks.com (tournament/meta news)
      try {
        this.logger.log('Syncing from riftdecks.com...');
        const rd = await this.scraper.scrapeRiftdecks();
        allArticles.push(...rd);
        this.logger.log(`  riftdecks.com: ${rd.length} articles`);
      } catch (err) {
        this.logger.warn(`  riftdecks.com failed: ${err instanceof Error ? err.message : String(err)}`);
      }

      await this.upsertArticles(allArticles);
      this.logger.log(`News sync complete — upserted ${allArticles.length} total articles`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`News sync failed: ${message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Returns true when `url` belongs to an allowed domain.
   * Validates that the string is a well-formed URL before comparing hostnames,
   * so a malformed URL is treated as not-allowed rather than throwing.
   */
  private isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Only https is accepted — reject http, data:, javascript:, etc.
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return ALLOWED_DOMAINS.some(
        (allowed) => host === allowed || host.endsWith(`.${allowed}`),
      );
    } catch {
      return false;
    }
  }

  /**
   * Sanitises a single article before it is persisted.
   * Returns null when the article URL itself is not allowed (skip entirely).
   * Strips the thumbnailUrl when it resolves to a disallowed domain.
   */
  private sanitiseArticle(article: ScrapedArticle): ScrapedArticle | null {
    if (!this.isAllowedUrl(article.url)) {
      this.logger.warn(`Skipping article with disallowed URL: ${article.url}`);
      return null;
    }

    let thumbnailUrl = article.thumbnailUrl;
    if (thumbnailUrl !== null && !this.isAllowedUrl(thumbnailUrl)) {
      this.logger.warn(`Stripping disallowed thumbnail URL: ${thumbnailUrl}`);
      thumbnailUrl = null;
    }

    return { ...article, thumbnailUrl };
  }

  // ---------------------------------------------------------------------------
  // DB operations
  // ---------------------------------------------------------------------------

  async upsertArticles(articles: ScrapedArticle[]): Promise<void> {
    if (articles.length === 0) return;

    for (const raw of articles) {
      // Validate and sanitise URL + thumbnail against the domain allowlist
      const article = this.sanitiseArticle(raw);
      if (article === null) continue;

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
