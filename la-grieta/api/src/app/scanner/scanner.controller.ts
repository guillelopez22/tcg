import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScannerService } from './scanner.service';
import { ScanImageDto } from './dto/scan-image.dto';
import { ScanBulkDto } from './dto/scan-bulk.dto';
import {
  ScanResultDto,
  ScanBulkResponseDto,
  ScannerStatusDto,
} from './dto/scan-response.dto';

@Controller('api/scanner')
@UseGuards(JwtAuthGuard)
export class ScannerController {
  private readonly logger = new Logger(ScannerController.name);

  // Simple in-memory rate limiting (per-user)
  // In production, use Redis or a proper rate limiting library
  private readonly rateLimitMap = new Map<string, number[]>();
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 10;

  constructor(private readonly scannerService: ScannerService) {}

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async scanSingleImage(@Body() dto: ScanImageDto): Promise<ScanResultDto> {
    this.logger.log('POST /api/scanner/scan');

    // Rate limiting check
    this.checkRateLimit('scan');

    // Validate base64 image
    if (!this.isValidBase64(dto.image)) {
      throw new BadRequestException('Invalid base64 image data');
    }

    return this.scannerService.scanSingleImage(dto);
  }

  @Post('scan-bulk')
  @HttpCode(HttpStatus.OK)
  async scanBulkImages(@Body() dto: ScanBulkDto): Promise<ScanBulkResponseDto> {
    this.logger.log(`POST /api/scanner/scan-bulk (${dto.images.length} images)`);

    // Rate limiting check (count as multiple requests)
    this.checkRateLimit('scan-bulk', dto.images.length);

    // Validate each image
    for (const image of dto.images) {
      if (!this.isValidBase64(image.image)) {
        throw new BadRequestException('Invalid base64 image data in bulk request');
      }
    }

    return this.scannerService.scanBulkImages(dto.images);
  }

  @Get('status')
  getStatus(): ScannerStatusDto {
    this.logger.log('GET /api/scanner/status');
    return this.scannerService.getStatus();
  }

  /**
   * Simple rate limiting implementation
   * In production, use a proper library like @nestjs/throttler
   */
  private checkRateLimit(endpoint: string, count = 1): void {
    const now = Date.now();
    const key = `${endpoint}`; // In production, use user ID from request

    if (!this.rateLimitMap.has(key)) {
      this.rateLimitMap.set(key, []);
    }

    const timestamps = this.rateLimitMap.get(key)!;

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(
      (timestamp) => now - timestamp < this.RATE_LIMIT_WINDOW_MS
    );

    // Check if adding new requests would exceed limit
    if (validTimestamps.length + count > this.RATE_LIMIT_MAX_REQUESTS) {
      const oldestTimestamp = validTimestamps[0];
      const resetTime = Math.ceil(
        (oldestTimestamp + this.RATE_LIMIT_WINDOW_MS - now) / 1000
      );

      throw new BadRequestException(
        `Rate limit exceeded. Try again in ${resetTime} seconds.`
      );
    }

    // Add new timestamps
    for (let i = 0; i < count; i++) {
      validTimestamps.push(now);
    }

    this.rateLimitMap.set(key, validTimestamps);
  }

  /**
   * Validate base64 string
   */
  private isValidBase64(str: string): boolean {
    if (!str || str.trim().length === 0) {
      return false;
    }

    // Remove data URI prefix if present
    const base64Data = str.replace(/^data:image\/[a-z]+;base64,/, '');

    // Check if valid base64
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(base64Data)) {
      return false;
    }

    // Check minimum length (at least 100 bytes for a valid image)
    if (base64Data.length < 100) {
      return false;
    }

    return true;
  }
}
