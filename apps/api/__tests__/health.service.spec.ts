import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from '../src/modules/health/health.service';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockDb(opts: { healthy: boolean }) {
  return {
    execute: opts.healthy
      ? vi.fn().mockResolvedValue([{ '?column?': 1 }])
      : vi.fn().mockRejectedValue(new Error('connection refused')),
  };
}

function makeMockRedis(opts: { healthy: boolean; pingResponse?: string }) {
  return {
    ping: opts.healthy
      ? vi.fn().mockResolvedValue(opts.pingResponse ?? 'PONG')
      : vi.fn().mockRejectedValue(new Error('redis connection refused')),
  };
}

// ---------------------------------------------------------------------------
// HealthService.check()
// ---------------------------------------------------------------------------

describe('HealthService', () => {
  describe('check() — happy paths', () => {
    it('should return status "ok" when both DB and Redis are healthy', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.status).toBe('ok');
    });

    it('should return database "ok" when DB SELECT 1 succeeds', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.database).toBe('ok');
    });

    it('should return redis "ok" when Redis PING returns PONG', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.redis).toBe('ok');
    });

    it('should include a valid ISO 8601 timestamp in the response', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.timestamp).toBeTruthy();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('check() — database failure', () => {
    it('should return status "degraded" when DB is down', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: false }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.status).toBe('degraded');
    });

    it('should return database "error" when DB throws', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: false }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.database).toBe('error');
    });

    it('should still report redis "ok" when only DB is down', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: false }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(result.redis).toBe('ok');
    });
  });

  describe('check() — Redis failure', () => {
    it('should return status "degraded" when Redis is down', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: false }) as never,
      );
      const result = await service.check();
      expect(result.status).toBe('degraded');
    });

    it('should return redis "error" when Redis throws', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: false }) as never,
      );
      const result = await service.check();
      expect(result.redis).toBe('error');
    });

    it('should still report database "ok" when only Redis is down', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: false }) as never,
      );
      const result = await service.check();
      expect(result.database).toBe('ok');
    });
  });

  describe('check() — both down', () => {
    it('should return status "degraded" when both DB and Redis are down', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: false }) as never,
        makeMockRedis({ healthy: false }) as never,
      );
      const result = await service.check();
      expect(result.status).toBe('degraded');
    });

    it('should return database "error" and redis "error" when both are down', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: false }) as never,
        makeMockRedis({ healthy: false }) as never,
      );
      const result = await service.check();
      expect(result.database).toBe('error');
      expect(result.redis).toBe('error');
    });
  });

  describe('check() — unexpected Redis PING response', () => {
    it('should return redis "error" when Redis PING returns unexpected value', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: true, pingResponse: 'OK' }) as never,
      );
      const result = await service.check();
      expect(result.redis).toBe('error');
    });
  });

  describe('check() — parallelism', () => {
    it('should call DB and Redis checks in parallel (both called even if one is slow)', async () => {
      let dbResolved = false;
      let redisResolved = false;

      const mockDb = {
        execute: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 10));
          dbResolved = true;
          return [{ '?column?': 1 }];
        }),
      };

      const mockRedis = {
        ping: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 5));
          redisResolved = true;
          return 'PONG';
        }),
      };

      const service = new HealthService(
        mockDb as never,
        mockRedis as never,
      );

      await service.check();

      expect(dbResolved).toBe(true);
      expect(redisResolved).toBe(true);
    });
  });

  describe('check() — response shape', () => {
    it('should return exactly the expected response keys', async () => {
      const service = new HealthService(
        makeMockDb({ healthy: true }) as never,
        makeMockRedis({ healthy: true }) as never,
      );
      const result = await service.check();
      expect(Object.keys(result).sort()).toEqual(
        ['database', 'redis', 'status', 'timestamp'].sort(),
      );
    });
  });
});
