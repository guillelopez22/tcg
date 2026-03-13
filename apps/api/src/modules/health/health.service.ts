import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DbClient } from '@la-grieta/db';
import type { Redis } from 'ioredis';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  redis: 'ok' | 'error';
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly db: DbClient,
    private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthStatus> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allOk = dbStatus === 'ok' && redisStatus === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      database: dbStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<'ok' | 'error'> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<'ok' | 'error'> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }
}
