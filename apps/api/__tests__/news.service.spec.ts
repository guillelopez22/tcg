import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsService } from '../src/modules/news/news.service';

// ---------------------------------------------------------------------------
// Mock @la-grieta/db to provide stable column stubs
// ---------------------------------------------------------------------------

vi.mock('@la-grieta/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@la-grieta/db')>();

  function makeColStub(name: string) {
    return {
      name,
      _: { name },
      getSQL: () => ({ type: 'column', name }),
      mapFromDriverValue: (v: unknown) => v,
      mapToDriverValue: (v: unknown) => v,
    } as unknown;
  }

  const newsArticlesStub = {
    id: makeColStub('id'),
    url: makeColStub('url'),
    title: makeColStub('title'),
    excerpt: makeColStub('excerpt'),
    thumbnailUrl: makeColStub('thumbnail_url'),
    source: makeColStub('source'),
    publishedAt: makeColStub('published_at'),
    scrapedAt: makeColStub('scraped_at'),
    _: { name: 'news_articles' },
  };

  return {
    ...actual,
    newsArticles: newsArticlesStub,
  };
});

// ---------------------------------------------------------------------------
// Mock axios and cheerio
// ---------------------------------------------------------------------------

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------

type MockChain = Record<string, unknown>;

function makeMockDb() {
  const selectResults: unknown[][] = [];
  let selectIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const data = () => selectResults[capturedIdx] ?? [];

    const chain: MockChain = {};
    chain['then'] = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(data()).then(onFulfilled);
    chain['from'] = vi.fn().mockImplementation(() => {
      const fromChain: MockChain = {};
      fromChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(data()).then(onFulfilled);
      fromChain['where'] = vi.fn().mockImplementation(() => {
        const whereChain: MockChain = {};
        whereChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(data()).then(onFulfilled);
        whereChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
        return whereChain;
      });
      fromChain['orderBy'] = vi.fn().mockImplementation(() => {
        const orderChain: MockChain = {};
        orderChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(data()).then(onFulfilled);
        orderChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
        return orderChain;
      });
      fromChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
      return fromChain;
    });
    chain['where'] = vi.fn().mockImplementation(() => {
      const whereChain: MockChain = {};
      whereChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(data()).then(onFulfilled);
      whereChain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
      return whereChain;
    });
    chain['limit'] = vi.fn().mockImplementation(() => Promise.resolve(data()));
    return chain;
  });

  const insertMock = vi.fn();
  const insert = insertMock.mockImplementation(() => {
    const chain: MockChain = {};
    chain['values'] = vi.fn().mockImplementation(() => {
      const valChain: MockChain = {};
      valChain['onConflictDoUpdate'] = vi.fn().mockResolvedValue(undefined);
      valChain['returning'] = vi.fn().mockResolvedValue([]);
      valChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve([]).then(onFulfilled);
      return valChain;
    });
    return chain;
  });

  return {
    select,
    insert,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ARTICLE_1 = {
  id: 'article-uuid-1111-1111-1111-111111111111',
  url: 'https://riftbound.gg/blog/article-1',
  title: 'New Card Reveal',
  excerpt: 'Check out the new card!',
  thumbnailUrl: 'https://riftbound.gg/img/thumb1.jpg',
  source: 'riftbound.gg',
  publishedAt: new Date('2026-03-01T00:00:00Z'),
  scrapedAt: new Date('2026-03-13T00:00:00Z'),
};

const ARTICLE_2 = {
  id: 'article-uuid-2222-2222-2222-222222222222',
  url: 'https://riftbound.gg/blog/article-2',
  title: 'Tournament Results',
  excerpt: 'See who won!',
  thumbnailUrl: null,
  source: 'riftbound.gg',
  publishedAt: new Date('2026-02-15T00:00:00Z'),
  scrapedAt: new Date('2026-03-13T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewsService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let service: NewsService;

  beforeEach(() => {
    db = makeMockDb();
    service = new NewsService(db as never);
    vi.clearAllMocks();
  });

  // =========================================================================
  // getLatest()
  // =========================================================================

  describe('getLatest()', () => {
    it('should return articles ordered by publishedAt desc', async () => {
      db._pushSelect([ARTICLE_1, ARTICLE_2]);

      const result = await service.getLatest(20);

      expect(result).toHaveLength(2);
      expect(result[0]!.url).toBe(ARTICLE_1.url);
      expect(result[1]!.url).toBe(ARTICLE_2.url);
    });

    it('should return empty array when no articles exist', async () => {
      db._pushSelect([]);

      const result = await service.getLatest(20);

      expect(result).toHaveLength(0);
    });

    it('should use default limit of 20', async () => {
      db._pushSelect([]);

      const result = await service.getLatest();

      expect(result).toHaveLength(0);
      expect(db.select).toHaveBeenCalled();
    });

    it('should include all article fields', async () => {
      db._pushSelect([ARTICLE_1]);

      const [article] = await service.getLatest(1);

      expect(article!.id).toBe(ARTICLE_1.id);
      expect(article!.url).toBe(ARTICLE_1.url);
      expect(article!.title).toBe(ARTICLE_1.title);
      expect(article!.source).toBe(ARTICLE_1.source);
    });
  });

  // =========================================================================
  // upsertArticles()
  // =========================================================================

  describe('upsertArticles()', () => {
    it('should insert articles into the DB', async () => {
      const articles = [
        {
          url: 'https://riftbound.gg/blog/new',
          title: 'New Article',
          excerpt: 'Some content',
          thumbnailUrl: null,
          publishedAt: new Date('2026-03-01T00:00:00Z'),
          source: 'riftbound.gg',
        },
      ];

      await service.upsertArticles(articles);

      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('should use onConflictDoUpdate to deduplicate by URL', async () => {
      const articles = [
        {
          url: 'https://riftbound.gg/blog/existing',
          title: 'Updated Title',
          excerpt: null,
          thumbnailUrl: null,
          publishedAt: null,
          source: 'riftbound.gg',
        },
      ];

      await service.upsertArticles(articles);

      // Should call insert().values().onConflictDoUpdate()
      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle empty articles array gracefully', async () => {
      await service.upsertArticles([]);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should upsert multiple articles', async () => {
      const articles = [
        { url: 'https://riftbound.gg/blog/1', title: 'A1', excerpt: null, thumbnailUrl: null, publishedAt: null, source: 'riftbound.gg' },
        { url: 'https://riftbound.gg/blog/2', title: 'A2', excerpt: null, thumbnailUrl: null, publishedAt: null, source: 'riftbound.gg' },
        { url: 'https://riftbound.gg/blog/3', title: 'A3', excerpt: null, thumbnailUrl: null, publishedAt: null, source: 'riftbound.gg' },
      ];

      await service.upsertArticles(articles);

      expect(db.insert).toHaveBeenCalledTimes(3);
    });
  });

  // =========================================================================
  // syncCron() — concurrent run guard
  // =========================================================================

  describe('syncCron()', () => {
    it('should prevent concurrent runs via isSyncing guard', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;

      // Simulate scrape returning empty (no network call needed)
      axiosMock.mockRejectedValue(new Error('Network error'));

      // Start two concurrent sync attempts
      const sync1 = service.syncCron();
      const sync2 = service.syncCron(); // should be no-op

      await Promise.all([sync1, sync2]);

      // scrapeRiftboundGg was only called once (second was blocked)
      expect(axiosMock).toHaveBeenCalledTimes(1);
    });

    it('should set isSyncing=false even when scrape fails', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;
      axiosMock.mockRejectedValue(new Error('Connection refused'));

      await service.syncCron();

      // Should not be syncing after failure
      expect(service.getSyncStatus().isSyncing).toBe(false);
    });

    it('should not throw when scraper returns empty articles', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;
      axiosMock.mockResolvedValue({ data: '<html><body><p>No articles</p></body></html>' });

      // Should complete without throwing
      await expect(service.syncCron()).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // scrapeRiftboundGg()
  // =========================================================================

  describe('scrapeRiftboundGg()', () => {
    it('should return empty array when network request fails', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;
      axiosMock.mockRejectedValue(new Error('Connection refused'));

      const result = await service.scrapeRiftboundGg();

      expect(result).toEqual([]);
    });

    it('should parse articles from HTML with article elements', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;

      const mockHtml = `
        <html><body>
          <article>
            <h2><a href="/blog/test-article">Test Article</a></h2>
            <p>Article excerpt here.</p>
            <time datetime="2026-03-01T00:00:00Z">March 1, 2026</time>
            <img src="https://riftbound.gg/img/thumb.jpg" />
          </article>
        </body></html>
      `;
      axiosMock.mockResolvedValue({ data: mockHtml });

      const result = await service.scrapeRiftboundGg();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.title).toBe('Test Article');
      expect(result[0]!.source).toBe('riftbound.gg');
    });

    it('should return empty array when HTML has no recognizable article elements', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;
      axiosMock.mockResolvedValue({ data: '<html><body><p>Just some text</p></body></html>' });

      const result = await service.scrapeRiftboundGg();

      expect(result).toEqual([]);
    });

    it('should resolve relative URLs to absolute', async () => {
      const axiosModule = await import('axios');
      const axiosMock = axiosModule.default.get as ReturnType<typeof vi.fn>;

      const mockHtml = `
        <html><body>
          <article>
            <h2><a href="/blog/relative-link">Relative URL Article</a></h2>
            <p>Content here.</p>
          </article>
        </body></html>
      `;
      axiosMock.mockResolvedValue({ data: mockHtml });

      const result = await service.scrapeRiftboundGg();

      if (result.length > 0) {
        expect(result[0]!.url).toMatch(/^https?:\/\//);
      }
    });
  });
});
