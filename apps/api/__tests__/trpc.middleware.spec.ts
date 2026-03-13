/**
 * Tests for tRPC middleware: publicProcedure and protectedProcedure.
 *
 * Strategy: build a minimal tRPC router from TrpcService and use
 * router.createCaller(ctx) to exercise the real middleware chain without
 * a running HTTP server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';
import { TrpcService } from '../src/trpc/trpc.service';
import type { TrpcContext } from '../src/trpc/trpc.context';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-min-32-chars-for-hs256';
const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(
  payload: Record<string, unknown> = { sub: USER_ID, role: 'user' },
  secret = TEST_JWT_SECRET,
  options: jwt.SignOptions = { expiresIn: 900 },
): string {
  return jwt.sign(payload, secret, options);
}

function makeCtx(overrides: {
  authHeader?: string;
  redisGet?: (key: string) => Promise<string | null>;
} = {}): TrpcContext {
  return {
    req: {
      headers: overrides.authHeader !== undefined
        ? { authorization: overrides.authHeader }
        : {},
      method: 'POST',
    } as never,
    db: {} as never,
    redis: {
      get: overrides.redisGet
        ? vi.fn().mockImplementation(overrides.redisGet)
        : vi.fn().mockResolvedValue(null),
    } as never,
  };
}

type ProbeCaller = { probe: () => Promise<string> };

/**
 * Build a minimal router with a single `probe` query using the given procedure
 * and return a caller bound to the given context.
 */
function buildCaller(
  getProcedure: (svc: TrpcService) => ReturnType<TrpcService['publicProcedure']['output']>['_def'] extends never
    ? never
    : TrpcService['publicProcedure'],
  ctx: TrpcContext,
): ProbeCaller {
  const svc = new TrpcService();
  const procedure = getProcedure(svc);
  const router = svc.router({
    probe: procedure.output(z.string()).query(() => 'ok'),
  });
  // tRPC v11: router.createCaller(ctx) returns a typed caller
  return (router as unknown as { createCaller: (ctx: TrpcContext) => ProbeCaller }).createCaller(ctx);
}

// ---------------------------------------------------------------------------
// publicProcedure
// ---------------------------------------------------------------------------

describe('publicProcedure', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = TEST_JWT_SECRET;
  });
  afterEach(() => {
    delete process.env['JWT_SECRET'];
    vi.restoreAllMocks();
  });

  it('should execute handler with no auth header', async () => {
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());
    const result = await caller.probe();
    expect(result).toBe('ok');
  });

  it('should execute handler when a valid Bearer token is present', async () => {
    const token = signToken();
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
    const result = await caller.probe();
    expect(result).toBe('ok');
  });

  it('should execute handler when authorization header is an empty string', async () => {
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx({ authHeader: '' }));
    const result = await caller.probe();
    expect(result).toBe('ok');
  });

  it('should log the procedure call via console.log', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());

    await caller.probe();

    expect(logSpy).toHaveBeenCalled();
    const logMsg = (logSpy.mock.calls[0] as string[])[0];
    expect(logMsg).toMatch(/\[tRPC\]/);
  });

  it('should log the procedure path in the log message', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());

    await caller.probe();

    const logMsg = (logSpy.mock.calls[0] as string[])[0];
    expect(logMsg).toMatch(/probe/);
  });

  it('should log "ok" status when handler succeeds', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());

    await caller.probe();

    const logMsg = (logSpy.mock.calls[0] as string[])[0];
    expect(logMsg).toMatch(/ok/);
  });

  it('should log duration in milliseconds', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());

    await caller.probe();

    const logMsg = (logSpy.mock.calls[0] as string[])[0];
    expect(logMsg).toMatch(/\d+ms/);
  });
});

// ---------------------------------------------------------------------------
// protectedProcedure
// ---------------------------------------------------------------------------

describe('protectedProcedure', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = TEST_JWT_SECRET;
  });
  afterEach(() => {
    delete process.env['JWT_SECRET'];
    vi.restoreAllMocks();
  });

  it('should execute handler when valid JWT is provided', async () => {
    const token = signToken();
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );
    const result = await caller.probe();
    expect(result).toBe('ok');
  });

  it('should throw UNAUTHORIZED when authorization header is absent', async () => {
    const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx());

    await expect(caller.probe()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing access token',
    });
  });

  it('should throw UNAUTHORIZED when authorization header is an empty string', async () => {
    const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: '' }));

    await expect(caller.probe()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Missing access token',
    });
  });

  it('should throw UNAUTHORIZED when JWT is signed with a wrong secret', async () => {
    const token = signToken({ sub: USER_ID, role: 'user' }, 'completely-wrong-secret-here');
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );

    await expect(caller.probe()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired access token',
    });
  });

  it('should throw UNAUTHORIZED when JWT is expired', async () => {
    const token = signToken({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: -1 });
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );

    await expect(caller.probe()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired access token',
    });
  });

  it('should throw UNAUTHORIZED when JWT is malformed', async () => {
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: 'Bearer not.a.real.jwt' }),
    );

    await expect(caller.probe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('should throw UNAUTHORIZED when token is blacklisted in Redis', async () => {
    const token = signToken();
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}`, redisGet: async () => '1' }),
    );

    await expect(caller.probe()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Token has been revoked',
    });
  });

  it('should check Redis with correct key format "blacklist:{token}"', async () => {
    const token = signToken();
    const mockGet = vi.fn().mockResolvedValue(null);
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}`, redisGet: mockGet }),
    );

    await caller.probe();

    expect(mockGet).toHaveBeenCalledWith(`blacklist:${token}`);
  });

  it('should throw UNAUTHORIZED when JWT payload sub is not a UUID', async () => {
    const token = jwt.sign({ sub: 'not-a-uuid', role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );

    await expect(caller.probe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('should throw UNAUTHORIZED when JWT payload is missing sub claim', async () => {
    const token = jwt.sign({ role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );

    await expect(caller.probe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('should allow user role tokens through', async () => {
    const token = signToken({ sub: USER_ID, role: 'user' });
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );
    const result = await caller.probe();
    expect(result).toBe('ok');
  });

  it('should allow admin role tokens through', async () => {
    const token = signToken({ sub: USER_ID, role: 'admin' });
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );
    const result = await caller.probe();
    expect(result).toBe('ok');
  });

  it('should throw INTERNAL_SERVER_ERROR when JWT_SECRET env var is missing', async () => {
    delete process.env['JWT_SECRET'];
    const token = signToken();
    const caller = buildCaller(
      (svc) => svc.protectedProcedure,
      makeCtx({ authHeader: `Bearer ${token}` }),
    );

    await expect(caller.probe()).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Server configuration error',
    });
  });

  it('should log "error" status when auth fails', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx()); // no token

    try { await caller.probe(); } catch { /* expected */ }

    expect(logSpy).toHaveBeenCalled();
    const logMsg = (logSpy.mock.calls[0] as string[])[0];
    expect(logMsg).toMatch(/error/);
  });
});
