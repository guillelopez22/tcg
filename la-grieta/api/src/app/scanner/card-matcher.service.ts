import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Card } from '@la-grieta/shared';
import { CardMatch, MatchType } from './dto/scan-response.dto';

interface ParsedCardInfo {
  cardName?: string;
  setCode?: string;
  collectorNumber?: string;
  keywords?: string[];
}

@Injectable()
export class CardMatcherService {
  private readonly logger = new Logger(CardMatcherService.name);

  constructor(private prisma: PrismaService) {}

  async findMatches(extractedText: string[], fullText: string): Promise<CardMatch[]> {
    const parsedInfo = this.parseCardInfo(extractedText, fullText);
    this.logger.debug(`Parsed card info: ${JSON.stringify(parsedInfo)}`);

    const matches: CardMatch[] = [];

    // Try exact match first (set code + collector number)
    if (parsedInfo.setCode && parsedInfo.collectorNumber) {
      const exactMatch = await this.findExactMatch(
        parsedInfo.setCode,
        parsedInfo.collectorNumber
      );
      if (exactMatch) {
        matches.push(exactMatch);
        return matches; // Return immediately for exact matches
      }
    }

    // Try fuzzy name match
    if (parsedInfo.cardName) {
      const fuzzyMatches = await this.findFuzzyMatches(parsedInfo.cardName);
      matches.push(...fuzzyMatches);
    }

    // If we have set code but no collector number, search within that set
    if (parsedInfo.setCode && !parsedInfo.collectorNumber && matches.length === 0) {
      const setMatches = await this.findBySetCode(parsedInfo.setCode);
      matches.push(...setMatches);
    }

    return matches;
  }

  private parseCardInfo(extractedText: string[], fullText: string): ParsedCardInfo {
    const info: ParsedCardInfo = {
      keywords: [],
    };

    // Common TCG set codes pattern (e.g., "SFD", "BASE", "EXP1")
    const setCodePattern = /\b([A-Z]{2,4})\b/;

    // Collector number patterns (e.g., "001", "123/250", "#045")
    const collectorNumberPattern = /\b(\d{1,3})(?:\/\d{1,3})?\b/;

    const combinedText = extractedText.join(' ');

    // Extract set code
    const setCodeMatch = combinedText.match(setCodePattern);
    if (setCodeMatch) {
      info.setCode = setCodeMatch[1];
    }

    // Extract collector number
    const collectorMatch = combinedText.match(collectorNumberPattern);
    if (collectorMatch) {
      // Normalize to 3 digits with leading zeros
      const number = collectorMatch[1];
      info.collectorNumber = number.padStart(3, '0');
    }

    // Try to extract card name from full text
    // Assume first line or first few words before set info is the card name
    const lines = fullText.split('\n').filter((line) => line.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Remove set code and collector number from name
      const cleanName = firstLine
        .replace(setCodePattern, '')
        .replace(collectorNumberPattern, '')
        .trim();

      if (cleanName.length > 2) {
        info.cardName = cleanName;
      }
    }

    // Extract common keywords
    const commonKeywords = [
      'Quick',
      'Guard',
      'Overwhelm',
      'Elusive',
      'Fearsome',
      'Lifesteal',
      'Challenger',
    ];
    info.keywords = extractedText.filter((text) =>
      commonKeywords.some((keyword) => text.toLowerCase() === keyword.toLowerCase())
    );

    return info;
  }

  private async findExactMatch(
    setCode: string,
    collectorNumber: string
  ): Promise<CardMatch | null> {
    this.logger.debug(`Searching for exact match: ${setCode} ${collectorNumber}`);

    const card = await this.prisma.card.findFirst({
      where: {
        setCode: {
          equals: setCode,
          mode: 'insensitive',
        },
        collectorNumber: {
          equals: collectorNumber,
          mode: 'insensitive',
        },
      },
    });

    if (card) {
      this.logger.log(`Found exact match: ${card.name} (${setCode} ${collectorNumber})`);
      return {
        card: card as unknown as Card,
        confidence: 1.0,
        matchType: 'EXACT',
      };
    }

    return null;
  }

  private async findFuzzyMatches(searchName: string): Promise<CardMatch[]> {
    this.logger.debug(`Searching for fuzzy matches: ${searchName}`);

    // Get all cards to compute similarity
    const allCards = await this.prisma.card.findMany();

    if (allCards.length === 0) {
      return [];
    }

    // Calculate Levenshtein distance for each card
    const scoredCards = allCards.map((card) => ({
      card,
      distance: this.levenshteinDistance(
        searchName.toLowerCase(),
        card.name.toLowerCase()
      ),
      similarity: this.calculateSimilarity(searchName.toLowerCase(), card.name.toLowerCase()),
    }));

    // Filter and sort by similarity
    const matches = scoredCards
      .filter((item) => item.similarity >= 0.6) // At least 60% similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // Top 5 matches
      .map((item) => ({
        card: item.card as unknown as Card,
        confidence: item.similarity,
        matchType: (item.similarity >= 0.9 ? 'FUZZY' : 'PARTIAL') as MatchType,
      }));

    this.logger.debug(`Found ${matches.length} fuzzy matches for "${searchName}"`);

    return matches;
  }

  private async findBySetCode(setCode: string): Promise<CardMatch[]> {
    this.logger.debug(`Searching within set: ${setCode}`);

    const cards = await this.prisma.card.findMany({
      where: {
        setCode: {
          equals: setCode,
          mode: 'insensitive',
        },
      },
      take: 5,
    });

    return cards.map((card) => ({
      card: card as unknown as Card,
      confidence: 0.5,
      matchType: 'PARTIAL' as MatchType,
    }));
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Lower distance = more similar
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate similarity score (0-1) based on Levenshtein distance
   * Higher score = more similar
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) {
      return 1.0;
    }

    return 1 - distance / maxLength;
  }
}
