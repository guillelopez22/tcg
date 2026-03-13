"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const health_service_1 = require("../src/modules/health/health.service");
// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
function makeMockDb(opts) {
    return {
        execute: opts.healthy
            ? vitest_1.vi.fn().mockResolvedValue([{ '?column?': 1 }])
            : vitest_1.vi.fn().mockRejectedValue(new Error('connection refused')),
    };
}
function makeMockRedis(opts) {
    return {
        ping: opts.healthy
            ? vitest_1.vi.fn().mockResolvedValue(opts.pingResponse ?? 'PONG')
            : vitest_1.vi.fn().mockRejectedValue(new Error('redis connection refused')),
    };
}
// ---------------------------------------------------------------------------
// HealthService.check()
// ---------------------------------------------------------------------------
(0, vitest_1.describe)('HealthService', () => {
    (0, vitest_1.describe)('check() — happy paths', () => {
        (0, vitest_1.it)('should return status "ok" when both DB and Redis are healthy', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.status).toBe('ok');
        });
        (0, vitest_1.it)('should return database "ok" when DB SELECT 1 succeeds', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.database).toBe('ok');
        });
        (0, vitest_1.it)('should return redis "ok" when Redis PING returns PONG', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.redis).toBe('ok');
        });
        (0, vitest_1.it)('should include a valid ISO 8601 timestamp in the response', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.timestamp).toBeTruthy();
            (0, vitest_1.expect)(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
        });
    });
    (0, vitest_1.describe)('check() — database failure', () => {
        (0, vitest_1.it)('should return status "degraded" when DB is down', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: false }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.status).toBe('degraded');
        });
        (0, vitest_1.it)('should return database "error" when DB throws', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: false }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.database).toBe('error');
        });
        (0, vitest_1.it)('should still report redis "ok" when only DB is down', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: false }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(result.redis).toBe('ok');
        });
    });
    (0, vitest_1.describe)('check() — Redis failure', () => {
        (0, vitest_1.it)('should return status "degraded" when Redis is down', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: false }));
            const result = await service.check();
            (0, vitest_1.expect)(result.status).toBe('degraded');
        });
        (0, vitest_1.it)('should return redis "error" when Redis throws', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: false }));
            const result = await service.check();
            (0, vitest_1.expect)(result.redis).toBe('error');
        });
        (0, vitest_1.it)('should still report database "ok" when only Redis is down', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: false }));
            const result = await service.check();
            (0, vitest_1.expect)(result.database).toBe('ok');
        });
    });
    (0, vitest_1.describe)('check() — both down', () => {
        (0, vitest_1.it)('should return status "degraded" when both DB and Redis are down', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: false }), makeMockRedis({ healthy: false }));
            const result = await service.check();
            (0, vitest_1.expect)(result.status).toBe('degraded');
        });
        (0, vitest_1.it)('should return database "error" and redis "error" when both are down', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: false }), makeMockRedis({ healthy: false }));
            const result = await service.check();
            (0, vitest_1.expect)(result.database).toBe('error');
            (0, vitest_1.expect)(result.redis).toBe('error');
        });
    });
    (0, vitest_1.describe)('check() — unexpected Redis PING response', () => {
        (0, vitest_1.it)('should return redis "error" when Redis PING returns unexpected value', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: true, pingResponse: 'OK' }));
            const result = await service.check();
            (0, vitest_1.expect)(result.redis).toBe('error');
        });
    });
    (0, vitest_1.describe)('check() — parallelism', () => {
        (0, vitest_1.it)('should call DB and Redis checks in parallel (both called even if one is slow)', async () => {
            let dbResolved = false;
            let redisResolved = false;
            const mockDb = {
                execute: vitest_1.vi.fn(async () => {
                    await new Promise((r) => setTimeout(r, 10));
                    dbResolved = true;
                    return [{ '?column?': 1 }];
                }),
            };
            const mockRedis = {
                ping: vitest_1.vi.fn(async () => {
                    await new Promise((r) => setTimeout(r, 5));
                    redisResolved = true;
                    return 'PONG';
                }),
            };
            const service = new health_service_1.HealthService(mockDb, mockRedis);
            await service.check();
            (0, vitest_1.expect)(dbResolved).toBe(true);
            (0, vitest_1.expect)(redisResolved).toBe(true);
        });
    });
    (0, vitest_1.describe)('check() — response shape', () => {
        (0, vitest_1.it)('should return exactly the expected response keys', async () => {
            const service = new health_service_1.HealthService(makeMockDb({ healthy: true }), makeMockRedis({ healthy: true }));
            const result = await service.check();
            (0, vitest_1.expect)(Object.keys(result).sort()).toEqual(['database', 'redis', 'status', 'timestamp'].sort());
        });
    });
});
