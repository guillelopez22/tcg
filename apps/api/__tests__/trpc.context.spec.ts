import { describe, it, expect, vi } from 'vitest';
import { createTrpcContext } from '../src/trpc/trpc.context';
import type { TrpcContext, CreateContextOptions } from '../src/trpc/trpc.context';

// ---------------------------------------------------------------------------
// Minimal mocks
// ---------------------------------------------------------------------------

function makeOpts(overrides: Partial<CreateContextOptions> = {}): CreateContextOptions {
  return {
    req: { headers: {}, method: 'GET' } as never,
    db: { execute: vi.fn(), query: {} } as never,
    redis: { get: vi.fn(), set: vi.fn(), ping: vi.fn() } as never,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createTrpcContext()
// ---------------------------------------------------------------------------

describe('createTrpcContext()', () => {
  it('should return a context object with req, db, and redis', () => {
    const opts = makeOpts();
    const ctx = createTrpcContext(opts);
    expect(ctx.req).toBe(opts.req);
    expect(ctx.db).toBe(opts.db);
    expect(ctx.redis).toBe(opts.redis);
  });

  it('should not include userId by default (unauthenticated context)', () => {
    const ctx = createTrpcContext(makeOpts());
    expect(ctx.userId).toBeUndefined();
  });

  it('should not include userRole by default (unauthenticated context)', () => {
    const ctx = createTrpcContext(makeOpts());
    expect(ctx.userRole).toBeUndefined();
  });

  it('should pass through the exact db instance provided', () => {
    const mockDb = { execute: vi.fn() } as never;
    const ctx = createTrpcContext(makeOpts({ db: mockDb }));
    expect(ctx.db).toBe(mockDb);
  });

  it('should pass through the exact redis instance provided', () => {
    const mockRedis = { ping: vi.fn() } as never;
    const ctx = createTrpcContext(makeOpts({ redis: mockRedis }));
    expect(ctx.redis).toBe(mockRedis);
  });

  it('should pass through the exact req instance provided', () => {
    const mockReq = { headers: { authorization: 'Bearer token123' } } as never;
    const ctx = createTrpcContext(makeOpts({ req: mockReq }));
    expect(ctx.req).toBe(mockReq);
  });

  it('should return a new context object each call (no singleton)', () => {
    const opts = makeOpts();
    const ctx1 = createTrpcContext(opts);
    const ctx2 = createTrpcContext(opts);
    expect(ctx1).not.toBe(ctx2);
  });

  it('context should be extensible (userId can be added after creation)', () => {
    const ctx = createTrpcContext(makeOpts()) as TrpcContext;
    ctx.userId = 'user-uuid-123';
    ctx.userRole = 'admin';
    expect(ctx.userId).toBe('user-uuid-123');
    expect(ctx.userRole).toBe('admin');
  });

  it('db should expose an execute method (Drizzle contract)', () => {
    const ctx = createTrpcContext(makeOpts());
    expect(typeof ctx.db.execute).toBe('function');
  });

  it('redis should expose a get method (ioredis contract)', () => {
    const ctx = createTrpcContext(makeOpts());
    expect(typeof ctx.redis.get).toBe('function');
  });

  it('redis should expose a set method (ioredis contract)', () => {
    const ctx = createTrpcContext(makeOpts());
    expect(typeof ctx.redis.set).toBe('function');
  });
});
