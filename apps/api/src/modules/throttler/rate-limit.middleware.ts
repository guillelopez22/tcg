import { TRPCError } from '@trpc/server';
import type { Redis } from 'ioredis';

export interface RateLimitConfig {
  /** Window size in seconds */
  windowSeconds: number;
  /** Max requests per window */
  limit: number;
}

/**
 * Redis sliding-window rate limiter.
 * Key format: ratelimit:{identifier}:{windowKey}
 */
export async function checkRateLimit(
  redis: Redis,
  key: string,
  config: RateLimitConfig,
): Promise<void> {
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;
  const redisKey = `ratelimit:${key}`;

  // Atomic pipeline: remove expired entries, add current, count, set expiry
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, '-inf', windowStart);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.zcard(redisKey);
  pipeline.expire(redisKey, config.windowSeconds);

  const results = await pipeline.exec();

  if (results === null) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Rate limit check failed. Please try again.',
    });
  }

  const count = results[2]?.[1] as number | null;

  if (count !== null && count > config.limit) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Too many requests. Please try again later.`,
    });
  }
}

export function getClientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
