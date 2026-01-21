import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface VisionResult {
  extractedText: string[];
  fullText: string;
}

@Injectable()
export class VisionService {
  private readonly logger = new Logger(VisionService.name);
  private readonly apiKey: string;
  private readonly mockMode: boolean;
  private readonly maxImageSizeMB: number;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_CLOUD_VISION_API_KEY', '');
    this.mockMode = this.configService.get<string>('SCANNER_MOCK_MODE', 'true') === 'true';
    this.maxImageSizeMB = parseInt(
      this.configService.get<string>('SCANNER_MAX_IMAGE_SIZE_MB', '10'),
      10
    );

    if (this.mockMode) {
      this.logger.warn('Vision Service running in MOCK MODE');
    } else if (!this.apiKey) {
      this.logger.warn('Google Cloud Vision API key not found, falling back to MOCK MODE');
      this.mockMode = true;
    }
  }

  async extractText(base64Image: string, mimeType: string): Promise<VisionResult> {
    // Validate image size
    this.validateImageSize(base64Image);

    if (this.mockMode) {
      return this.mockExtractText();
    }

    return this.extractTextFromVisionAPI(base64Image, mimeType);
  }

  private validateImageSize(base64Image: string): void {
    // Calculate approximate size in MB
    const sizeInBytes = (base64Image.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > this.maxImageSizeMB) {
      throw new BadRequestException(
        `Image size ${sizeInMB.toFixed(2)}MB exceeds maximum allowed size of ${this.maxImageSizeMB}MB`
      );
    }
  }

  private async extractTextFromVisionAPI(
    base64Image: string,
    mimeType: string
  ): Promise<VisionResult> {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`;

    try {
      const response = await axios.post(
        url,
        {
          requests: [
            {
              image: {
                content: base64Image,
              },
              features: [
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 50,
                },
              ],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const annotations = response.data.responses[0];

      if (!annotations || !annotations.textAnnotations) {
        this.logger.warn('No text detected in image');
        return {
          extractedText: [],
          fullText: '',
        };
      }

      // First annotation contains full text
      const fullText = annotations.textAnnotations[0]?.description || '';

      // Extract individual text blocks
      const extractedText = annotations.textAnnotations
        .slice(1) // Skip first element (full text)
        .map((annotation: any) => annotation.description)
        .filter((text: string) => text && text.trim().length > 0);

      this.logger.log(`Extracted ${extractedText.length} text blocks from image`);

      return {
        extractedText,
        fullText,
      };
    } catch (error) {
      this.logger.error('Error calling Google Cloud Vision API:', error.message);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new BadRequestException('Invalid Google Cloud Vision API key');
        }
        if (error.response?.status === 429) {
          throw new BadRequestException('Google Cloud Vision API quota exceeded');
        }
      }

      throw new BadRequestException('Failed to process image with Vision API');
    }
  }

  private async mockExtractText(): Promise<VisionResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

    // Mock card data that might be extracted from an image
    const mockCardTexts = [
      // Armed Assailant
      {
        extractedText: ['Armed', 'Assailant', 'SFD', '002', 'Common', 'Fury', 'Quick'],
        fullText: 'Armed Assailant\nSFD 002/250\nCommon\nFury\nQuick',
      },
      // Darius
      {
        extractedText: ['Darius', 'SFD', '001', 'Legendary', 'Fury', 'Body'],
        fullText: 'Darius\nSFD 001/250\nLegendary\nFury Body',
      },
      // Demacian Banner
      {
        extractedText: ['Demacian', 'Banner', 'SFD', '120', 'Common', 'Order'],
        fullText: 'Demacian Banner\nSFD 120/250\nCommon\nOrder',
      },
      // Mystic Shot
      {
        extractedText: ['Mystic', 'Shot', 'SFD', '045', 'Common', 'Mind'],
        fullText: 'Mystic Shot\nSFD 045/250\nCommon\nMind',
      },
      // The Great Battlefield
      {
        extractedText: ['The', 'Great', 'Battlefield', 'SFD', '200', 'Rare'],
        fullText: 'The Great Battlefield\nSFD 200/250\nRare',
      },
    ];

    const randomIndex = Math.floor(Math.random() * mockCardTexts.length);
    const mockData = mockCardTexts[randomIndex];

    this.logger.debug(`Mock OCR: Returning text for card ${randomIndex + 1}`);

    return mockData;
  }

  isMockMode(): boolean {
    return this.mockMode;
  }

  getQuotaRemaining(): number | null {
    // In a real implementation, this would track API usage
    // For now, return null in mock mode or a static value
    if (this.mockMode) {
      return null;
    }
    return 1000; // Mock quota
  }
}
