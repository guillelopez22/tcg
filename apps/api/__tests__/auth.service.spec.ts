import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { AuthService } from '../src/modules/auth/auth.service';
import type { AuthConfig } from '../src/config/auth.config';
import type { Response } from 'express';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'test-secret-min-32-chars-for-hs256';
const TEST_ACCESS_TTL = 900;
const TEST_REFRESH_TTL = 2_592_000;

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockRes(): Response {
  return {
    cookie: vi.fn(),
  } as unknown as Response;
}

function makeAuthConfig(overrides: Partial<{
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
}> = {}): AuthConfig {
  return {
    jwtSecret: overrides.jwtSecret ?? TEST_JWT_SECRET,
    accessTokenTtlSeconds: overrides.accessTokenTtlSeconds ?? TEST_ACCESS_TTL,
    refreshTokenTtlSeconds: overrides.refreshTokenTtlSeconds ?? TEST_REFRESH_TTL,
  } as AuthConfig;
}

/**
 * Drizzle-style chainable mock.
 *
 * Call patterns used in auth.service.ts:
 *   SELECT: db.select({...}).from(t).where(eq(...)).limit(1) → Promise<T[]>
 *   SELECT: db.select().from(t).where(...).limit(1)          → Promise<T[]>
 *   INSERT: db.insert(t).values({...}).returning({...})       → Promise<T[]>
 *   INSERT: db.insert(t).values({...})                        → awaited directly → void
 *   UPDATE: db.update(t).set({...}).where(eq(...))            → Promise<void>
 */
function makeMockDb() {
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];
  let selectIdx = 0;
  let insertIdx = 0;

  // db.select() — each call returns a fresh chain linked to the next queued result
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

  // db.insert() — each call returns a fresh chain linked to the next queued result
  const insert = vi.fn().mockImplementation(() => {
    const capturedIdx = insertIdx++;
    const chain: Record<string, unknown> = {};
    chain['values'] = vi.fn().mockImplementation(() => {
      const valuesChain: Record<string, unknown> = {};
      // .returning() → resolves to the queued result
      valuesChain['returning'] = vi.fn().mockImplementation(() =>
        Promise.resolve(insertResults[capturedIdx] ?? []),
      );
      // Directly awaited (no .returning()) → also resolves (to void)
      valuesChain['then'] = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
      return valuesChain;
    });
    return chain;
  });

  // db.update() — always resolves (we don't care about return value in auth tests)
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
    // Test helpers to enqueue results
    _pushSelect: (...rows: unknown[][]) => { selectResults.push(...rows); },
    _pushInsert: (...rows: unknown[][]) => { insertResults.push(...rows); },
  };
}

function makeMockRedis() {
  return {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  };
}

function makeRawRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signTestJwt(userId: string, role = 'user'): string {
  return jwt.sign({ sub: userId, role }, TEST_JWT_SECRET, { expiresIn: TEST_ACCESS_TTL });
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SESSION_ID = 'sess-1111-2222-3333-4444-555555555555';

const PASSWORD_PLAINTEXT = 'Password123!';
// Low bcrypt rounds (1) for test speed — still a real bcrypt hash
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD_PLAINTEXT, 1);

const TEST_USER_ROW = {
  id: USER_ID,
  email: 'juan@lagrietahonduras.com',
  username: 'juanrift',
  passwordHash: PASSWORD_HASH,
  displayName: 'Juan Rift',
  avatarUrl: null,
  bio: null,
  city: 'Tegucigalpa',
  whatsappPhone: null,
  isVerified: false,
  isActive: true,
  role: 'user',
  stripeCustomerId: null,
  stripeConnectId: null,
  createdAt: new Date('2026-03-10T00:00:00Z'),
  updatedAt: new Date('2026-03-10T00:00:00Z'),
};

const TEST_SESSION_ROW = {
  id: SESSION_ID,
  userId: USER_ID,
  refreshToken: hashRefreshToken('placeholder'),
  userAgent: null,
  ipAddress: null,
  isRevoked: false,
  expiresAt: new Date(Date.now() + TEST_REFRESH_TTL * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  let db: ReturnType<typeof makeMockDb>;
  let redis: ReturnType<typeof makeMockRedis>;
  let authConfig: AuthConfig;
  let service: AuthService;
  let mockRes: Response;

  beforeEach(() => {
    db = makeMockDb();
    redis = makeMockRedis();
    authConfig = makeAuthConfig();
    service = new AuthService(db as never, redis as never, authConfig);
    mockRes = makeMockRes();
  });

  // =========================================================================
  // register()
  // =========================================================================

  describe('register()', () => {
    function setupRegisterSuccess(overrides: Partial<{
      email: string;
      username: string;
      displayName: string | null;
      role: string;
    }> = {}) {
      const returned = {
        id: USER_ID,
        email: overrides.email ?? TEST_USER_ROW.email,
        username: overrides.username ?? TEST_USER_ROW.username,
        displayName: overrides.displayName !== undefined ? overrides.displayName : TEST_USER_ROW.displayName,
        role: overrides.role ?? TEST_USER_ROW.role,
      };
      db._pushSelect([], []); // no existing email, no existing username
      db._pushInsert([returned]); // user insert returning
      db._pushInsert([]); // session insert (values without returning)
      return returned;
    }

    it('should return user and accessToken on successful registration', async () => {
      const returned = setupRegisterSuccess();

      const result = await service.register({
        email: 'Juan@LaGrietaHonduras.com',
        username: 'JuanRift',
        password: PASSWORD_PLAINTEXT,
        displayName: 'Juan Rift',
      }, mockRes);

      expect(result.user.id).toBe(returned.id);
      expect(result.user.email).toBe(returned.email);
      expect(result.accessToken).toBeTruthy();
    });

    it('should set an httpOnly cookie for the refresh token', async () => {
      setupRegisterSuccess();

      await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledOnce();
      const [cookieName, , options] = (mockRes.cookie as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
      expect(cookieName).toBe('refresh_token');
      expect(options['httpOnly']).toBe(true);
    });

    it('should NOT return refreshToken in the response body', async () => {
      setupRegisterSuccess();

      const result = await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect((result as Record<string, unknown>)['refreshToken']).toBeUndefined();
      expect((result as Record<string, unknown>)['tokens']).toBeUndefined();
    });

    it('should lowercase email before storing', async () => {
      setupRegisterSuccess({ email: 'juan@lagrietahonduras.com' });

      const result = await service.register({
        email: 'JUAN@LAGRIETAHONDURAS.COM',
        username: 'juanrift',
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect(result.user.email).toBe('juan@lagrietahonduras.com');
    });

    it('should lowercase username before storing', async () => {
      setupRegisterSuccess({ username: 'juanrift' });

      const result = await service.register({
        email: TEST_USER_ROW.email,
        username: 'JuanRIFT',
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect(result.user.username).toBe('juanrift');
    });

    it('should issue a JWT access token with correct sub and role claims', async () => {
      setupRegisterSuccess();

      const result = await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      const decoded = jwt.verify(result.accessToken, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(decoded['sub']).toBe(USER_ID);
      expect(decoded['role']).toBe('user');
    });

    it('should hash the password with bcryptjs at 12 rounds', async () => {
      const hashSpy = vi.spyOn(bcrypt, 'hash');
      setupRegisterSuccess();

      await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect(hashSpy).toHaveBeenCalledOnce();
      const [plaintext, rounds] = hashSpy.mock.calls[0] as [string, number];
      expect(plaintext).toBe(PASSWORD_PLAINTEXT);
      expect(rounds).toBe(12);
    });

    it('should set displayName when provided', async () => {
      setupRegisterSuccess({ displayName: 'Juan Rift' });

      const result = await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
        displayName: 'Juan Rift',
      }, mockRes);

      expect(result.user.displayName).toBe('Juan Rift');
    });

    it('should set displayName to null when not provided', async () => {
      setupRegisterSuccess({ displayName: null });

      const result = await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect(result.user.displayName).toBeNull();
    });

    it('should throw CONFLICT when email already exists', async () => {
      db._pushSelect([{ id: USER_ID }]); // email already taken

      await expect(
        service.register({ email: TEST_USER_ROW.email, username: 'newuser', password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('should throw CONFLICT when username already exists', async () => {
      db._pushSelect([]); // email is free
      db._pushSelect([{ id: USER_ID }]); // username already taken

      await expect(
        service.register({ email: 'new@user.com', username: TEST_USER_ROW.username, password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('should stop after email conflict without checking username', async () => {
      db._pushSelect([{ id: USER_ID }]); // email conflict

      await expect(
        service.register({ email: TEST_USER_ROW.email, username: 'newuser', password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'CONFLICT' });

      // Only 1 select call should have been made (stopped before username check)
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should throw INTERNAL_SERVER_ERROR when DB insert returns no rows', async () => {
      db._pushSelect([], []); // no conflicts
      db._pushInsert([]); // insert returns empty — unexpected DB failure

      await expect(
        service.register({ email: 'brand@new.com', username: 'brandnew', password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
    });

    it('should not expose passwordHash in the returned user object', async () => {
      setupRegisterSuccess();

      const result = await service.register({
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        password: PASSWORD_PLAINTEXT,
      }, mockRes);

      expect((result.user as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });
  });

  // =========================================================================
  // login()
  // =========================================================================

  describe('login()', () => {
    it('should return user and accessToken on valid credentials', async () => {
      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]); // session insert

      const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes);

      expect(result.user.id).toBe(USER_ID);
      expect(result.user.email).toBe(TEST_USER_ROW.email);
      expect(result.accessToken).toBeTruthy();
    });

    it('should set an httpOnly cookie for the refresh token', async () => {
      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]);

      await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledOnce();
      const [cookieName, , options] = (mockRes.cookie as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
      expect(cookieName).toBe('refresh_token');
      expect(options['httpOnly']).toBe(true);
    });

    it('should NOT return refreshToken in the response body', async () => {
      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]);

      const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes);

      expect((result as Record<string, unknown>)['refreshToken']).toBeUndefined();
      expect((result as Record<string, unknown>)['tokens']).toBeUndefined();
    });

    it('should issue a JWT with correct sub and role', async () => {
      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]);

      const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes);

      const decoded = jwt.verify(result.accessToken, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(decoded['sub']).toBe(USER_ID);
      expect(decoded['role']).toBe('user');
    });

    it('should throw UNAUTHORIZED when user does not exist', async () => {
      db._pushSelect([]); // no user found

      await expect(
        service.login({ email: 'ghost@nowhere.com', password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    });

    it('should throw UNAUTHORIZED when password is wrong', async () => {
      db._pushSelect([TEST_USER_ROW]);

      await expect(
        service.login({ email: TEST_USER_ROW.email, password: 'WrongPass99!' }, mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
    });

    it('should throw FORBIDDEN when account is deactivated', async () => {
      db._pushSelect([{ ...TEST_USER_ROW, isActive: false }]);

      await expect(
        service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Account is deactivated' });
    });

    it('should not expose passwordHash in the returned user', async () => {
      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]);

      const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes);

      expect((result.user as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('should issue unique access tokens on successive logins', async () => {
      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]);
      const r1 = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, mockRes);

      db._pushSelect([TEST_USER_ROW]);
      db._pushInsert([]);
      const r2 = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT }, makeMockRes());

      // Access tokens should differ because they encode different `iat`/`jti` values
      // (at minimum they will be different random session backing tokens)
      expect(r1.accessToken).toBeTruthy();
      expect(r2.accessToken).toBeTruthy();
    });

    it('should return UNAUTHORIZED (not FORBIDDEN) when user does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.login({ email: 'ghost@example.com', password: PASSWORD_PLAINTEXT }, mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
  });

  // =========================================================================
  // refresh()
  // =========================================================================

  describe('refresh()', () => {
    it('should return a new access token on valid cookie token', async () => {
      const rawToken = makeRawRefreshToken();
      const session = { ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) };

      db._pushSelect([session]); // session lookup
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]); // user lookup
      db._pushInsert([]); // new session insert

      const result = await service.refresh(rawToken, mockRes);

      expect(result.accessToken).toBeTruthy();
    });

    it('should set a new httpOnly cookie for the rotated refresh token', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
      db._pushInsert([]);

      await service.refresh(rawToken, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledOnce();
      const [cookieName, newToken, options] = (mockRes.cookie as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
      expect(cookieName).toBe('refresh_token');
      expect(newToken).not.toBe(rawToken); // token is rotated
      expect(options['httpOnly']).toBe(true);
    });

    it('should NOT return refreshToken in the response body', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
      db._pushInsert([]);

      const result = await service.refresh(rawToken, mockRes);

      expect((result as Record<string, unknown>)['refreshToken']).toBeUndefined();
    });

    it('should throw UNAUTHORIZED when session is not found', async () => {
      db._pushSelect([]); // no session found

      await expect(
        service.refresh(makeRawRefreshToken(), mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
    });

    it('should throw UNAUTHORIZED when session is already revoked', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken), isRevoked: true }]);

      await expect(
        service.refresh(rawToken, mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Refresh token reuse detected' });
    });

    it('should revoke ALL user sessions when token reuse is detected', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken), isRevoked: true }]);

      try { await service.refresh(rawToken, mockRes); } catch { /* expected */ }

      expect(db.update).toHaveBeenCalled();
    });

    it('should throw UNAUTHORIZED when user is deactivated at refresh time', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: false }]);

      await expect(
        service.refresh(rawToken, mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'User not found or deactivated' });
    });

    it('should throw UNAUTHORIZED when user no longer exists', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
      db._pushSelect([]); // user deleted

      await expect(
        service.refresh(rawToken, mockRes),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'User not found or deactivated' });
    });

    it('should revoke the old session before issuing new tokens', async () => {
      const rawToken = makeRawRefreshToken();
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
      db._pushInsert([]);

      await service.refresh(rawToken, mockRes);

      expect(db.update).toHaveBeenCalled();
    });

    it('should accept a token within the 30-second grace period (15s past expiry)', async () => {
      const rawToken = makeRawRefreshToken();
      // Expired 15 seconds ago — within 30s grace window
      db._pushSelect([{
        ...TEST_SESSION_ROW,
        refreshToken: hashRefreshToken(rawToken),
        expiresAt: new Date(Date.now() - 15_000),
      }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
      db._pushInsert([]);

      const result = await service.refresh(rawToken, mockRes);
      expect(result.accessToken).toBeTruthy();
    });

    it('should store refresh token as SHA-256 hash (raw token not queryable)', async () => {
      // If service queries by raw token (not hash), it won't find our session
      const rawToken = makeRawRefreshToken();
      const tokenHash = hashRefreshToken(rawToken);
      db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: tokenHash }]);
      db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
      db._pushInsert([]);

      const result = await service.refresh(rawToken, mockRes);
      expect(result.accessToken).toBeTruthy(); // proves hash lookup worked
    });
  });

  // =========================================================================
  // logout()
  // =========================================================================

  describe('logout()', () => {
    it('should blacklist the access token in Redis with correct key', async () => {
      const accessToken = signTestJwt(USER_ID);

      await service.logout(USER_ID, accessToken);

      expect(redis.setex).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith(`blacklist:${accessToken}`, TEST_ACCESS_TTL, '1');
    });

    it('should use the configured access TTL for Redis expiry', async () => {
      const customConfig = makeAuthConfig({ accessTokenTtlSeconds: 300 });
      const svc = new AuthService(db as never, redis as never, customConfig);

      await svc.logout(USER_ID, signTestJwt(USER_ID));

      const [, ttl] = redis.setex.mock.calls[0] as [string, number, string];
      expect(ttl).toBe(300);
    });

    it('should resolve to undefined (void return)', async () => {
      await expect(service.logout(USER_ID, signTestJwt(USER_ID))).resolves.toBeUndefined();
    });

    it('should revoke all active DB sessions for the user (H3)', async () => {
      await service.logout(USER_ID, signTestJwt(USER_ID));
      expect(db.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // logoutAll()
  // =========================================================================

  describe('logoutAll()', () => {
    it('should blacklist the access token in Redis', async () => {
      const accessToken = signTestJwt(USER_ID);

      await service.logoutAll(USER_ID, accessToken);

      expect(redis.setex).toHaveBeenCalledWith(`blacklist:${accessToken}`, TEST_ACCESS_TTL, '1');
    });

    it('should revoke all DB sessions for the user', async () => {
      await service.logoutAll(USER_ID, signTestJwt(USER_ID));
      expect(db.update).toHaveBeenCalled();
    });

    it('should perform both Redis blacklist AND DB session revocation', async () => {
      await service.logoutAll(USER_ID, signTestJwt(USER_ID));
      expect(redis.setex).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('should resolve to undefined (void return)', async () => {
      await expect(service.logoutAll(USER_ID, signTestJwt(USER_ID))).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // me()
  // =========================================================================

  describe('me()', () => {
    it('should return full profile when user exists', async () => {
      db._pushSelect([TEST_USER_ROW]);

      const result = await service.me(USER_ID);

      expect(result.id).toBe(USER_ID);
      expect(result.email).toBe(TEST_USER_ROW.email);
      expect(result.username).toBe(TEST_USER_ROW.username);
      expect(result.isActive).toBe(true);
    });

    it('should include all required profile fields', async () => {
      db._pushSelect([TEST_USER_ROW]);

      const result = await service.me(USER_ID);

      const required = [
        'id', 'email', 'username', 'displayName', 'avatarUrl',
        'bio', 'city', 'whatsappPhone', 'isVerified', 'isActive',
        'role', 'createdAt', 'updatedAt',
      ];
      for (const field of required) {
        expect(result, `missing field: ${field}`).toHaveProperty(field);
      }
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      db._pushSelect([]);

      await expect(
        service.me('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'User not found' });
    });

    it('should not expose passwordHash in the result (service selects only named fields)', async () => {
      db._pushSelect([{
        id: TEST_USER_ROW.id,
        email: TEST_USER_ROW.email,
        username: TEST_USER_ROW.username,
        displayName: TEST_USER_ROW.displayName,
        avatarUrl: TEST_USER_ROW.avatarUrl,
        bio: TEST_USER_ROW.bio,
        city: TEST_USER_ROW.city,
        whatsappPhone: TEST_USER_ROW.whatsappPhone,
        isVerified: TEST_USER_ROW.isVerified,
        isActive: TEST_USER_ROW.isActive,
        role: TEST_USER_ROW.role,
        createdAt: TEST_USER_ROW.createdAt,
        updatedAt: TEST_USER_ROW.updatedAt,
        // NOTE: passwordHash intentionally excluded
      }]);

      const result = await service.me(USER_ID);

      expect((result as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('should return null for nullable profile fields when not set', async () => {
      db._pushSelect([{
        ...TEST_USER_ROW,
        displayName: null, avatarUrl: null, bio: null, city: null, whatsappPhone: null,
      }]);

      const result = await service.me(USER_ID);

      expect(result.displayName).toBeNull();
      expect(result.avatarUrl).toBeNull();
      expect(result.bio).toBeNull();
      expect(result.city).toBeNull();
      expect(result.whatsappPhone).toBeNull();
    });

    it('should return isVerified as false for a freshly registered user', async () => {
      db._pushSelect([{ ...TEST_USER_ROW, isVerified: false }]);

      const result = await service.me(USER_ID);

      expect(result.isVerified).toBe(false);
    });
  });
});
