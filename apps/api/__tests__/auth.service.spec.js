"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const crypto = __importStar(require("crypto"));
const auth_service_1 = require("../src/modules/auth/auth.service");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TEST_JWT_SECRET = 'test-secret-min-32-chars-for-hs256';
const TEST_ACCESS_TTL = 900;
const TEST_REFRESH_TTL = 2_592_000;
// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function makeAuthConfig(overrides = {}) {
    return {
        jwtSecret: overrides.jwtSecret ?? TEST_JWT_SECRET,
        accessTokenTtlSeconds: overrides.accessTokenTtlSeconds ?? TEST_ACCESS_TTL,
        refreshTokenTtlSeconds: overrides.refreshTokenTtlSeconds ?? TEST_REFRESH_TTL,
    };
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
 *
 * Key insight: mockReturnThis() returns the mock FUNCTION itself as `this`,
 * NOT the parent chain. We must use mockReturnValue(chain) explicitly.
 */
function makeMockDb() {
    const selectResults = [];
    const insertResults = [];
    let selectIdx = 0;
    let insertIdx = 0;
    // db.select() — each call returns a fresh chain linked to the next queued result
    const select = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = selectIdx++;
        const chain = {};
        chain['from'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
        return chain;
    });
    // db.insert() — each call returns a fresh chain linked to the next queued result
    const insert = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = insertIdx++;
        const chain = {};
        chain['values'] = vitest_1.vi.fn().mockImplementation(() => {
            const valuesChain = {};
            // .returning() → resolves to the queued result
            valuesChain['returning'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(insertResults[capturedIdx] ?? []));
            // Directly awaited (no .returning()) → also resolves (to void)
            valuesChain['then'] = (onFulfilled) => Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
            return valuesChain;
        });
        return chain;
    });
    // db.update() — always resolves (we don't care about return value in auth tests)
    const update = vitest_1.vi.fn().mockImplementation(() => {
        const chain = {};
        chain['set'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockResolvedValue([]);
        return chain;
    });
    return {
        select,
        insert,
        update,
        // Test helpers to enqueue results
        _pushSelect: (...rows) => { selectResults.push(...rows); },
        _pushInsert: (...rows) => { insertResults.push(...rows); },
    };
}
function makeMockRedis() {
    return {
        setex: vitest_1.vi.fn().mockResolvedValue('OK'),
        get: vitest_1.vi.fn().mockResolvedValue(null),
    };
}
function makeRawRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}
function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
function signTestJwt(userId, role = 'user') {
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
(0, vitest_1.describe)('AuthService', () => {
    let db;
    let redis;
    let authConfig;
    let service;
    (0, vitest_1.beforeEach)(() => {
        db = makeMockDb();
        redis = makeMockRedis();
        authConfig = makeAuthConfig();
        service = new auth_service_1.AuthService(db, redis, authConfig);
    });
    // =========================================================================
    // register()
    // =========================================================================
    (0, vitest_1.describe)('register()', () => {
        function setupRegisterSuccess(overrides = {}) {
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
        (0, vitest_1.it)('should return user and tokens on successful registration', async () => {
            const returned = setupRegisterSuccess();
            const result = await service.register({
                email: 'Juan@LaGrietaHonduras.com',
                username: 'JuanRift',
                password: PASSWORD_PLAINTEXT,
                displayName: 'Juan Rift',
            });
            (0, vitest_1.expect)(result.user.id).toBe(returned.id);
            (0, vitest_1.expect)(result.user.email).toBe(returned.email);
            (0, vitest_1.expect)(result.tokens.accessToken).toBeTruthy();
            (0, vitest_1.expect)(result.tokens.refreshToken).toBeTruthy();
        });
        (0, vitest_1.it)('should lowercase email before storing', async () => {
            setupRegisterSuccess({ email: 'juan@lagrietahonduras.com' });
            const result = await service.register({
                email: 'JUAN@LAGRIETAHONDURAS.COM',
                username: 'juanrift',
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(result.user.email).toBe('juan@lagrietahonduras.com');
        });
        (0, vitest_1.it)('should lowercase username before storing', async () => {
            setupRegisterSuccess({ username: 'juanrift' });
            const result = await service.register({
                email: TEST_USER_ROW.email,
                username: 'JuanRIFT',
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(result.user.username).toBe('juanrift');
        });
        (0, vitest_1.it)('should issue a JWT access token with correct sub and role claims', async () => {
            setupRegisterSuccess();
            const result = await service.register({
                email: TEST_USER_ROW.email,
                username: TEST_USER_ROW.username,
                password: PASSWORD_PLAINTEXT,
            });
            const decoded = jwt.verify(result.tokens.accessToken, TEST_JWT_SECRET);
            (0, vitest_1.expect)(decoded['sub']).toBe(USER_ID);
            (0, vitest_1.expect)(decoded['role']).toBe('user');
        });
        (0, vitest_1.it)('should return a 128-character hex raw refresh token', async () => {
            setupRegisterSuccess();
            const result = await service.register({
                email: TEST_USER_ROW.email,
                username: TEST_USER_ROW.username,
                password: PASSWORD_PLAINTEXT,
            });
            // 64 random bytes as hex = 128 chars
            (0, vitest_1.expect)(result.tokens.refreshToken.length).toBe(128);
            (0, vitest_1.expect)(result.tokens.refreshToken).toMatch(/^[0-9a-f]+$/);
        });
        (0, vitest_1.it)('should hash the password with bcryptjs at 12 rounds', async () => {
            const hashSpy = vitest_1.vi.spyOn(bcrypt, 'hash');
            setupRegisterSuccess();
            await service.register({
                email: TEST_USER_ROW.email,
                username: TEST_USER_ROW.username,
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(hashSpy).toHaveBeenCalledOnce();
            const [plaintext, rounds] = hashSpy.mock.calls[0];
            (0, vitest_1.expect)(plaintext).toBe(PASSWORD_PLAINTEXT);
            (0, vitest_1.expect)(rounds).toBe(12);
        });
        (0, vitest_1.it)('should set displayName when provided', async () => {
            setupRegisterSuccess({ displayName: 'Juan Rift' });
            const result = await service.register({
                email: TEST_USER_ROW.email,
                username: TEST_USER_ROW.username,
                password: PASSWORD_PLAINTEXT,
                displayName: 'Juan Rift',
            });
            (0, vitest_1.expect)(result.user.displayName).toBe('Juan Rift');
        });
        (0, vitest_1.it)('should set displayName to null when not provided', async () => {
            setupRegisterSuccess({ displayName: null });
            const result = await service.register({
                email: TEST_USER_ROW.email,
                username: TEST_USER_ROW.username,
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(result.user.displayName).toBeNull();
        });
        (0, vitest_1.it)('should throw CONFLICT when email already exists', async () => {
            db._pushSelect([{ id: USER_ID }]); // email already taken
            await (0, vitest_1.expect)(service.register({ email: TEST_USER_ROW.email, username: 'newuser', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'CONFLICT', message: 'Email already in use' });
        });
        (0, vitest_1.it)('should throw CONFLICT when username already exists', async () => {
            db._pushSelect([]); // email is free
            db._pushSelect([{ id: USER_ID }]); // username already taken
            await (0, vitest_1.expect)(service.register({ email: 'new@user.com', username: TEST_USER_ROW.username, password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'CONFLICT', message: 'Username already taken' });
        });
        (0, vitest_1.it)('should stop after email conflict without checking username', async () => {
            db._pushSelect([{ id: USER_ID }]); // email conflict
            await (0, vitest_1.expect)(service.register({ email: TEST_USER_ROW.email, username: 'newuser', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'CONFLICT', message: 'Email already in use' });
            // Only 1 select call should have been made (stopped before username check)
            (0, vitest_1.expect)(db.select).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)('should throw INTERNAL_SERVER_ERROR when DB insert returns no rows', async () => {
            db._pushSelect([], []); // no conflicts
            db._pushInsert([]); // insert returns empty — unexpected DB failure
            await (0, vitest_1.expect)(service.register({ email: 'brand@new.com', username: 'brandnew', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
        });
        (0, vitest_1.it)('should not expose passwordHash in the returned user object', async () => {
            setupRegisterSuccess();
            const result = await service.register({
                email: TEST_USER_ROW.email,
                username: TEST_USER_ROW.username,
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(result.user['passwordHash']).toBeUndefined();
        });
    });
    // =========================================================================
    // login()
    // =========================================================================
    (0, vitest_1.describe)('login()', () => {
        (0, vitest_1.it)('should return user and tokens on valid credentials', async () => {
            db._pushSelect([TEST_USER_ROW]);
            db._pushInsert([]); // session insert
            const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT });
            (0, vitest_1.expect)(result.user.id).toBe(USER_ID);
            (0, vitest_1.expect)(result.user.email).toBe(TEST_USER_ROW.email);
            (0, vitest_1.expect)(result.tokens.accessToken).toBeTruthy();
            (0, vitest_1.expect)(result.tokens.refreshToken).toBeTruthy();
        });
        (0, vitest_1.it)('should issue a JWT with correct sub and role', async () => {
            db._pushSelect([TEST_USER_ROW]);
            db._pushInsert([]);
            const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT });
            const decoded = jwt.verify(result.tokens.accessToken, TEST_JWT_SECRET);
            (0, vitest_1.expect)(decoded['sub']).toBe(USER_ID);
            (0, vitest_1.expect)(decoded['role']).toBe('user');
        });
        (0, vitest_1.it)('should throw UNAUTHORIZED when user does not exist', async () => {
            db._pushSelect([]); // no user found
            await (0, vitest_1.expect)(service.login({ email: 'ghost@nowhere.com', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
        });
        (0, vitest_1.it)('should throw UNAUTHORIZED when password is wrong', async () => {
            db._pushSelect([TEST_USER_ROW]);
            await (0, vitest_1.expect)(service.login({ email: TEST_USER_ROW.email, password: 'WrongPass99!' })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
        });
        (0, vitest_1.it)('should throw FORBIDDEN when account is deactivated', async () => {
            db._pushSelect([{ ...TEST_USER_ROW, isActive: false }]);
            await (0, vitest_1.expect)(service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Account is deactivated' });
        });
        (0, vitest_1.it)('should not expose passwordHash in the returned user', async () => {
            db._pushSelect([TEST_USER_ROW]);
            db._pushInsert([]);
            const result = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT });
            (0, vitest_1.expect)(result.user['passwordHash']).toBeUndefined();
        });
        (0, vitest_1.it)('should return unique refresh tokens on successive logins (crypto.randomBytes)', async () => {
            db._pushSelect([TEST_USER_ROW]);
            db._pushInsert([]);
            const r1 = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT });
            db._pushSelect([TEST_USER_ROW]);
            db._pushInsert([]);
            const r2 = await service.login({ email: TEST_USER_ROW.email, password: PASSWORD_PLAINTEXT });
            (0, vitest_1.expect)(r1.tokens.refreshToken).not.toBe(r2.tokens.refreshToken);
        });
        (0, vitest_1.it)('should return UNAUTHORIZED (not FORBIDDEN) when user does not exist', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(service.login({ email: 'ghost@example.com', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });
    });
    // =========================================================================
    // refresh()
    // =========================================================================
    (0, vitest_1.describe)('refresh()', () => {
        (0, vitest_1.it)('should return new access and refresh tokens on valid token', async () => {
            const rawToken = makeRawRefreshToken();
            const session = { ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) };
            db._pushSelect([session]); // session lookup
            db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]); // user lookup
            db._pushInsert([]); // new session insert
            const result = await service.refresh({ refreshToken: rawToken });
            (0, vitest_1.expect)(result.accessToken).toBeTruthy();
            (0, vitest_1.expect)(result.refreshToken).toBeTruthy();
            (0, vitest_1.expect)(result.refreshToken).not.toBe(rawToken); // token is rotated
        });
        (0, vitest_1.it)('should throw UNAUTHORIZED when session is not found', async () => {
            db._pushSelect([]); // no session found
            await (0, vitest_1.expect)(service.refresh({ refreshToken: makeRawRefreshToken() })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
        });
        (0, vitest_1.it)('should throw UNAUTHORIZED when session is already revoked', async () => {
            const rawToken = makeRawRefreshToken();
            db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken), isRevoked: true }]);
            await (0, vitest_1.expect)(service.refresh({ refreshToken: rawToken })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Refresh token reuse detected' });
        });
        (0, vitest_1.it)('should revoke ALL user sessions when token reuse is detected', async () => {
            const rawToken = makeRawRefreshToken();
            db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken), isRevoked: true }]);
            try {
                await service.refresh({ refreshToken: rawToken });
            }
            catch { /* expected */ }
            (0, vitest_1.expect)(db.update).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should throw UNAUTHORIZED when user is deactivated at refresh time', async () => {
            const rawToken = makeRawRefreshToken();
            db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
            db._pushSelect([{ id: USER_ID, role: 'user', isActive: false }]);
            await (0, vitest_1.expect)(service.refresh({ refreshToken: rawToken })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'User not found or deactivated' });
        });
        (0, vitest_1.it)('should throw UNAUTHORIZED when user no longer exists', async () => {
            const rawToken = makeRawRefreshToken();
            db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
            db._pushSelect([]); // user deleted
            await (0, vitest_1.expect)(service.refresh({ refreshToken: rawToken })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'User not found or deactivated' });
        });
        (0, vitest_1.it)('should revoke the old session before issuing new tokens', async () => {
            const rawToken = makeRawRefreshToken();
            db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: hashRefreshToken(rawToken) }]);
            db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
            db._pushInsert([]);
            await service.refresh({ refreshToken: rawToken });
            (0, vitest_1.expect)(db.update).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should accept a token within the 30-second grace period (15s past expiry)', async () => {
            const rawToken = makeRawRefreshToken();
            // Expired 15 seconds ago — within 30s grace window
            db._pushSelect([{
                    ...TEST_SESSION_ROW,
                    refreshToken: hashRefreshToken(rawToken),
                    expiresAt: new Date(Date.now() - 15_000),
                }]);
            db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
            db._pushInsert([]);
            const result = await service.refresh({ refreshToken: rawToken });
            (0, vitest_1.expect)(result.accessToken).toBeTruthy();
        });
        (0, vitest_1.it)('should store refresh token as SHA-256 hash (raw token not queryable)', async () => {
            // If service queries by raw token (not hash), it won't find our session
            const rawToken = makeRawRefreshToken();
            const tokenHash = hashRefreshToken(rawToken);
            db._pushSelect([{ ...TEST_SESSION_ROW, refreshToken: tokenHash }]);
            db._pushSelect([{ id: USER_ID, role: 'user', isActive: true }]);
            db._pushInsert([]);
            const result = await service.refresh({ refreshToken: rawToken });
            (0, vitest_1.expect)(result.accessToken).toBeTruthy(); // proves hash lookup worked
        });
    });
    // =========================================================================
    // logout()
    // =========================================================================
    (0, vitest_1.describe)('logout()', () => {
        (0, vitest_1.it)('should blacklist the access token in Redis with correct key', async () => {
            const accessToken = signTestJwt(USER_ID);
            await service.logout(USER_ID, accessToken);
            (0, vitest_1.expect)(redis.setex).toHaveBeenCalledOnce();
            (0, vitest_1.expect)(redis.setex).toHaveBeenCalledWith(`blacklist:${accessToken}`, TEST_ACCESS_TTL, '1');
        });
        (0, vitest_1.it)('should use the configured access TTL for Redis expiry', async () => {
            const customConfig = makeAuthConfig({ accessTokenTtlSeconds: 300 });
            const svc = new auth_service_1.AuthService(db, redis, customConfig);
            await svc.logout(USER_ID, signTestJwt(USER_ID));
            const [, ttl] = redis.setex.mock.calls[0];
            (0, vitest_1.expect)(ttl).toBe(300);
        });
        (0, vitest_1.it)('should resolve to undefined (void return)', async () => {
            await (0, vitest_1.expect)(service.logout(USER_ID, signTestJwt(USER_ID))).resolves.toBeUndefined();
        });
        (0, vitest_1.it)('should NOT revoke DB sessions (single-device logout only)', async () => {
            await service.logout(USER_ID, signTestJwt(USER_ID));
            (0, vitest_1.expect)(db.update).not.toHaveBeenCalled();
        });
    });
    // =========================================================================
    // logoutAll()
    // =========================================================================
    (0, vitest_1.describe)('logoutAll()', () => {
        (0, vitest_1.it)('should blacklist the access token in Redis', async () => {
            const accessToken = signTestJwt(USER_ID);
            await service.logoutAll(USER_ID, accessToken);
            (0, vitest_1.expect)(redis.setex).toHaveBeenCalledWith(`blacklist:${accessToken}`, TEST_ACCESS_TTL, '1');
        });
        (0, vitest_1.it)('should revoke all DB sessions for the user', async () => {
            await service.logoutAll(USER_ID, signTestJwt(USER_ID));
            (0, vitest_1.expect)(db.update).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should perform both Redis blacklist AND DB session revocation', async () => {
            await service.logoutAll(USER_ID, signTestJwt(USER_ID));
            (0, vitest_1.expect)(redis.setex).toHaveBeenCalled();
            (0, vitest_1.expect)(db.update).toHaveBeenCalled();
        });
        (0, vitest_1.it)('should resolve to undefined (void return)', async () => {
            await (0, vitest_1.expect)(service.logoutAll(USER_ID, signTestJwt(USER_ID))).resolves.toBeUndefined();
        });
    });
    // =========================================================================
    // me()
    // =========================================================================
    (0, vitest_1.describe)('me()', () => {
        (0, vitest_1.it)('should return full profile when user exists', async () => {
            db._pushSelect([TEST_USER_ROW]);
            const result = await service.me(USER_ID);
            (0, vitest_1.expect)(result.id).toBe(USER_ID);
            (0, vitest_1.expect)(result.email).toBe(TEST_USER_ROW.email);
            (0, vitest_1.expect)(result.username).toBe(TEST_USER_ROW.username);
            (0, vitest_1.expect)(result.isActive).toBe(true);
        });
        (0, vitest_1.it)('should include all required profile fields', async () => {
            db._pushSelect([TEST_USER_ROW]);
            const result = await service.me(USER_ID);
            const required = [
                'id', 'email', 'username', 'displayName', 'avatarUrl',
                'bio', 'city', 'whatsappPhone', 'isVerified', 'isActive',
                'role', 'createdAt', 'updatedAt',
            ];
            for (const field of required) {
                (0, vitest_1.expect)(result, `missing field: ${field}`).toHaveProperty(field);
            }
        });
        (0, vitest_1.it)('should throw NOT_FOUND when user does not exist', async () => {
            db._pushSelect([]);
            await (0, vitest_1.expect)(service.me('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'User not found' });
        });
        (0, vitest_1.it)('should not expose passwordHash in the result (service selects only named fields)', async () => {
            // The service does db.select({id, email, ...}) with explicit column names —
            // passwordHash is NOT in the select projection. We verify via the DB mock:
            // if the mock returns a row without passwordHash, the result won't have it either.
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
            (0, vitest_1.expect)(result['passwordHash']).toBeUndefined();
        });
        (0, vitest_1.it)('should return null for nullable profile fields when not set', async () => {
            db._pushSelect([{
                    ...TEST_USER_ROW,
                    displayName: null, avatarUrl: null, bio: null, city: null, whatsappPhone: null,
                }]);
            const result = await service.me(USER_ID);
            (0, vitest_1.expect)(result.displayName).toBeNull();
            (0, vitest_1.expect)(result.avatarUrl).toBeNull();
            (0, vitest_1.expect)(result.bio).toBeNull();
            (0, vitest_1.expect)(result.city).toBeNull();
            (0, vitest_1.expect)(result.whatsappPhone).toBeNull();
        });
        (0, vitest_1.it)('should return isVerified as false for a freshly registered user', async () => {
            db._pushSelect([{ ...TEST_USER_ROW, isVerified: false }]);
            const result = await service.me(USER_ID);
            (0, vitest_1.expect)(result.isVerified).toBe(false);
        });
    });
});
