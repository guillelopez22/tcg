import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRouter } from './auth.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN, REDIS_TOKEN } from '../../core/core.module';
import { AuthConfig } from '../../config/auth.config';
import type { DbClient } from '@la-grieta/db';
import type { Redis } from 'ioredis';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    AuthConfig,
    {
      provide: AuthService,
      useFactory: (db: DbClient, redis: Redis, authConfig: AuthConfig) =>
        new AuthService(db, redis, authConfig),
      inject: [DB_TOKEN, REDIS_TOKEN, AuthConfig],
    },
    AuthRouter,
  ],
  exports: [AuthRouter, AuthService],
})
export class AuthModule {}
