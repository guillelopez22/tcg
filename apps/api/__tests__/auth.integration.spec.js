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
/**
 * Integration tests for the Auth flow.
 *
 * Tests the full stack: AuthRouter → AuthService → mocked DB/Redis.
 * Uses router.createCaller() to exercise the complete request pipeline
 * including tRPC middleware (auth, logging, rate limiting).
 *
 * Flow tested: register → login → me → refresh → logout → verify rejected
 */
const vitest_1 = require("vitest");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const trpc_service_1 = require("../src/trpc/trpc.service");
const auth_service_1 = require("../src/modules/auth/auth.service");
const auth_router_1 = require("../src/modules/auth/auth.router");
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
function makeMockDb() {
    const selectResults = [];
    const insertResults = [];
    let selectIdx = 0;
    let insertIdx = 0;
    const select = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = selectIdx++;
        const chain = {};
        chain['from'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['where'] = vitest_1.vi.fn().mockReturnValue(chain);
        chain['limit'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(selectResults[capturedIdx] ?? []));
        return chain;
    });
    const insert = vitest_1.vi.fn().mockImplementation(() => {
        const capturedIdx = insertIdx++;
        const chain = {};
        chain['values'] = vitest_1.vi.fn().mockImplementation(() => {
            const valuesChain = {};
            valuesChain['returning'] = vitest_1.vi.fn().mockImplementation(() => Promise.resolve(insertResults[capturedIdx] ?? []));
            valuesChain['then'] = (onFulfilled) => Promise.resolve(insertResults[capturedIdx] ?? []).then(onFulfilled);
            return valuesChain;
        });
        return chain;
    });
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
        _pushSelect: (...rows) => { selectResults.push(...rows); },
        _pushInsert: (...rows) => { insertResults.push(...rows); },
    };
}
/**
 * Redis mock that supports:
 * - get/setex for blacklist
 * - pipeline for rate limiting (always under limit)
 */
function makeMockRedis() {
    const store = new Map();
    // Rate limit pipeline — always returns count=1 (under any limit)
    const pipeline = {
        zremrangebyscore: vitest_1.vi.fn().mockReturnThis(),
        zadd: vitest_1.vi.fn().mockReturnThis(),
        zcard: vitest_1.vi.fn().mockReturnThis(),
        expire: vitest_1.vi.fn().mockReturnThis(),
        exec: vitest_1.vi.fn().mockResolvedValue([[null, 0], [null, 1], [null, 1], [null, 1]]),
    };
    return {
        get: vitest_1.vi.fn().mockImplementation(async (key) => store.get(key) ?? null),
        setex: vitest_1.vi.fn().mockImplementation(async (key, _ttl, value) => {
            store.set(key, value);
            return 'OK';
        }),
        pipeline: vitest_1.vi.fn().mockReturnValue(pipeline),
        _store: store,
    };
}
function makeAuthConfig() {
    return {
        jwtSecret: TEST_JWT_SECRET,
        accessTokenTtlSeconds: TEST_ACCESS_TTL,
        refreshTokenTtlSeconds: TEST_REFRESH_TTL,
    };
}
function makeCtx(redis, authHeader) {
    return {
        req: {
            headers: authHeader ? { authorization: authHeader } : {},
            ip: '127.0.0.1',
            method: 'POST',
        },
        db: {}, // will be overridden in service
        redis: redis,
    };
}
// ---------------------------------------------------------------------------
// Router builder
// ---------------------------------------------------------------------------
function buildAuthCaller(db, redis, authHeader) {
    const trpcService = new trpc_service_1.TrpcService();
    const authConfig = makeAuthConfig();
    const authService = new auth_service_1.AuthService(db, redis, authConfig);
    const authRouter = new auth_router_1.AuthRouter(trpcService, authService);
    const router = authRouter.buildRouter();
    const ctx = makeCtx(redis, authHeader);
    ctx.db = db; // inject db into context too
    return router.createCaller(ctx);
}
// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
function makeUserRow(overrides = {}) {
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
(0, vitest_1.describe)('Auth flow integration', () => {
    let db;
    let redis;
    (0, vitest_1.beforeEach)(() => {
        process.env['JWT_SECRET'] = TEST_JWT_SECRET;
        db = makeMockDb();
        redis = makeMockRedis();
    });
    (0, vitest_1.afterEach)(() => {
        delete process.env['JWT_SECRET'];
        vitest_1.vi.restoreAllMocks();
    });
    // =========================================================================
    // register
    // =========================================================================
    (0, vitest_1.describe)('auth.register', () => {
        (0, vitest_1.it)('should register a new user and return tokens', async () => {
            const returnedUser = { id: USER_ID, email: 'test@lagrietahonduras.com', username: 'testuser', displayName: null, role: 'user' };
            db._pushSelect([], []); // no email conflict, no username conflict
            db._pushInsert([returnedUser]); // user insert
            db._pushInsert([]); // session insert
            const caller = buildAuthCaller(db, redis);
            const result = await caller.register({
                email: 'test@lagrietahonduras.com',
                username: 'testuser',
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(result.user.id).toBe(USER_ID);
            (0, vitest_1.expect)(result.tokens.accessToken).toBeTruthy();
            (0, vitest_1.expect)(result.tokens.refreshToken).toBeTruthy();
        });
        (0, vitest_1.it)('should reject registration with invalid email', async () => {
            const caller = buildAuthCaller(db, redis);
            await (0, vitest_1.expect)(caller.register({ email: 'not-an-email', username: 'testuser', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject registration with username shorter than 3 chars', async () => {
            const caller = buildAuthCaller(db, redis);
            await (0, vitest_1.expect)(caller.register({ email: 'test@test.com', username: 'ab', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject registration with password shorter than 8 chars', async () => {
            const caller = buildAuthCaller(db, redis);
            await (0, vitest_1.expect)(caller.register({ email: 'test@test.com', username: 'testuser', password: 'short' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject registration with password longer than 128 chars', async () => {
            const caller = buildAuthCaller(db, redis);
            await (0, vitest_1.expect)(caller.register({ email: 'test@test.com', username: 'testuser', password: 'A'.repeat(129) })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
        (0, vitest_1.it)('should reject registration when username contains invalid chars', async () => {
            const caller = buildAuthCaller(db, redis);
            await (0, vitest_1.expect)(caller.register({ email: 'test@test.com', username: 'user name!', password: PASSWORD_PLAINTEXT })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
        });
    });
    // =========================================================================
    // login
    // =========================================================================
    (0, vitest_1.describe)('auth.login', () => {
        (0, vitest_1.it)('should return tokens on valid credentials', async () => {
            db._pushSelect([makeUserRow()]);
            db._pushInsert([]);
            const caller = buildAuthCaller(db, redis);
            const result = await caller.login({
                email: 'test@lagrietahonduras.com',
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(result.user.id).toBe(USER_ID);
            (0, vitest_1.expect)(result.tokens.accessToken).toBeTruthy();
        });
        (0, vitest_1.it)('should reject login with wrong password', async () => {
            db._pushSelect([makeUserRow()]);
            const caller = buildAuthCaller(db, redis);
            await (0, vitest_1.expect)(caller.login({ email: 'test@lagrietahonduras.com', password: 'WrongPass!' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });
    });
    // =========================================================================
    // me (requires auth)
    // =========================================================================
    (0, vitest_1.describe)('auth.me', () => {
        (0, vitest_1.it)('should return user profile when authenticated', async () => {
            const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
            db._pushSelect([makeUserRow()]);
            const caller = buildAuthCaller(db, redis, `Bearer ${token}`);
            const result = await caller.me();
            (0, vitest_1.expect)(result.id).toBe(USER_ID);
            (0, vitest_1.expect)(result.email).toBe('test@lagrietahonduras.com');
        });
        (0, vitest_1.it)('should reject unauthenticated me() call', async () => {
            const caller = buildAuthCaller(db, redis); // no auth header
            await (0, vitest_1.expect)(caller.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });
    });
    // =========================================================================
    // logout
    // =========================================================================
    (0, vitest_1.describe)('auth.logout', () => {
        (0, vitest_1.it)('should blacklist the token after logout', async () => {
            const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
            const caller = buildAuthCaller(db, redis, `Bearer ${token}`);
            await caller.logout();
            // Token should now be in Redis blacklist store
            (0, vitest_1.expect)(redis._store.has(`blacklist:${token}`)).toBe(true);
        });
        (0, vitest_1.it)('should reject subsequent me() calls with blacklisted token', async () => {
            const token = jwt.sign({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
            // Logout — adds token to blacklist
            const callerForLogout = buildAuthCaller(db, redis, `Bearer ${token}`);
            await callerForLogout.logout();
            // Now try to call me() with the same blacklisted token
            db._pushSelect([makeUserRow()]); // would succeed if token was valid
            const callerForMe = buildAuthCaller(db, redis, `Bearer ${token}`);
            await (0, vitest_1.expect)(callerForMe.me()).rejects.toMatchObject({
                code: 'UNAUTHORIZED',
                message: 'Token has been revoked',
            });
        });
        (0, vitest_1.it)('should require auth to logout', async () => {
            const caller = buildAuthCaller(db, redis); // no token
            await (0, vitest_1.expect)(caller.logout()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
        });
    });
    // =========================================================================
    // Full flow: register → login → me → logout → verify rejected
    // =========================================================================
    (0, vitest_1.describe)('full auth flow', () => {
        (0, vitest_1.it)('should complete register → login → me → logout → verify token rejected', async () => {
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
            });
            (0, vitest_1.expect)(registerResult.user.id).toBe(USER_ID);
            const registeredToken = registerResult.tokens.accessToken;
            // STEP 2: Login with credentials
            const loginUser = { ...makeUserRow(), email: 'full@flow.com', username: 'fullflow' };
            db._pushSelect([loginUser]);
            db._pushInsert([]);
            const loginCaller = buildAuthCaller(db, redis);
            const loginResult = await loginCaller.login({
                email: 'full@flow.com',
                password: PASSWORD_PLAINTEXT,
            });
            (0, vitest_1.expect)(loginResult.user.id).toBe(USER_ID);
            const accessToken = loginResult.tokens.accessToken;
            // STEP 3: Call me() with the access token
            db._pushSelect([loginUser]);
            const meCaller = buildAuthCaller(db, redis, `Bearer ${accessToken}`);
            const meResult = await meCaller.me();
            (0, vitest_1.expect)(meResult.id).toBe(USER_ID);
            // STEP 4: Logout
            const logoutCaller = buildAuthCaller(db, redis, `Bearer ${accessToken}`);
            await logoutCaller.logout();
            (0, vitest_1.expect)(redis._store.has(`blacklist:${accessToken}`)).toBe(true);
            // STEP 5: Verify the token is rejected after logout
            const postLogoutCaller = buildAuthCaller(db, redis, `Bearer ${accessToken}`);
            await (0, vitest_1.expect)(postLogoutCaller.me()).rejects.toMatchObject({
                code: 'UNAUTHORIZED',
                message: 'Token has been revoked',
            });
        });
    });
});
