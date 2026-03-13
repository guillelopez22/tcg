import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { DB_TOKEN, REDIS_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';
import type { Redis } from 'ioredis';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: HealthService,
      useFactory: (db: DbClient, redis: Redis) => new HealthService(db, redis),
      inject: [DB_TOKEN, REDIS_TOKEN],
    },
  ],
  exports: [HealthService],
})
export class HealthModule {}
