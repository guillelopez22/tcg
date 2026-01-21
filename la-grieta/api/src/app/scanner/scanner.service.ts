import { Injectable, Logger } from '@nestjs/common';
import { VisionService } from './vision.service';
import { CardMatcherService } from './card-matcher.service';
import { ScanImageDto } from './dto/scan-image.dto';
import {
  ScanResultDto,
  ScanBulkResponseDto,
  ScannerStatusDto,
} from './dto/scan-response.dto';

@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);

  constructor(
    private visionService: VisionService,
    private cardMatcherService: CardMatcherService
  ) {}

  async scanSingleImage(dto: ScanImageDto): Promise<ScanResultDto> {
    try {
      this.logger.log('Processing single image scan');

      // Extract text from image using Vision API
      const visionResult = await this.visionService.extractText(dto.image, dto.mimeType);

      if (!visionResult.extractedText || visionResult.extractedText.length === 0) {
        this.logger.warn('No text extracted from image');
        return {
          success: false,
          error: 'NO_TEXT_DETECTED',
          extractedText: [],
        };
      }

      // Find card matches
      const matches = await this.cardMatcherService.findMatches(
        visionResult.extractedText,
        visionResult.fullText
      );

      if (matches.length === 0) {
        this.logger.warn('No card matches found');
        return {
          success: false,
          error: 'NO_MATCH',
          extractedText: visionResult.extractedText,
        };
      }

      // Sort by confidence
      const sortedMatches = matches.sort((a, b) => b.confidence - a.confidence);
      const bestMatch = sortedMatches[0];
      const alternatives = sortedMatches.slice(1, 4); // Top 3 alternatives

      this.logger.log(
        `Found match: ${bestMatch.card.name} (confidence: ${bestMatch.confidence})`
      );

      return {
        success: true,
        match: bestMatch,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
        extractedText: visionResult.extractedText,
      };
    } catch (error) {
      this.logger.error('Error scanning image:', error.message);
      return {
        success: false,
        error: error.message || 'SCAN_ERROR',
      };
    }
  }

  async scanBulkImages(images: ScanImageDto[]): Promise<ScanBulkResponseDto> {
    this.logger.log(`Processing bulk scan of ${images.length} images`);

    const results: ScanResultDto[] = [];

    // Process images sequentially to avoid overwhelming the API
    // In production, consider parallel processing with rate limiting
    for (const image of images) {
      const result = await this.scanSingleImage(image);
      results.push(result);
    }

    const summary = {
      total: results.length,
      matched: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };

    this.logger.log(`Bulk scan complete: ${summary.matched}/${summary.total} matched`);

    return {
      results,
      summary,
    };
  }

  getStatus(): ScannerStatusDto {
    const isMock = this.visionService.isMockMode();
    const quotaRemaining = this.visionService.getQuotaRemaining();

    return {
      available: true,
      mode: isMock ? 'MOCK' : 'LIVE',
      quotaRemaining: quotaRemaining !== null ? quotaRemaining : undefined,
    };
  }
}
