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
 * Tests for tRPC middleware: publicProcedure and protectedProcedure.
 *
 * Strategy: build a minimal tRPC router from TrpcService and use
 * router.createCaller(ctx) to exercise the real middleware chain without
 * a running HTTP server.
 */
const vitest_1 = require("vitest");
const jwt = __importStar(require("jsonwebtoken"));
const zod_1 = require("zod");
const trpc_service_1 = require("../src/trpc/trpc.service");
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TEST_JWT_SECRET = 'test-secret-min-32-chars-for-hs256';
const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function signToken(payload = { sub: USER_ID, role: 'user' }, secret = TEST_JWT_SECRET, options = { expiresIn: 900 }) {
    return jwt.sign(payload, secret, options);
}
function makeCtx(overrides = {}) {
    return {
        req: {
            headers: overrides.authHeader !== undefined
                ? { authorization: overrides.authHeader }
                : {},
            method: 'POST',
        },
        db: {},
        redis: {
            get: overrides.redisGet
                ? vitest_1.vi.fn().mockImplementation(overrides.redisGet)
                : vitest_1.vi.fn().mockResolvedValue(null),
        },
    };
}
/**
 * Build a minimal router with a single `probe` query using the given procedure
 * and return a caller bound to the given context.
 */
function buildCaller(getProcedure, ctx) {
    const svc = new trpc_service_1.TrpcService();
    const procedure = getProcedure(svc);
    const router = svc.router({
        probe: procedure.output(zod_1.z.string()).query(() => 'ok'),
    });
    // tRPC v11: router.createCaller(ctx) returns a typed caller
    return router.createCaller(ctx);
}
// ---------------------------------------------------------------------------
// publicProcedure
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('publicProcedure', () => {
    (0, vitest_1.beforeEach)(() => {
        process.env['JWT_SECRET'] = TEST_JWT_SECRET;
    });
    (0, vitest_1.afterEach)(() => {
        delete process.env['JWT_SECRET'];
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('should execute handler with no auth header', async () => {
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());
        const result = await caller.probe();
        (0, vitest_1.expect)(result).toBe('ok');
    });
    (0, vitest_1.it)('should execute handler when a valid Bearer token is present', async () => {
        const token = signToken();
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        const result = await caller.probe();
        (0, vitest_1.expect)(result).toBe('ok');
    });
    (0, vitest_1.it)('should execute handler when authorization header is an empty string', async () => {
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx({ authHeader: '' }));
        const result = await caller.probe();
        (0, vitest_1.expect)(result).toBe('ok');
    });
    (0, vitest_1.it)('should log the procedure call via console.log', async () => {
        const logSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());
        await caller.probe();
        (0, vitest_1.expect)(logSpy).toHaveBeenCalled();
        const logMsg = logSpy.mock.calls[0][0];
        (0, vitest_1.expect)(logMsg).toMatch(/\[tRPC\]/);
    });
    (0, vitest_1.it)('should log the procedure path in the log message', async () => {
        const logSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());
        await caller.probe();
        const logMsg = logSpy.mock.calls[0][0];
        (0, vitest_1.expect)(logMsg).toMatch(/probe/);
    });
    (0, vitest_1.it)('should log "ok" status when handler succeeds', async () => {
        const logSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());
        await caller.probe();
        const logMsg = logSpy.mock.calls[0][0];
        (0, vitest_1.expect)(logMsg).toMatch(/ok/);
    });
    (0, vitest_1.it)('should log duration in milliseconds', async () => {
        const logSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        const caller = buildCaller((svc) => svc.publicProcedure, makeCtx());
        await caller.probe();
        const logMsg = logSpy.mock.calls[0][0];
        (0, vitest_1.expect)(logMsg).toMatch(/\d+ms/);
    });
});
// ---------------------------------------------------------------------------
// protectedProcedure
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('protectedProcedure', () => {
    (0, vitest_1.beforeEach)(() => {
        process.env['JWT_SECRET'] = TEST_JWT_SECRET;
    });
    (0, vitest_1.afterEach)(() => {
        delete process.env['JWT_SECRET'];
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('should execute handler when valid JWT is provided', async () => {
        const token = signToken();
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        const result = await caller.probe();
        (0, vitest_1.expect)(result).toBe('ok');
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when authorization header is absent', async () => {
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx());
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
            message: 'Missing access token',
        });
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when authorization header is an empty string', async () => {
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: '' }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
            message: 'Missing access token',
        });
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when JWT is signed with a wrong secret', async () => {
        const token = signToken({ sub: USER_ID, role: 'user' }, 'completely-wrong-secret-here');
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired access token',
        });
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when JWT is expired', async () => {
        const token = signToken({ sub: USER_ID, role: 'user' }, TEST_JWT_SECRET, { expiresIn: -1 });
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired access token',
        });
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when JWT is malformed', async () => {
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: 'Bearer not.a.real.jwt' }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when token is blacklisted in Redis', async () => {
        const token = signToken();
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}`, redisGet: async () => '1' }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({
            code: 'UNAUTHORIZED',
            message: 'Token has been revoked',
        });
    });
    (0, vitest_1.it)('should check Redis with correct key format "blacklist:{token}"', async () => {
        const token = signToken();
        const mockGet = vitest_1.vi.fn().mockResolvedValue(null);
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}`, redisGet: mockGet }));
        await caller.probe();
        (0, vitest_1.expect)(mockGet).toHaveBeenCalledWith(`blacklist:${token}`);
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when JWT payload sub is not a UUID', async () => {
        const token = jwt.sign({ sub: 'not-a-uuid', role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
    (0, vitest_1.it)('should throw UNAUTHORIZED when JWT payload is missing sub claim', async () => {
        const token = jwt.sign({ role: 'user' }, TEST_JWT_SECRET, { expiresIn: 900 });
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });
    (0, vitest_1.it)('should allow user role tokens through', async () => {
        const token = signToken({ sub: USER_ID, role: 'user' });
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        const result = await caller.probe();
        (0, vitest_1.expect)(result).toBe('ok');
    });
    (0, vitest_1.it)('should allow admin role tokens through', async () => {
        const token = signToken({ sub: USER_ID, role: 'admin' });
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        const result = await caller.probe();
        (0, vitest_1.expect)(result).toBe('ok');
    });
    (0, vitest_1.it)('should throw INTERNAL_SERVER_ERROR when JWT_SECRET env var is missing', async () => {
        delete process.env['JWT_SECRET'];
        const token = signToken();
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx({ authHeader: `Bearer ${token}` }));
        await (0, vitest_1.expect)(caller.probe()).rejects.toMatchObject({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Server configuration error',
        });
    });
    (0, vitest_1.it)('should log "error" status when auth fails', async () => {
        const logSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => { });
        const caller = buildCaller((svc) => svc.protectedProcedure, makeCtx()); // no token
        try {
            await caller.probe();
        }
        catch { /* expected */ }
        (0, vitest_1.expect)(logSpy).toHaveBeenCalled();
        const logMsg = logSpy.mock.calls[0][0];
        (0, vitest_1.expect)(logMsg).toMatch(/error/);
    });
});
