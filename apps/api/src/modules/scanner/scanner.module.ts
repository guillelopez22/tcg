import { Module } from '@nestjs/common';
import { ScannerService } from './scanner.service';
import { ScannerRouter } from './scanner.router';
import { TrpcCoreModule } from '../../trpc/trpc-core.module';
import { DB_TOKEN } from '../../core/core.module';
import type { DbClient } from '@la-grieta/db';

@Module({
  imports: [TrpcCoreModule],
  providers: [
    {
      provide: ScannerService,
      useFactory: (db: DbClient) => new ScannerService(db),
      inject: [DB_TOKEN],
    },
    ScannerRouter,
  ],
  exports: [ScannerRouter, ScannerService],
})
export class ScannerModule {}
