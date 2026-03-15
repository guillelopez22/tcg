import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedArticle {
  url: string;
  title: string;
  excerpt: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  source: string;
}

@Injectable()
export class NewsScraperService {
  private readonly logger = new Logger(NewsScraperService.name);

  /**
   * Multi-strategy scraper:
   * 1. RSS/Atom feed  (most reliable — structured data)
   * 2. Sitemap XML   (structured URLs + lastmod dates)
   * 3. HTML fallback (Next.js JSON chunks + generic selectors)
   */
  async scrapeRiftboundGg(): Promise<ScrapedArticle[]> {
    // Strategy 1: RSS/Atom
    const rssArticles = await this.tryRssFeed();
    if (rssArticles.length > 0) {
      this.logger.log(`RSS strategy yielded ${rssArticles.length} articles`);
      return rssArticles;
    }

    // Strategy 2: Sitemap
    const sitemapArticles = await this.trySitemapXml();
    if (sitemapArticles.length > 0) {
      this.logger.log(`Sitemap strategy yielded ${sitemapArticles.length} articles`);
      return sitemapArticles;
    }

    // Strategy 3: HTML scrape with Next.js data extraction
    const htmlArticles = await this.tryHtmlScrape();
    this.logger.log(`HTML strategy yielded ${htmlArticles.length} articles`);
    return htmlArticles;
  }

  // ---------------------------------------------------------------------------
  // Strategy 1: RSS / Atom
  // ---------------------------------------------------------------------------

  private async tryRssFeed(): Promise<ScrapedArticle[]> {
    const feedUrls = [
      'https://riftbound.gg/feed',
      'https://riftbound.gg/rss',
      'https://riftbound.gg/feed.xml',
      'https://riftbound.gg/rss.xml',
      'https://riftbound.gg/blog/feed',
      'https://riftbound.gg/blog/rss',
      'https://riftbound.gg/blog.rss',
      'https://riftbound.gg/blog/feed.xml',
    ];

    for (const feedUrl of feedUrls) {
      try {
        const response = await axios.get<string>(feedUrl, {
          timeout: 8_000,
          headers: { 'User-Agent': 'LaGrieta-Bot/1.0 (companion app for Riftbound TCG)' },
        });

        const contentType = String(response.headers['content-type'] ?? '');
        const body = response.data;

        // Must look like XML/RSS
        if (
          !contentType.includes('xml') &&
          !contentType.includes('rss') &&
          !contentType.includes('atom') &&
          !String(body).trimStart().startsWith('<')
        ) {
          continue;
        }

        const articles = this.parseRssXml(String(body));
        if (articles.length > 0) return articles;
      } catch {
        // try next URL
      }
    }

    return [];
  }

  private parseRssXml(xml: string): ScrapedArticle[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const articles: ScrapedArticle[] = [];

    // RSS 2.0 items
    $('item').each((_i, el) => {
      const $el = $(el);
      const title = $el.find('title').first().text().trim();
      const link = $el.find('link').first().text().trim() ||
        $el.find('guid').first().text().trim();

      if (!title || !link) return;

      const url = link.startsWith('http') ? link : `https://riftbound.gg${link}`;
      const excerpt = $el.find('description').first().text().replace(/<[^>]+>/g, '').trim() || null;
      const enclosureUrl = $el.find('enclosure[type^="image"]').attr('url') ??
        $el.find('media\\:thumbnail, media\\:content').attr('url') ??
        null;
      const imageTagUrl = $el.find('image url').first().text().trim() || null;
      const thumbnailUrl = enclosureUrl ?? imageTagUrl;

      const pubDateStr = $el.find('pubDate').first().text().trim() ||
        $el.find('published').first().text().trim() ||
        $el.find('updated').first().text().trim();
      let publishedAt: Date | null = null;
      if (pubDateStr) {
        const parsed = new Date(pubDateStr);
        if (!isNaN(parsed.getTime())) publishedAt = parsed;
      }

      articles.push({
        url,
        title,
        excerpt: excerpt ? excerpt.slice(0, 500) : null,
        thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null,
        publishedAt,
        source: 'riftbound.gg',
      });
    });

    if (articles.length > 0) return articles;

    // Atom feed entries
    $('entry').each((_i, el) => {
      const $el = $(el);
      const title = $el.find('title').first().text().trim();
      const link = $el.find('link[rel="alternate"]').attr('href') ??
        $el.find('link').first().attr('href') ?? '';

      if (!title || !link) return;

      const url = link.startsWith('http') ? link : `https://riftbound.gg${link}`;
      const excerpt = $el.find('summary').first().text().trim() ||
        $el.find('content').first().text().replace(/<[^>]+>/g, '').trim().slice(0, 500) ||
        null;

      const pubDateStr = $el.find('published').first().text().trim() ||
        $el.find('updated').first().text().trim();
      let publishedAt: Date | null = null;
      if (pubDateStr) {
        const parsed = new Date(pubDateStr);
        if (!isNaN(parsed.getTime())) publishedAt = parsed;
      }

      articles.push({
        url,
        title,
        excerpt: excerpt || null,
        thumbnailUrl: null,
        publishedAt,
        source: 'riftbound.gg',
      });
    });

    return articles;
  }

  // ---------------------------------------------------------------------------
  // Strategy 2: Sitemap XML
  // ---------------------------------------------------------------------------

  private async trySitemapXml(): Promise<ScrapedArticle[]> {
    const sitemapUrls = [
      'https://riftbound.gg/sitemap.xml',
      'https://riftbound.gg/sitemap-0.xml',
      'https://riftbound.gg/sitemap_index.xml',
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await axios.get<string>(sitemapUrl, {
          timeout: 8_000,
          headers: { 'User-Agent': 'LaGrieta-Bot/1.0' },
        });

        const body = String(response.data);
        if (!body.trimStart().startsWith('<')) continue;

        const $ = cheerio.load(body, { xmlMode: true });
        const articles: ScrapedArticle[] = [];

        // Check if this is a sitemap index — if so, find blog sub-sitemap
        const sitemapRefs = $('sitemapindex sitemap loc');
        if (sitemapRefs.length > 0) {
          // Look for a blog-specific sitemap
          const blogSitemapUrl = sitemapRefs
            .toArray()
            .map((el) => $(el).text().trim())
            .find((u) => u.includes('blog') || u.includes('post') || u.includes('news'));

          if (blogSitemapUrl) {
            const subArticles = await this.parseSitemapFromUrl(blogSitemapUrl);
            if (subArticles.length > 0) return subArticles;
          }
          continue;
        }

        // Parse URL set directly — filter to blog URLs
        $('url').each((_i, el) => {
          const $el = $(el);
          const loc = $el.find('loc').text().trim();
          if (!loc || (!loc.includes('/blog') && !loc.includes('/news') && !loc.includes('/post'))) return;
          if (loc === 'https://riftbound.gg/blog' || loc === 'https://riftbound.gg/news') return;

          const lastmod = $el.find('lastmod').text().trim();
          let publishedAt: Date | null = null;
          if (lastmod) {
            const parsed = new Date(lastmod);
            if (!isNaN(parsed.getTime())) publishedAt = parsed;
          }

          // Derive a title from the URL slug
          const slug = loc.split('/').filter(Boolean).pop() ?? '';
          const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          if (!title) return;

          articles.push({
            url: loc,
            title,
            excerpt: null,
            thumbnailUrl: null,
            publishedAt,
            source: 'riftbound.gg',
          });
        });

        if (articles.length > 0) return articles;
      } catch {
        // try next
      }
    }

    return [];
  }

  private async parseSitemapFromUrl(sitemapUrl: string): Promise<ScrapedArticle[]> {
    try {
      const response = await axios.get<string>(sitemapUrl, {
        timeout: 8_000,
        headers: { 'User-Agent': 'LaGrieta-Bot/1.0' },
      });
      const $ = cheerio.load(String(response.data), { xmlMode: true });
      const articles: ScrapedArticle[] = [];

      $('url').each((_i, el) => {
        const $el = $(el);
        const loc = $el.find('loc').text().trim();
        if (!loc) return;

        const lastmod = $el.find('lastmod').text().trim();
        let publishedAt: Date | null = null;
        if (lastmod) {
          const parsed = new Date(lastmod);
          if (!isNaN(parsed.getTime())) publishedAt = parsed;
        }

        const slug = loc.split('/').filter(Boolean).pop() ?? '';
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        if (!title) return;

        articles.push({
          url: loc,
          title,
          excerpt: null,
          thumbnailUrl: null,
          publishedAt,
          source: 'riftbound.gg',
        });
      });

      return articles;
    } catch {
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 3: HTML scrape with Next.js __NEXT_DATA__ extraction
  // ---------------------------------------------------------------------------

  private async tryHtmlScrape(): Promise<ScrapedArticle[]> {
    try {
      const response = await axios.get<string>('https://riftbound.gg/blog', {
        timeout: 12_000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LaGrieta-Bot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const body = String(response.data);
      const $ = cheerio.load(body);

      // Attempt 1: Extract Next.js server-side data from __NEXT_DATA__ script
      const nextDataScript = $('#__NEXT_DATA__').text().trim();
      if (nextDataScript) {
        const articles = this.parseNextData(nextDataScript);
        if (articles.length > 0) return articles;
      }

      // Attempt 2: Extract from inline JSON props (Gatsby / other SSG)
      const windowDataMatch = body.match(/window\.__staticRouterHydrationData\s*=\s*({.+?});/s) ??
        body.match(/window\.__GATSBY_STORY_DATA\s*=\s*({.+?});/s);
      if (windowDataMatch?.[1]) {
        try {
          const data: unknown = JSON.parse(windowDataMatch[1]);
          const articles = this.extractArticlesFromJsonBlob(data);
          if (articles.length > 0) return articles;
        } catch {
          // ignore parse error
        }
      }

      // Attempt 3: Generic HTML selectors — try many patterns
      const articles: ScrapedArticle[] = [];
      const selectors = [
        'article',
        '[data-testid*="article"]',
        '[data-testid*="post"]',
        '[data-testid*="blog"]',
        '.blog-post',
        '.blog-card',
        '.post-card',
        '.news-card',
        '.article-card',
        '.entry',
        '[class*="BlogPost"]',
        '[class*="PostCard"]',
        '[class*="ArticleCard"]',
        '[class*="blog-post"]',
        '[class*="post-card"]',
        // Webflow CMS collection list items
        '.w-dyn-item',
        '.collection-item',
      ];

      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length === 0) continue;

        elements.each((_i, el) => {
          const article = this.parseHtmlElement($, el);
          if (article) articles.push(article);
        });

        if (articles.length > 0) break;
      }

      // Attempt 4: Find all links that look like blog posts
      if (articles.length === 0) {
        $('a[href*="/blog/"]').each((_i, el) => {
          const $el = $(el);
          const href = $el.attr('href') ?? '';
          if (!href || href === '/blog' || href === '/blog/') return;

          const url = href.startsWith('http') ? href : `https://riftbound.gg${href}`;
          const titleText = $el.find('h1, h2, h3, h4').first().text().trim() ||
            $el.text().trim();
          if (!titleText || titleText.length > 200) return;

          // Avoid duplicates
          if (articles.some((a) => a.url === url)) return;

          const imgEl = $el.find('img').first();
          const thumbnailUrl = imgEl.attr('src') ?? imgEl.attr('data-src') ?? null;

          articles.push({
            url,
            title: titleText,
            excerpt: null,
            thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null,
            publishedAt: null,
            source: 'riftbound.gg',
          });
        });
      }

      return articles;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`HTML scrape failed: ${message}`);
      return [];
    }
  }

  private parseHtmlElement(
    $: ReturnType<typeof cheerio.load>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    el: any,
  ): ScrapedArticle | null {
    const $el = $(el);

    const titleEl = $el.find('h1, h2, h3, h4').first();
    const title = titleEl.text().trim();
    if (!title) return null;

    // Find link — check title's parent <a>, then any <a> in element
    const linkEl = titleEl.closest('a');
    const href = linkEl.attr('href') ??
      $el.find('a').first().attr('href') ?? '';
    if (!href) return null;

    const url = href.startsWith('http')
      ? href
      : `https://riftbound.gg${href.startsWith('/') ? '' : '/'}${href}`;

    // Only keep riftbound.gg URLs
    if (!url.includes('riftbound.gg')) return null;

    const excerpt = $el.find('p').first().text().trim().slice(0, 500) || null;

    const imgEl = $el.find('img').first();
    const thumbnailUrl = imgEl.attr('src') ?? imgEl.attr('data-src') ?? null;

    const timeEl = $el.find('time').first();
    const dateStr = timeEl.attr('datetime') ?? timeEl.text().trim();
    let publishedAt: Date | null = null;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) publishedAt = parsed;
    }

    return {
      url,
      title,
      excerpt,
      thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : null,
      publishedAt,
      source: 'riftbound.gg',
    };
  }

  private parseNextData(json: string): ScrapedArticle[] {
    try {
      const data: unknown = JSON.parse(json);
      return this.extractArticlesFromJsonBlob(data);
    } catch {
      return [];
    }
  }

  private extractArticlesFromJsonBlob(data: unknown): ScrapedArticle[] {
    const articles: ScrapedArticle[] = [];

    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      const obj = node as Record<string, unknown>;

      // Detect article-like objects: must have title + (url or slug or href)
      const title = this.stringField(obj, ['title', 'name', 'heading']);
      const url = this.stringField(obj, ['url', 'href', 'link', 'permalink', 'fullSlug', 'full_slug']);
      const slug = this.stringField(obj, ['slug', 'handle', 'path']);

      if (title && (url || slug)) {
        const fullUrl = url
          ? (url.startsWith('http') ? url : `https://riftbound.gg${url.startsWith('/') ? '' : '/blog/'}${url}`)
          : `https://riftbound.gg/blog/${slug}`;

        if (fullUrl.includes('riftbound.gg')) {
          const excerpt = this.stringField(obj, ['excerpt', 'description', 'summary', 'blurb', 'body']);
          const thumbnail = this.stringField(obj, ['thumbnail', 'image', 'coverImage', 'cover_image', 'heroImage', 'hero_image', 'featuredImage']);
          const dateStr = this.stringField(obj, ['publishedAt', 'published_at', 'date', 'createdAt', 'created_at', 'updatedAt']);

          let publishedAt: Date | null = null;
          if (dateStr) {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) publishedAt = parsed;
          }

          if (!articles.some((a) => a.url === fullUrl)) {
            articles.push({
              url: fullUrl,
              title,
              excerpt: excerpt ? excerpt.slice(0, 500) : null,
              thumbnailUrl: thumbnail ? this.resolveImageUrl(thumbnail) : null,
              publishedAt,
              source: 'riftbound.gg',
            });
          }
        }
      }

      Object.values(obj).forEach(walk);
    };

    walk(data);
    return articles;
  }

  private stringField(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const val = obj[key];
      if (typeof val === 'string' && val.trim().length > 0) return val.trim();
      // Handle nested image objects like { url: '...' }
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const nested = val as Record<string, unknown>;
        if (typeof nested['url'] === 'string') return nested['url'].trim();
        if (typeof nested['src'] === 'string') return nested['src'].trim();
      }
    }
    return null;
  }

  private resolveImageUrl(raw: string): string {
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('/')) return `https://riftbound.gg${raw}`;
    return raw;
  }

  // ---------------------------------------------------------------------------
  // Source: Official Riftbound (riftbound.leagueoflegends.com)
  // ---------------------------------------------------------------------------

  async scrapeOfficialRiftbound(): Promise<ScrapedArticle[]> {
    const articles: ScrapedArticle[] = [];
    try {
      const response = await axios.get<string>(
        'https://riftbound.leagueoflegends.com/en-us/news/',
        {
          timeout: 12_000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LaGrieta-Bot/1.0)',
            'Accept': 'text/html',
          },
        },
      );

      const body = String(response.data);
      const scriptMatch = body.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!scriptMatch?.[1]) return articles;

      const data = JSON.parse(scriptMatch[1]) as {
        props?: {
          pageProps?: {
            page?: {
              blades?: Array<{
                type?: string;
                items?: Array<{
                  title?: string;
                  publishedAt?: string;
                  description?: { body?: string };
                  category?: { title?: string };
                  action?: { payload?: { url?: string } };
                  media?: { url?: string };
                }>;
              }>;
            };
          };
        };
      };

      // Find the articleCardGrid blade
      const blades = data.props?.pageProps?.page?.blades ?? [];
      const articleBlade = blades.find((b) => b.type === 'articleCardGrid');
      if (!articleBlade?.items) return articles;

      for (const item of articleBlade.items) {
        const title = item.title;
        const relUrl = item.action?.payload?.url;
        if (!title || !relUrl) continue;

        const url = relUrl.startsWith('http')
          ? relUrl
          : `https://riftbound.leagueoflegends.com${relUrl}`;

        const excerpt = item.description?.body ?? null;
        const thumbnailUrl = item.media?.url ?? null;
        const category = item.category?.title ?? null;

        let publishedAt: Date | null = null;
        if (item.publishedAt) {
          const parsed = new Date(item.publishedAt);
          if (!isNaN(parsed.getTime())) publishedAt = parsed;
        }

        articles.push({
          url,
          title: category ? `${category}: ${title}` : title,
          excerpt: excerpt ? excerpt.slice(0, 500) : null,
          thumbnailUrl,
          publishedAt,
          source: 'Riftbound Official',
        });
      }
    } catch {
      // Network error — return empty
    }

    return articles.slice(0, 30);
  }

  // ---------------------------------------------------------------------------
  // Source: RiftDecks.com (tournament/meta)
  // ---------------------------------------------------------------------------

  async scrapeRiftdecks(): Promise<ScrapedArticle[]> {
    const articles: ScrapedArticle[] = [];
    try {
      // Check for blog/news section
      const urls = [
        'https://riftdecks.com/blog',
        'https://riftdecks.com/news',
        'https://riftdecks.com/riftbound-tournaments',
      ];

      for (const pageUrl of urls) {
        try {
          const response = await axios.get<string>(pageUrl, {
            timeout: 10_000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; LaGrieta-Bot/1.0)',
              'Accept': 'text/html',
            },
          });

          const $ = cheerio.load(String(response.data));
          const seen = new Set<string>(articles.map((a) => a.url));

          // Tournament pages — extract tournament entries
          if (pageUrl.includes('tournament')) {
            $('a[href*="/riftbound-tournaments/"]').each((_i, el) => {
              const href = $(el).attr('href') ?? '';
              if (!href || href === '/riftbound-tournaments' || href === '/riftbound-tournaments/') return;
              const url = href.startsWith('http') ? href : `https://riftdecks.com${href}`;
              if (seen.has(url)) return;
              seen.add(url);

              const title = $(el).text().trim();
              if (!title || title.length < 3) return;

              articles.push({
                url,
                title: `Tournament: ${title}`,
                excerpt: null,
                thumbnailUrl: null,
                publishedAt: null,
                source: 'riftdecks.com',
              });
            });
          }

          // Blog/news articles
          $('a[href*="/blog/"], a[href*="/news/"], article a').each((_i, el) => {
            const href = $(el).attr('href') ?? '';
            if (!href) return;
            const url = href.startsWith('http') ? href : `https://riftdecks.com${href}`;
            if (seen.has(url)) return;
            seen.add(url);

            const title = $(el).find('h2, h3, h4').first().text().trim()
              || $(el).text().trim().slice(0, 120);
            if (!title || title.length < 5) return;

            const img = $(el).find('img').first();
            const thumbnailUrl = img.attr('src') ?? null;

            articles.push({
              url,
              title,
              excerpt: null,
              thumbnailUrl,
              publishedAt: null,
              source: 'riftdecks.com',
            });
          });
        } catch {
          // try next URL
        }
      }
    } catch {
      // Network error
    }

    return articles.slice(0, 15);
  }
}
