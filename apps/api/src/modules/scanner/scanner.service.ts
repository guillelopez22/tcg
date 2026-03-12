import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import type { DbClient } from '@la-grieta/db';
import { cards, sets } from '@la-grieta/db';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CardFingerprint {
  cardId: string;
  name: string;
  number: string | null;
  setName: string;
  imageSmall: string | null;
  /** 128×128 = 16 384 elements, zero-mean unit-variance normalised */
  buffer: Float32Array;
}

export interface ScannerMatch {
  cardId: string;
  name: string;
  number: string | null;
  setName: string;
  imageSmall: string | null;
  /** Raw NCC score (0-1). Only returned for matches that passed NCC_IDENTIFY_THRESHOLD. */
  score: number;
  /**
   * Normalized display percentage (0-100).
   * Formula: Math.round(((score - NCC_THRESHOLD) / (1 - NCC_THRESHOLD)) * 100)
   * where NCC_THRESHOLD = 0.3. Clamped to [0, 100].
   */
  displayPct: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const THUMB_SIZE = 128;
const PIXEL_COUNT = THUMB_SIZE * THUMB_SIZE; // 16 384
const BATCH_SIZE = 20;

/**
 * NCC base used in the display-percentage normalisation formula.
 * displayPct = Math.round(((score - NCC_DISPLAY_BASE) / (1 - NCC_DISPLAY_BASE)) * 100)
 */
const NCC_DISPLAY_BASE = 0.3;

/**
 * Minimum NCC score required for a card to be returned by identify().
 * Matches with score below this value are silently discarded.
 * Exported so tests can assert boundary behaviour without hardcoding.
 */
export const NCC_IDENTIFY_THRESHOLD = 0.93;

const TOP_K = 5;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalised Cross-Correlation for two zero-mean unit-variance vectors.
 * Since both vectors are pre-normalised this is just a dot product divided
 * by length (i.e. cosine similarity on z-scored signals).
 */
function ncc(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum / a.length;
}

/**
 * Run the sharp image pipeline shared by both reference loading and frame
 * processing:
 *   1. Resize to 128×128 (cover — keeps aspect, crops to square)
 *   2. Grayscale
 *   3. CLAHE for local contrast normalisation
 *   4. Normalise pixel range to 0–255 (sharp's built-in normalize())
 *   5. Extract raw pixel buffer
 *   6. Z-score: subtract mean, divide by std → Float32Array
 */
async function toFingerprint(input: Buffer | string): Promise<Float32Array> {
  const raw = await sharp(input)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover' })
    .grayscale()
    .clahe({ width: 16, height: 16, maxSlope: 3 })
    .normalize()
    .raw()
    .toBuffer();

  // raw is a Uint8 buffer of PIXEL_COUNT bytes (grayscale = 1 channel)
  const floats = new Float32Array(PIXEL_COUNT);

  // First pass: compute mean
  let mean = 0;
  for (let i = 0; i < PIXEL_COUNT; i++) {
    floats[i] = raw[i]!;
    mean += raw[i]!;
  }
  mean /= PIXEL_COUNT;

  // Second pass: compute std and zero-mean
  let variance = 0;
  for (let i = 0; i < PIXEL_COUNT; i++) {
    floats[i] = floats[i]! - mean;
    variance += floats[i]! * floats[i]!;
  }
  variance /= PIXEL_COUNT;
  const std = Math.sqrt(variance);

  // Avoid division by near-zero std (blank/uniform frame)
  if (std < 1e-6) {
    floats.fill(0);
    return floats;
  }

  for (let i = 0; i < PIXEL_COUNT; i++) {
    floats[i] = floats[i]! / std;
  }

  return floats;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ScannerService implements OnModuleInit {
  private readonly logger = new Logger(ScannerService.name);

  private readonly fingerprints: Map<string, CardFingerprint> = new Map();
  private ready = false;
  private loadProgress = { loaded: 0, total: 0 };

  constructor(private readonly db: DbClient) {}

  onModuleInit(): void {
    // Fire-and-forget — we don't want to block module initialisation
    void this.loadCardFingerprints();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async identify(frameBase64: string): Promise<ScannerMatch[]> {
    if (!this.ready) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Scanner is still loading card fingerprints. Try again shortly.',
      });
    }

    let frameBuffer: Buffer;
    try {
      frameBuffer = Buffer.from(frameBase64, 'base64');
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid base64 frame data' });
    }

    let frameFingerprint: Float32Array;
    try {
      frameFingerprint = await toFingerprint(frameBuffer);
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not process image frame' });
    }

    // Score all fingerprints and collect top-K above the identify threshold
    const results: ScannerMatch[] = [];

    for (const fp of this.fingerprints.values()) {
      const score = ncc(frameFingerprint, fp.buffer);
      if (score >= NCC_IDENTIFY_THRESHOLD) {
        const rawPct = Math.round(((score - NCC_DISPLAY_BASE) / (1 - NCC_DISPLAY_BASE)) * 100);
        const displayPct = Math.min(100, Math.max(0, rawPct));
        results.push({
          cardId: fp.cardId,
          name: fp.name,
          number: fp.number,
          setName: fp.setName,
          imageSmall: fp.imageSmall,
          score,
          displayPct,
        });
      }
    }

    // Sort descending by score, return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, TOP_K);
  }

  getStatus(): { ready: boolean; loaded: number; total: number } {
    return { ready: this.ready, ...this.loadProgress };
  }

  // ─── Fingerprint Loading ───────────────────────────────────────────────────

  private async loadCardFingerprints(): Promise<void> {
    this.logger.log('Scanner: starting card fingerprint load…');

    // Query all non-product cards that have a small image URL, joined with set name
    const rows = await this.db
      .select({
        id: cards.id,
        name: cards.name,
        number: cards.number,
        imageSmall: cards.imageSmall,
        setName: sets.name,
      })
      .from(cards)
      .innerJoin(sets, eq(cards.setId, sets.id))
      .where(eq(cards.isProduct, false));

    // Only process cards that actually have an imageSmall URL
    const candidates = rows.filter((r) => r.imageSmall !== null);

    this.loadProgress.total = candidates.length;
    this.logger.log(`Scanner: ${candidates.length} candidate cards found`);

    // Process in batches to avoid hammering the CDN
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (card) => {
          try {
            const imageBuffer = await this.downloadImage(card.imageSmall!);
            if (!imageBuffer) return;

            const fingerprint = await toFingerprint(imageBuffer);

            this.fingerprints.set(card.id, {
              cardId: card.id,
              name: card.name,
              number: card.number,
              setName: card.setName,
              imageSmall: card.imageSmall,
              buffer: fingerprint,
            });

            this.loadProgress.loaded++;

            if (this.loadProgress.loaded % 50 === 0) {
              this.logger.log(
                `Scanner: loaded ${this.loadProgress.loaded}/${this.loadProgress.total} card fingerprints`,
              );
            }
          } catch (err) {
            this.logger.warn(
              `Scanner: skipping card ${card.id} (${card.name}) — ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }),
      );
    }

    this.ready = true;
    this.logger.log(
      `Scanner: ready — ${this.loadProgress.loaded}/${this.loadProgress.total} fingerprints loaded`,
    );
  }

  /**
   * Download an image URL and return it as a Buffer.
   * Returns null on 403/404 or network errors so the caller can skip gracefully.
   */
  private async downloadImage(url: string): Promise<Buffer | null> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          // Some CDNs return 403 without a UA header
          'User-Agent': 'LaGrieta-Scanner/1.0',
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return null;
    }

    if (!response.ok) {
      // 403/404 are expected for delisted products — not worth logging as errors
      if (response.status !== 403 && response.status !== 404) {
        this.logger.warn(`Scanner: unexpected HTTP ${response.status} fetching ${url}`);
      }
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
