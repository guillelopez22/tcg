import { pgTable, uuid, varchar, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const newsArticles = pgTable('news_articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 500 }).notNull().unique(),
  title: varchar('title', { length: 300 }).notNull(),
  excerpt: text('excerpt'),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
  source: varchar('source', { length: 100 }).notNull(),
  publishedAt: timestamp('published_at'),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_news_articles_url').on(table.url),
  index('idx_news_articles_scraped_at').on(table.scrapedAt),
  index('idx_news_articles_published_at').on(table.publishedAt),
]);

export type NewsArticle = typeof newsArticles.$inferSelect;
export type NewNewsArticle = typeof newsArticles.$inferInsert;
