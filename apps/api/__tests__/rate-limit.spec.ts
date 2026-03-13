import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { checkRateLimit, getClientIp } from '../src/modules/throttler/rate-limit.middleware';
import type { RateLimitConfig } from '../src/modules/throttler/rate-limit.middleware';

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

/**
 * Mock ioredis instance with a pipeline that can simulate sliding-window counts.
 * The rate limiter pipeline sequence is:
 *   0: zremrangebyscore (result ignored)
 *   1: zadd (result ignored)
 *   2: zcard → count (the value we care about)
 *   3: expire (result ignored)
 */
function makeMockRedis(zcard: number) {
  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],      // zremrangebyscore
      [null, 1],      // zadd
      [null, zcard],  // zcard → the count
      [null, 1],      // expire
    ]),
  };

  return {
    pipeline: vi.fn().mockReturnValue(pipeline),
    _pipeline: pipeline,
  };
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowSeconds: 60,
  limit: 10,
};

// ---------------------------------------------------------------------------
// checkRateLimit()
// ---------------------------------------------------------------------------

describe('checkRateLimit()', () => {
  it('should not throw when count is within the limit', async () => {
    const redis = makeMockRedis(5); // 5 requests, limit 10

    await expect(
      checkRateLimit(redis as never, 'user:123', DEFAULT_CONFIG),
    ).resolves.toBeUndefined();
  });

  it('should not throw when count equals the limit exactly', async () => {
    const redis = makeMockRedis(10); // exactly at limit

    await expect(
      checkRateLimit(redis as never, 'user:123', DEFAULT_CONFIG),
    ).resolves.toBeUndefined();
  });

  it('should throw TOO_MANY_REQUESTS when count exceeds the limit', async () => {
    const redis = makeMockRedis(11); // one over the limit

    await expect(
      checkRateLimit(redis as never, 'user:123', DEFAULT_CONFIG),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
  });

  it('should include the limit and window in the error message', async () => {
    const redis = makeMockRedis(100);
    const config: RateLimitConfig = { windowSeconds: 60, limit: 10 };

    await expect(
      checkRateLimit(redis as never, 'any-key', config),
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      message: expect.stringContaining('10'),
    });
  });

  it('should include window size in the error message', async () => {
    const redis = makeMockRedis(100);
    const config: RateLimitConfig = { windowSeconds: 30, limit: 5 };

    await expect(
      checkRateLimit(redis as never, 'any-key', config),
    ).rejects.toMatchObject({
      message: expect.stringContaining('30'),
    });
  });

  it('should use the prefixed key format "ratelimit:{key}"', async () => {
    const redis = makeMockRedis(1);

    await checkRateLimit(redis as never, 'ip:192.168.1.1', DEFAULT_CONFIG);

    const pipeline = redis._pipeline;
    // zremrangebyscore and zadd should both use the prefixed key
    expect(pipeline.zremrangebyscore).toHaveBeenCalledWith(
      'ratelimit:ip:192.168.1.1',
      expect.anything(),
      expect.anything(),
    );
    expect(pipeline.zadd).toHaveBeenCalledWith(
      'ratelimit:ip:192.168.1.1',
      expect.any(Number),
      expect.any(String),
    );
  });

  it('should set Redis key expiry to windowSeconds', async () => {
    const redis = makeMockRedis(1);
    const config: RateLimitConfig = { windowSeconds: 120, limit: 50 };

    await checkRateLimit(redis as never, 'test-key', config);

    expect(redis._pipeline.expire).toHaveBeenCalledWith('ratelimit:test-key', 120);
  });

  it('should remove expired entries before counting (sliding window)', async () => {
    const redis = makeMockRedis(1);

    await checkRateLimit(redis as never, 'user:456', DEFAULT_CONFIG);

    expect(redis._pipeline.zremrangebyscore).toHaveBeenCalled();
    const [, minScore] = redis._pipeline.zremrangebyscore.mock.calls[0] as [string, string, number];
    expect(minScore).toBe('-inf');
  });

  it('should add the current request timestamp to the sorted set', async () => {
    const redis = makeMockRedis(1);
    const before = Date.now();

    await checkRateLimit(redis as never, 'user:789', DEFAULT_CONFIG);

    const after = Date.now();
    const [, score] = redis._pipeline.zadd.mock.calls[0] as [string, number, string];
    expect(score).toBeGreaterThanOrEqual(before);
    expect(score).toBeLessThanOrEqual(after);
  });

  it('should execute the pipeline atomically (single exec call)', async () => {
    const redis = makeMockRedis(1);

    await checkRateLimit(redis as never, 'user:123', DEFAULT_CONFIG);

    expect(redis._pipeline.exec).toHaveBeenCalledOnce();
  });

  it('should not throw when exec returns null count', async () => {
    // Edge case: pipeline returns null for the zcard position
    const pipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, null], [null, 1]]),
    };
    const redis = { pipeline: vi.fn().mockReturnValue(pipeline) };

    // count is null → should not throw (null check in implementation)
    await expect(
      checkRateLimit(redis as never, 'user:123', DEFAULT_CONFIG),
    ).resolves.toBeUndefined();
  });

  it('should enforce different limits independently per key', async () => {
    // Key 1 is at limit, key 2 is under limit
    const redisFull = makeMockRedis(11); // over limit
    const redisOk = makeMockRedis(5); // under limit

    await expect(
      checkRateLimit(redisFull as never, 'user:full', DEFAULT_CONFIG),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    await expect(
      checkRateLimit(redisOk as never, 'user:ok', DEFAULT_CONFIG),
    ).resolves.toBeUndefined();
  });

  it('should respect custom window and limit configs', async () => {
    const authConfig: RateLimitConfig = { windowSeconds: 60, limit: 10 };
    const publicConfig: RateLimitConfig = { windowSeconds: 60, limit: 100 };

    const redisOverAuthLimit = makeMockRedis(11); // over auth limit of 10
    const redisUnderPublicLimit = makeMockRedis(11); // under public limit of 100

    await expect(
      checkRateLimit(redisOverAuthLimit as never, 'auth:login', authConfig),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    await expect(
      checkRateLimit(redisUnderPublicLimit as never, 'public:cards', publicConfig),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getClientIp()
// ---------------------------------------------------------------------------

describe('getClientIp()', () => {
  it('should return the first IP from x-forwarded-for header', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1' } };
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('should trim whitespace from x-forwarded-for IP', () => {
    const req = { headers: { 'x-forwarded-for': '  203.0.113.42  , 10.0.0.1' } };
    expect(getClientIp(req)).toBe('203.0.113.42');
  });

  it('should return single IP from x-forwarded-for when only one IP present', () => {
    const req = { headers: { 'x-forwarded-for': '192.168.1.100' } };
    expect(getClientIp(req)).toBe('192.168.1.100');
  });

  it('should return req.ip when x-forwarded-for header is absent', () => {
    const req = { headers: {}, ip: '10.0.0.5' };
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('should return socket.remoteAddress when headers and req.ip are both absent', () => {
    const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('should return "unknown" when no IP source is available', () => {
    const req = { headers: {} };
    expect(getClientIp(req)).toBe('unknown');
  });

  it('should prefer x-forwarded-for over req.ip', () => {
    const req = {
      headers: { 'x-forwarded-for': '203.0.113.1' },
      ip: '10.0.0.1',
    };
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('should prefer req.ip over socket.remoteAddress', () => {
    const req = {
      headers: {},
      ip: '10.0.0.5',
      socket: { remoteAddress: '127.0.0.1' },
    };
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('should handle IPv6 addresses in x-forwarded-for', () => {
    const req = { headers: { 'x-forwarded-for': '2001:db8::1, 10.0.0.1' } };
    expect(getClientIp(req)).toBe('2001:db8::1');
  });
});
