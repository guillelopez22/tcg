import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CoreModule } from './core/core.module';
import { TrpcModule } from './trpc/trpc.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [ScheduleModule.forRoot(), CoreModule, TrpcModule, HealthModule],
})
export class AppModule {}
