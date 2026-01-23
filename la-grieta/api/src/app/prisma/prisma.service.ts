import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connection established');
        return;
      } catch (error) {
        this.logger.error(`Database connection attempt ${attempt} failed: ${error.message}`);

        if (attempt === maxRetries) {
          this.logger.error('Max retries reached. Database connection failed.');
          // Don't throw - allow app to start in degraded mode
          this.logger.warn('Application starting in DEGRADED MODE - database unavailable');
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
