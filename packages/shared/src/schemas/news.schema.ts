import { z } from 'zod';

export const newsArticleSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url().max(500),
  title: z.string().min(1).max(300),
  excerpt: z.string().nullable(),
  thumbnailUrl: z.string().url().max(500).nullable(),
  source: z.string().min(1).max(100),
  publishedAt: z.string().datetime().nullable(),
  scrapedAt: z.string().datetime(),
});
export type NewsArticle = z.infer<typeof newsArticleSchema>;

export const newsListSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  source: z.string().optional(),
});
export type NewsListInput = z.infer<typeof newsListSchema>;
