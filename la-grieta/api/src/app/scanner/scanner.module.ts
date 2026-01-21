import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScannerController } from './scanner.controller';
import { ScannerService } from './scanner.service';
import { VisionService } from './vision.service';
import { CardMatcherService } from './card-matcher.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ScannerController],
  providers: [ScannerService, VisionService, CardMatcherService],
  exports: [ScannerService],
})
export class ScannerModule {}
