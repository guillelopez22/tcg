/**
 * Integration tests for the Auth flow.
 *
 * Tests the full stack: AuthRouter → AuthService → mocked DB/Redis.
 * Uses router.createCaller() to exercise the complete request pipeline
 * including tRPC middleware (auth, logging, rate limiting).
 *
 * Flow tested: register → login → me → logout → verify rejected
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { TrpcService } from '../src/trpc/trpc.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthRouter } from '../src/modules/auth/auth.router';
import { AuthConfig } from '../src/config/auth.config';
import type { TrpcContext } from '../src/trpc/trpc.context';
import type { Response } from 'express';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'integration-test-secret-32-chars!';
const TEST_ACCESS_TTL = 900;
const TEST_REFRESH_TTL = 2_592_000;

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PASSWORD_PLAINTEXT = 'SecurePass1!';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD_PLAINTEXT, 1); // low rounds for speed

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockRes(): Response {
  return {
    cookie: vi.fn(),
  } as unknown as Response;
}

function makeMockDb() {
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];
  let selectIdx = 0;
  let insertIdx = 0;

  const select = vi.fn().mockImplementation(() => {
    const capturedIdx = selectIdx++;
    const chain: Record<string, unknown> = {};
    chain['from'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockReturnValue(chain);
    chain['limit'] = vi.fn().mockImplementation(() =>
      Promise.resolve(selectResults[capturedIdx] ?? []),
    );
    return chain;
  });

  const insert = vi.fn().mockImplementation(() => {
    const capturedIdx = insertIdx++;
    const chain: Record<string, unknown> = {};
    chain['values'] = vi.fn().mockImplementation(() => {
      const valuesChain: Record<string, unknown> = {};
      valuesChain['returning'] = vi.fn().mockImplementation(() =>
        Promise.resolve(insertResults[capturedIdx] ?? []),
      );
      valuesChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
      return valuesChain;
    });
    return chain;
  });

  const update = vi.fn().mockImplementation(() => {
    const chain: Record<string, unknown> = {};
    chain['set'] = vi.fn().mockReturnValue(chain);
    chain['where'] = vi.fn().mockResolvedValue([]);
    return chain;
  });

  return {
    select,
    insert,
    update,
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
    _pushInsert: (...rows: unknown[][]) => { insertResults.push(...rows); },
  };
}

/**
 * Redis mock that supports:
 * - get/setex for blacklist
 * - pipeline for rate limiting (always under limit)
 */
function makeMockRedis() {
  const store = new Map<string, string>();

  // Rate limit pipeline — always returns count=1 (under any limit)
  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
  };

  return {
    get: vi.fn().mockImplementation(async (key: string) => store.get(key) ?? null),
    setex: vi.fn().mockImplementation(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    pipeline: vi.fn().mockReturnValue(pipeline),
    _store: store,
  };
}

function makeAuthConfig(): AuthConfig {
  return {
    jwtSecret: TEST_JWT_SECRET,
    accessTokenTtlSeconds: TEST_ACCESS_TTL,
    refreshTokenTtlSeconds: TEST_REFRESH_TTL,
  } as AuthConfig;
}

function makeCtx(
  redis: ReturnType<typeof makeMockRedis>,
  authHeader?: string,
  cookies?: Record<string, string>,
): TrpcContext {
  return {
    req: {
      headers: authHeader ? { authorization: authHeader } : {},
      cookies: cookies ?? {},
      ip: '127.0.0.1',
      method: 'POST',
    } as never,
    res: makeMockRes(),
    db: {} as never, // will be overridden in service
    redis: redis as never,
  };
}

// ---------------------------------------------------------------------------
// Router builder
// ---------------------------------------------------------------------------

function buildAuthCaller(
  db: ReturnType<typeof makeMockDb>,
  redis: ReturnType<typeof makeMockRedis>,
  authHeader?: string,
  cookies?: Record<string, string>,
) {
  const trpcService = new TrpcService();
  const authConfig = makeAuthConfig();
  const authService = new AuthService(db as never, redis as never, authConfig);
  const authRouter = new AuthRouter(trpcService, authService);
  const router = authRouter.buildRouter();
  const ctx = makeCtx(redis, authHeader, cookies);
  ctx.db = db as never; // inject db into context too
  return (router as unknown as { createCaller: (ctx: TrpcContext) => Record<string, (...args: unknown[]) => Promise<unknown>> }).createCaller(ctx);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeUserRow(overrides: Partial<{
  id: string;
  isActive: boolean;
  role: string;
}> = {}) {
  return {
    id: overrides.id ?? USER_ID,
    email: 'test@lagrietahonduras.com',
    username: 'testuser',
    passwordHash: PASSWORD_HASH,
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
    city: null,
    whatsappPhone: null,
    isVerified: false,
    isActive: overrides.isActive ?? true,
    role: overrides.role ?? 'user',
    stripeCustomerId: null,
    stripeConnectId: null,
    createdAt: new Date('2026-03-10T00:00:00Z'),
    updatedAt: new Date('2026-03-10T00:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Auth flow integration', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;

  beforeEach(() => {
    process.env['JWT_SECRET'] = TEST_JWT_SECRET;
    db = makeMockDb();
    redis = makeMockRedis();
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
    vi.restoreAllMocks();
  });

  // =========================================================================
  // register
  // =========================================================================

  describe('auth.register', () => {
    it('should register a new user and return accessToken', async () => {
      const returnedUser = { id: USER_ID, email: 'test@lagrietahonduras.com', username: 'testuser', displayName: null, role: 'user' };
      db._pushSelect([], []); // no email conflict, no username conflict
      db._pushInsert([returnedUser]); // user insert
      db._pushInsert([]); // session insert

      const caller = buildAuthCaller(db, redis);
      const result = await caller.register({
        email: 'test@lagrietahonduras.com',
        username: 'testuser',
        password: PASSWORD_PLAINTEXT,
      }) as { user: { id: string }; accessToken: string };

      expect(result.user.id).toBe(USER_ID);
      expect(result.accessToken).toBeTruthy();
      // refreshToken must NOT be in the response body (it's in the cookie)
      expect((result as Record<string, unknown>)['refreshToken']).toBeUndefined();
    });

    it('should reject registration with invalid email', async () => {
      const caller = buildAuthCaller(db, redis);

      await expect(
        caller.register({ email: 'not-an-email', username: 'testuser', password: PASSWORD_PLAINTEXT }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should reject registration with username shorter than 3 chars', async () => {
      const caller = buildAuthCaller(db, redis);

      await expect(
        caller.register({ email: 'test@test.com', username: 'ab', password: PASSWORD_PLAINTEXT }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should reject registration with password shorter than 8 chars', async () => {
      const caller = buildAuthCaller(db, redis);

      await expect(
        caller.register({ email: 'test@test.com', username: 'testuser', password: 'short' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should reject registration with password longer than 128 chars', async () => {
      const caller = buildAuthCaller(db, redis);

      await expect(
        caller.register({ email: 'test@test.com', username: 'testuser', password: 'A'.repeat(129) }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('should reject registration when username contains invalid chars', async () => {
      const caller = buildAuthCaller(db, redis);

      await expect(
        caller.register({ email: 'test@test.com', username: 'user name!', password: PASSWORD_PLAINTEXT }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // =========================================================================
  // login
  // =========================================================================

  describe('auth.login', () => {
    it('should return accessToken on valid credentials', async () => {
      db._pushSelect([makeUserRow()]);
      db._pushInsert([]);

      const caller = buildAuthCaller(db, redis);
      const result = await caller.login({
        email: 'test@lagrietahonduras.com',
        password: PASSWORD_PLAINTEXT,
      }) as { user: { id: string }; accessToken: string };

      expect(result.user.id).toBe(USER_ID);
      expect(result.accessToken).toBeTruthy();
      // refreshToken must NOT be in the response body (it's in the cookie)
      expect((result as Record<string, unknown>)['refreshToken']).toBeUndefined();
    });

    it('should reject login with wrong password', async () => {
      db._pushSelect([makeUserRow()]);

      const caller = buildAuthCaller(db, redis);

      await expect(
        caller.login({ email: 'test@lagrietahonduras.com', password: 'WrongPass!' }),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  // =========================================================================
  // refresh (reads from cookie)
  // =========================================================================

  describe('auth.refresh', () => {
    it('should return a new accessToken when a valid refresh cookie is present', async () => {
      // We need a real raw token and its hash in the DB
      const rawToken = 'a'.repeat(128); // 128-char hex string simulating randomBytes(64).toString('hex')
      const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex') as string;

      db._pushSelect([{
        id: 'sess-id',
        userId: USER_ID,
        refreshToken: tokenHash,
        isRevoked: false,
        expiresAt: new Date(Date.now() + TEST_REFRESH_TTL * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
      db._pushInsert([]);

      const caller = buildAuthCaller(db, redis, undefined, { refresh_token: rawToken });
      const result = await caller.refresh() as { accessToken: string };

      expect(result.accessToken).toBeTruthy();
    });

    it('should reject refresh when no cookie is present', async () => {
      const caller = buildAuthCaller(db, redis); // no cookies

      await expect(caller.refresh()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  // =========================================================================
  // me (requires auth)
  // =========================================================================

  describe('auth.me', () => {
    it('should return user profile when authenticated', async () => {
      const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
      db._pushSelect([makeUserRow()]);

      const caller = buildAuthCaller(db, redis, `Bearer ${token}`);
      const result = await caller.me() as { id: string; email: string };

      expect(result.id).toBe(USER_ID);
      expect(result.email).toBe('test@lagrietahonduras.com');
    });

    it('should reject unauthenticated me() call', async () => {
      const caller = buildAuthCaller(db, redis); // no auth header

      await expect(caller.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  // =========================================================================
  // logout
  // =========================================================================

  describe('auth.logout', () => {
    it('should blacklist the token after logout', async () => {
      const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });

      const caller = buildAuthCaller(db, redis, `Bearer ${token}`);
      await caller.logout();

      // Token should now be in Redis blacklist store
      expect(redis._store.has(`blacklist:${token}`)).toBe(true);
    });

    it('should revoke all DB sessions on logout (H3)', async () => {
      const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });

      const caller = buildAuthCaller(db, redis, `Bearer ${token}`);
      await caller.logout();

      expect(db.update).toHaveBeenCalled();
    });

    it('should reject subsequent me() calls with blacklisted token', async () => {
      const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });

      // Logout — adds token to blacklist
      const callerForLogout = buildAuthCaller(db, redis, `Bearer ${token}`);
      await callerForLogout.logout();

      // Now try to call me() with the same blacklisted token
      db._pushSelect([makeUserRow()]); // would succeed if token was valid
      const callerForMe = buildAuthCaller(db, redis, `Bearer ${token}`);

      await expect(callerForMe.me()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Token has been revoked',
      });
    });

    it('should require auth to logout', async () => {
      const caller = buildAuthCaller(db, redis); // no token

      await expect(caller.logout()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  // =========================================================================
  // Full flow: register → login → me → logout → verify rejected
  // =========================================================================

  describe('full auth flow', () => {
    it('should complete register → login → me → logout → verify token rejected', async () => {
      // STEP 1: Register
      const registeredUser = {
        id: USER_ID, email: 'full@flow.com', username: 'fullflow', displayName: null, role: 'user',
      };
      db._pushSelect([], []); // no conflicts
      db._pushInsert([registeredUser]); // user insert
      db._pushInsert([]); // session insert

      const registerCaller = buildAuthCaller(db, redis);
      const registerResult = await registerCaller.register({
        email: 'full@flow.com',
        username: 'fullflow',
        password: PASSWORD_PLAINTEXT,
      }) as { user: { id: string }; accessToken: string };

      expect(registerResult.user.id).toBe(USER_ID);
      const registeredToken = registerResult.accessToken;
      expect(registeredToken).toBeTruthy();

      // STEP 2: Login with credentials
      const loginUser = { ...makeUserRow(), email: 'full@flow.com', username: 'fullflow' };
      db._pushSelect([loginUser]);
      db._pushInsert([]);

      const loginCaller = buildAuthCaller(db, redis);
      const loginResult = await loginCaller.login({
        email: 'full@flow.com',
        password: PASSWORD_PLAINTEXT,
      }) as { user: { id: string }; accessToken: string };

      expect(loginResult.user.id).toBe(USER_ID);
      const accessToken = loginResult.accessToken;

      // STEP 3: Call me() with the access token
      db._pushSelect([loginUser]);
      const meCaller = buildAuthCaller(db, redis, `Bearer ${accessToken}`);
      const meResult = await meCaller.me() as { id: string };

      expect(meResult.id).toBe(USER_ID);

      // STEP 4: Logout
      const logoutCaller = buildAuthCaller(db, redis, `Bearer ${accessToken}`);
      await logoutCaller.logout();

      expect(redis._store.has(`blacklist:${accessToken}`)).toBe(true);

      // STEP 5: Verify the token is rejected after logout
      const postLogoutCaller = buildAuthCaller(db, redis, `Bearer ${accessToken}`);

      await expect(postLogoutCaller.me()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Token has been revoked',
      });
    });
  });
});
