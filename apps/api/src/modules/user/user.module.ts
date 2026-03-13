import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRouter } from './user.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: UserService,
      useFactory: (db: DbClient) => new UserService(db),
      inject: [DB_TOKEN],
    },
    UserRouter,
  ],
  exports: [UserRouter, UserService],
})
export class UserModule {}
