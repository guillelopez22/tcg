"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const trpc_context_1 = require("../src/trpc/trpc.context");
// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------
function makeOpts(overrides = {}) {
    return {
        req: { headers: {}, method: 'GET' },
        db: { execute: vitest_1.vi.fn(), query: {} },
        redis: { get: vitest_1.vi.fn(), set: vitest_1.vi.fn(), ping: vitest_1.vi.fn() },
        ...overrides,
    };
}
// ---------------------------------------------------------------------------
// createTrpcContext()
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('createTrpcContext()', () => {
    (0, vitest_1.it)('should return a context object with req, db, and redis', () => {
        const opts = makeOpts();
        const ctx = (0, trpc_context_1.createTrpcContext)(opts);
        (0, vitest_1.expect)(ctx.req).toBe(opts.req);
        (0, vitest_1.expect)(ctx.db).toBe(opts.db);
        (0, vitest_1.expect)(ctx.redis).toBe(opts.redis);
    });
    (0, vitest_1.it)('should not include userId by default (unauthenticated context)', () => {
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts());
        (0, vitest_1.expect)(ctx.userId).toBeUndefined();
    });
    (0, vitest_1.it)('should not include userRole by default (unauthenticated context)', () => {
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts());
        (0, vitest_1.expect)(ctx.userRole).toBeUndefined();
    });
    (0, vitest_1.it)('should pass through the exact db instance provided', () => {
        const mockDb = { execute: vitest_1.vi.fn() };
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts({ db: mockDb }));
        (0, vitest_1.expect)(ctx.db).toBe(mockDb);
    });
    (0, vitest_1.it)('should pass through the exact redis instance provided', () => {
        const mockRedis = { ping: vitest_1.vi.fn() };
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts({ redis: mockRedis }));
        (0, vitest_1.expect)(ctx.redis).toBe(mockRedis);
    });
    (0, vitest_1.it)('should pass through the exact req instance provided', () => {
        const mockReq = { headers: { authorization: 'Bearer token123' } };
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts({ req: mockReq }));
        (0, vitest_1.expect)(ctx.req).toBe(mockReq);
    });
    (0, vitest_1.it)('should return a new context object each call (no singleton)', () => {
        const opts = makeOpts();
        const ctx1 = (0, trpc_context_1.createTrpcContext)(opts);
        const ctx2 = (0, trpc_context_1.createTrpcContext)(opts);
        (0, vitest_1.expect)(ctx1).not.toBe(ctx2);
    });
    (0, vitest_1.it)('context should be extensible (userId can be added after creation)', () => {
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts());
        ctx.userId = 'user-uuid-123';
        ctx.userRole = 'admin';
        (0, vitest_1.expect)(ctx.userId).toBe('user-uuid-123');
        (0, vitest_1.expect)(ctx.userRole).toBe('admin');
    });
    (0, vitest_1.it)('db should expose an execute method (Drizzle contract)', () => {
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts());
        (0, vitest_1.expect)(typeof ctx.db.execute).toBe('function');
    });
    (0, vitest_1.it)('redis should expose a get method (ioredis contract)', () => {
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts());
        (0, vitest_1.expect)(typeof ctx.redis.get).toBe('function');
    });
    (0, vitest_1.it)('redis should expose a set method (ioredis contract)', () => {
        const ctx = (0, trpc_context_1.createTrpcContext)(makeOpts());
        (0, vitest_1.expect)(typeof ctx.redis.set).toBe('function');
    });
});
