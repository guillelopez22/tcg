"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rate_limit_middleware_1 = require("../src/modules/throttler/rate-limit.middleware");
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
function makeMockRedis(zcard) {
    const pipeline = {
        zremrangebyscore: vitest_1.vi.fn().mockReturnThis(),
        zadd: vitest_1.vi.fn().mockReturnThis(),
        zcard: vitest_1.vi.fn().mockReturnThis(),
        expire: vitest_1.vi.fn().mockReturnThis(),
        exec: vitest_1.vi.fn().mockResolvedValue([
            [null, 0], // zremrangebyscore
            [null, 1], // zadd
            [null, zcard], // zcard → the count
            [null, 1], // expire
        ]),
    };
    return {
        pipeline: vitest_1.vi.fn().mockReturnValue(pipeline),
        _pipeline: pipeline,
    };
}
const DEFAULT_CONFIG = {
    windowSeconds: 60,
    limit: 10,
};
// ---------------------------------------------------------------------------
// checkRateLimit()
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('checkRateLimit()', () => {
    (0, vitest_1.it)('should not throw when count is within the limit', async () => {
        const redis = makeMockRedis(5); // 5 requests, limit 10
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:123', DEFAULT_CONFIG)).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('should not throw when count equals the limit exactly', async () => {
        const redis = makeMockRedis(10); // exactly at limit
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:123', DEFAULT_CONFIG)).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('should throw TOO_MANY_REQUESTS when count exceeds the limit', async () => {
        const redis = makeMockRedis(11); // one over the limit
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:123', DEFAULT_CONFIG)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    });
    (0, vitest_1.it)('should include the limit and window in the error message', async () => {
        const redis = makeMockRedis(100);
        const config = { windowSeconds: 60, limit: 10 };
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redis, 'any-key', config)).rejects.toMatchObject({
            code: 'TOO_MANY_REQUESTS',
            message: vitest_1.expect.stringContaining('10'),
        });
    });
    (0, vitest_1.it)('should include window size in the error message', async () => {
        const redis = makeMockRedis(100);
        const config = { windowSeconds: 30, limit: 5 };
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redis, 'any-key', config)).rejects.toMatchObject({
            message: vitest_1.expect.stringContaining('30'),
        });
    });
    (0, vitest_1.it)('should use the prefixed key format "ratelimit:{key}"', async () => {
        const redis = makeMockRedis(1);
        await (0, rate_limit_middleware_1.checkRateLimit)(redis, 'ip:192.168.1.1', DEFAULT_CONFIG);
        const pipeline = redis._pipeline;
        // zremrangebyscore and zadd should both use the prefixed key
        (0, vitest_1.expect)(pipeline.zremrangebyscore).toHaveBeenCalledWith('ratelimit:ip:192.168.1.1', vitest_1.expect.anything(), vitest_1.expect.anything());
        (0, vitest_1.expect)(pipeline.zadd).toHaveBeenCalledWith('ratelimit:ip:192.168.1.1', vitest_1.expect.any(Number), vitest_1.expect.any(String));
    });
    (0, vitest_1.it)('should set Redis key expiry to windowSeconds', async () => {
        const redis = makeMockRedis(1);
        const config = { windowSeconds: 120, limit: 50 };
        await (0, rate_limit_middleware_1.checkRateLimit)(redis, 'test-key', config);
        (0, vitest_1.expect)(redis._pipeline.expire).toHaveBeenCalledWith('ratelimit:test-key', 120);
    });
    (0, vitest_1.it)('should remove expired entries before counting (sliding window)', async () => {
        const redis = makeMockRedis(1);
        await (0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:456', DEFAULT_CONFIG);
        (0, vitest_1.expect)(redis._pipeline.zremrangebyscore).toHaveBeenCalled();
        const [, minScore] = redis._pipeline.zremrangebyscore.mock.calls[0];
        (0, vitest_1.expect)(minScore).toBe('-inf');
    });
    (0, vitest_1.it)('should add the current request timestamp to the sorted set', async () => {
        const redis = makeMockRedis(1);
        const before = Date.now();
        await (0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:789', DEFAULT_CONFIG);
        const after = Date.now();
        const [, score] = redis._pipeline.zadd.mock.calls[0];
        (0, vitest_1.expect)(score).toBeGreaterThanOrEqual(before);
        (0, vitest_1.expect)(score).toBeLessThanOrEqual(after);
    });
    (0, vitest_1.it)('should execute the pipeline atomically (single exec call)', async () => {
        const redis = makeMockRedis(1);
        await (0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:123', DEFAULT_CONFIG);
        (0, vitest_1.expect)(redis._pipeline.exec).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)('should not throw when exec returns null count', async () => {
        // Edge case: pipeline returns null for the zcard position
        const pipeline = {
            zremrangebyscore: vitest_1.vi.fn().mockReturnThis(),
            zadd: vitest_1.vi.fn().mockReturnThis(),
            zcard: vitest_1.vi.fn().mockReturnThis(),
            expire: vitest_1.vi.fn().mockReturnThis(),
            exec: vitest_1.vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, null], [null, 1]]),
        };
        const redis = { pipeline: vitest_1.vi.fn().mockReturnValue(pipeline) };
        // count is null → should not throw (null check in implementation)
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redis, 'user:123', DEFAULT_CONFIG)).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('should enforce different limits independently per key', async () => {
        // Key 1 is at limit, key 2 is under limit
        const redisFull = makeMockRedis(11); // over limit
        const redisOk = makeMockRedis(5); // under limit
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redisFull, 'user:full', DEFAULT_CONFIG)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redisOk, 'user:ok', DEFAULT_CONFIG)).resolves.toBeUndefined();
    });
    (0, vitest_1.it)('should respect custom window and limit configs', async () => {
        const authConfig = { windowSeconds: 60, limit: 10 };
        const publicConfig = { windowSeconds: 60, limit: 100 };
        const redisOverAuthLimit = makeMockRedis(11); // over auth limit of 10
        const redisUnderPublicLimit = makeMockRedis(11); // under public limit of 100
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redisOverAuthLimit, 'auth:login', authConfig)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
        await (0, vitest_1.expect)((0, rate_limit_middleware_1.checkRateLimit)(redisUnderPublicLimit, 'public:cards', publicConfig)).resolves.toBeUndefined();
    });
});
// ---------------------------------------------------------------------------
// getClientIp()
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('getClientIp()', () => {
    (0, vitest_1.it)('should return the first IP from x-forwarded-for header', () => {
        const req = { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 172.16.0.1' } };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('203.0.113.1');
    });
    (0, vitest_1.it)('should trim whitespace from x-forwarded-for IP', () => {
        const req = { headers: { 'x-forwarded-for': '  203.0.113.42  , 10.0.0.1' } };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('203.0.113.42');
    });
    (0, vitest_1.it)('should return single IP from x-forwarded-for when only one IP present', () => {
        const req = { headers: { 'x-forwarded-for': '192.168.1.100' } };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('192.168.1.100');
    });
    (0, vitest_1.it)('should return req.ip when x-forwarded-for header is absent', () => {
        const req = { headers: {}, ip: '10.0.0.5' };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('10.0.0.5');
    });
    (0, vitest_1.it)('should return socket.remoteAddress when headers and req.ip are both absent', () => {
        const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('127.0.0.1');
    });
    (0, vitest_1.it)('should return "unknown" when no IP source is available', () => {
        const req = { headers: {} };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('unknown');
    });
    (0, vitest_1.it)('should prefer x-forwarded-for over req.ip', () => {
        const req = {
            headers: { 'x-forwarded-for': '203.0.113.1' },
            ip: '10.0.0.1',
        };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('203.0.113.1');
    });
    (0, vitest_1.it)('should prefer req.ip over socket.remoteAddress', () => {
        const req = {
            headers: {},
            ip: '10.0.0.5',
            socket: { remoteAddress: '127.0.0.1' },
        };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('10.0.0.5');
    });
    (0, vitest_1.it)('should handle IPv6 addresses in x-forwarded-for', () => {
        const req = { headers: { 'x-forwarded-for': '2001:db8::1, 10.0.0.1' } };
        (0, vitest_1.expect)((0, rate_limit_middleware_1.getClientIp)(req)).toBe('2001:db8::1');
    });
});
