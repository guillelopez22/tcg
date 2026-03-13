import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';

/**
 * Provides only TrpcService so feature modules can depend on it
 * without creating a circular dependency with TrpcModule.
 */
@Module({
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcCoreModule {}
