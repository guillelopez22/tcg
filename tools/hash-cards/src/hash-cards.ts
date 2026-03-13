/**
 * Perceptual hash + color histogram pre-computation for Riftbound TCG card images.
 *
 * Reads card data directly from riftbound-tcg-data/ (no DB connection needed),
 * downloads each card's imageSmall via the TCGPlayer CDN, computes multiple
 * matching signals, and writes the results to apps/web/public/card-hashes.json.
 *
 * Signals computed per card:
 *   - aHash (8x8 average hash) — 16 hex chars
 *   - pHash (DCT-based perceptual hash) — 16 hex chars
 *   - dHash (difference/gradient hash) — 16 hex chars
 *   - colorHist — quantized HSL color histogram (24 bins), compact number array
 *
 * The color histogram is the primary matching signal for camera-to-reference
 * comparison because it captures color distribution regardless of position,
 * making it robust to angle changes, partial occlusion, and lighting shifts.
 *
 * Usage:
 *   pnpm --filter @la-grieta/hash-cards start
 *
 * Optional env vars:
 *   DELAY_MS      — ms between image downloads (default: 100)
 *   CONCURRENCY   — parallel downloads at once (default: 5)
 *   OUTPUT_PATH   — override output file path
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawSet {
  id: string;
  name: string;
}

interface RawCard {
  id: string;
  name: string;
  cleanName: string;
  rarity: string | null;
  images: {
    small: string;
    large: string;
  };
}

interface CardHashEntry {
  /** Matches externalId in the DB cards table */
  id: string;
  name: string;
  /** 16-char hex — average hash (8x8 grid) */
  ahash: string;
  /** 16-char hex — perceptual hash via DCT (32x32 -> 8x8 DCT coefficients) */
  phash: string;
  /** 16-char hex — difference hash (horizontal gradient) */
  dhash: string;
  /** Quantized HSL color histogram — 24 numbers (8 hue + 8 sat + 8 lum bins), each 0-1 normalized */
  colorHist: number[];
  /** 32x32 grayscale thumbnail as base64-encoded raw pixels (1024 bytes) */
  thumb32: string;
}

interface OutputFile {
  version: number;
  generatedAt: string;
  totalCards: number;
  cards: CardHashEntry[];
}

// ---------------------------------------------------------------------------
// Hash implementations
// ---------------------------------------------------------------------------

/**
 * Average hash (aHash).
 *
 * 1. Resize to 8x8 grayscale.
 * 2. Compute mean of all 64 pixels.
 * 3. Bit i = 1 if pixel[i] >= mean, else 0.
 * 4. Pack 64 bits -> 16 hex chars.
 */
function computeAHash(pixels: Uint8Array): string {
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    sum += pixels[i] as number;
  }
  const mean = sum / 64;

  let hash = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if ((pixels[i] as number) >= mean) {
      hash |= BigInt(1) << BigInt(63 - i);
    }
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * Difference hash (dHash).
 *
 * More robust than aHash because it captures relative gradients rather than
 * absolute brightness. Uses 9x8 grayscale image (9 wide, 8 tall) to compute
 * 8x8 = 64 horizontal gradient bits.
 *
 * Bit i = 1 if pixel[row][col] < pixel[row][col+1], else 0.
 */
function computeDHash(pixels: Uint8Array): string {
  // pixels is 9x8 = 72 values, row-major
  let hash = BigInt(0);
  let bitIdx = 0;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col] as number;
      const right = pixels[row * 9 + col + 1] as number;
      if (left < right) {
        hash |= BigInt(1) << BigInt(63 - bitIdx);
      }
      bitIdx++;
    }
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * 1-D DCT-II of an array of length N.
 */
function dct1d(input: number[]): number[] {
  const N = input.length;
  const output: number[] = new Array(N) as number[];
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += (input[n] as number) * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N));
    }
    const scale = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    output[k] = scale * sum;
  }
  return output;
}

/**
 * 2-D DCT-II via row-column separability.
 */
function dct2d(pixels: Uint8Array, size: number): number[][] {
  const matrix: number[][] = [];
  for (let r = 0; r < size; r++) {
    matrix.push(Array.from(pixels.slice(r * size, (r + 1) * size)));
  }

  const rowDct: number[][] = matrix.map((row) => dct1d(row));

  const transposed: number[][] = [];
  for (let c = 0; c < size; c++) {
    transposed.push(rowDct.map((row) => row[c] as number));
  }
  const colDct: number[][] = transposed.map((col) => dct1d(col));

  const result: number[][] = [];
  for (let r = 0; r < size; r++) {
    result.push(colDct.map((col) => col[r] as number));
  }
  return result;
}

/**
 * Perceptual hash (pHash).
 */
function computePHash(pixels: Uint8Array): string {
  const DCT_SIZE = 32;
  const HASH_SIZE = 8;

  const dctMatrix = dct2d(pixels, DCT_SIZE);

  const lowFreq: number[] = [];
  for (let r = 0; r < HASH_SIZE; r++) {
    for (let c = 0; c < HASH_SIZE; c++) {
      lowFreq.push(dctMatrix[r]![c]!);
    }
  }

  const sorted = [...lowFreq].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1]! + sorted[mid]!) / 2)
      : sorted[mid]!;

  let hash = BigInt(0);
  for (let i = 0; i < 64; i++) {
    if (lowFreq[i]! > median) {
      hash |= BigInt(1) << BigInt(63 - i);
    }
  }

  return hash.toString(16).padStart(16, '0');
}

// ---------------------------------------------------------------------------
// Color histogram
// ---------------------------------------------------------------------------

/**
 * RGB -> HSL conversion. Returns [h, s, l] each in 0..1 range.
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) {
    return [0, 0, l];
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) / 6;
  } else {
    h = ((rn - gn) / d + 4) / 6;
  }

  return [h, s, l];
}

/**
 * Compute a compact HSL color histogram from RGB pixel data.
 *
 * Uses a 64x64 center crop of the image (to reduce border influence) and
 * builds a 24-bin histogram: 8 hue bins + 8 saturation bins + 8 lightness bins.
 *
 * Each bin is normalized to sum to 1 within its channel (hue sums to 1,
 * sat sums to 1, lum sums to 1), then quantized to 3 decimal places.
 *
 * This approach is:
 *   - Position-independent (robust to angle/rotation)
 *   - Relatively robust to uniform lighting changes (saturation/lightness
 *     bins shift but hue bins stay stable)
 *   - Very compact (24 numbers per card)
 *   - Fast to compare (cosine similarity or chi-squared on 24 values)
 */
function computeColorHistogram(pixels: Uint8Array, width: number, height: number): number[] {
  const BINS = 8;
  const hBins = new Float64Array(BINS);
  const sBins = new Float64Array(BINS);
  const lBins = new Float64Array(BINS);

  // Use center crop (inner 70%) to reduce card border influence
  const cropMarginX = Math.floor(width * 0.15);
  const cropMarginY = Math.floor(height * 0.15);
  const cropW = width - 2 * cropMarginX;
  const cropH = height - 2 * cropMarginY;

  let pixelCount = 0;

  for (let y = cropMarginY; y < cropMarginY + cropH; y++) {
    for (let x = cropMarginX; x < cropMarginX + cropW; x++) {
      const idx = (y * width + x) * 3; // RGB, no alpha in sharp raw output
      const r = pixels[idx] as number;
      const g = pixels[idx + 1] as number;
      const b = pixels[idx + 2] as number;

      const [h, s, l] = rgbToHsl(r, g, b);

      // Only count pixels with enough saturation to have meaningful hue
      const hBin = Math.min(Math.floor(h * BINS), BINS - 1);
      const sBin = Math.min(Math.floor(s * BINS), BINS - 1);
      const lBin = Math.min(Math.floor(l * BINS), BINS - 1);

      // Weight hue contribution by saturation (desaturated pixels have unreliable hue)
      hBins[hBin] += s > 0.1 ? 1 : 0.1;
      sBins[sBin] += 1;
      lBins[lBin] += 1;
      pixelCount++;
    }
  }

  // Normalize each channel to sum to 1
  const result: number[] = [];

  let hSum = 0;
  for (let i = 0; i < BINS; i++) hSum += hBins[i] as number;
  for (let i = 0; i < BINS; i++) {
    result.push(Math.round(((hBins[i] as number) / (hSum || 1)) * 1000) / 1000);
  }

  let sSum = 0;
  for (let i = 0; i < BINS; i++) sSum += sBins[i] as number;
  for (let i = 0; i < BINS; i++) {
    result.push(Math.round(((sBins[i] as number) / (sSum || 1)) * 1000) / 1000);
  }

  let lSum = 0;
  for (let i = 0; i < BINS; i++) lSum += lBins[i] as number;
  for (let i = 0; i < BINS; i++) {
    result.push(Math.round(((lBins[i] as number) / (lSum || 1)) * 1000) / 1000);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Image fetching & hashing
// ---------------------------------------------------------------------------

async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'la-grieta-hash-cards/1.0 (card scanner pre-computation)',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function computeHashesForImage(
  imageUrl: string,
): Promise<{ ahash: string; phash: string; dhash: string; colorHist: number[]; thumb32: string }> {
  const imageBuffer = await fetchImage(imageUrl);

  // aHash: 8x8 grayscale
  const aPixels = await sharp(imageBuffer)
    .resize(8, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // dHash: 9x8 grayscale (9 wide for horizontal gradient comparison)
  const dPixels = await sharp(imageBuffer)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // pHash: 32x32 grayscale
  const pPixels = await sharp(imageBuffer)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // Color histogram: 64x64 RGB (no grayscale — we need color!)
  const histSize = 64;
  const histPixels = await sharp(imageBuffer)
    .resize(histSize, histSize, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  // 32x32 grayscale thumbnail for NCC matching
  const thumbPixels = await sharp(imageBuffer)
    .resize(32, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  const ahash = computeAHash(new Uint8Array(aPixels));
  const dhash = computeDHash(new Uint8Array(dPixels));
  const phash = computePHash(new Uint8Array(pPixels));
  const colorHist = computeColorHistogram(new Uint8Array(histPixels), histSize, histSize);
  const thumb32 = Buffer.from(thumbPixels).toString('base64');

  return { ahash, dhash, phash, colorHist, thumb32 };
}

// ---------------------------------------------------------------------------
// Concurrency helpers
// ---------------------------------------------------------------------------

async function processBatched<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((item, j) => fn(item, i + j)),
    );
    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j]!;
      if (outcome.status === 'fulfilled') {
        results[i + j] = outcome.value;
      } else {
        results[i + j] = null;
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function loadCards(dataRepoPath: string): RawCard[] {
  const setsPath = join(dataRepoPath, 'sets/en.json');
  const rawSets = JSON.parse(readFileSync(setsPath, 'utf-8')) as RawSet[];

  const allCards: RawCard[] = [];

  for (const set of rawSets) {
    const cardsPath = join(dataRepoPath, 'cards/en', `${set.id}.json`);
    const rawCards = JSON.parse(readFileSync(cardsPath, 'utf-8')) as RawCard[];
    const realCards = rawCards.filter((c) => c.rarity !== null);
    allCards.push(...realCards);
  }

  return allCards;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const repoRoot = join(__dirname, '../../..');
  const dataRepoPath = join(repoRoot, 'riftbound-tcg-data');

  const DELAY_MS = parseInt(process.env['DELAY_MS'] ?? '100', 10);
  const CONCURRENCY = parseInt(process.env['CONCURRENCY'] ?? '5', 10);
  const outputPath =
    process.env['OUTPUT_PATH'] ??
    join(repoRoot, 'apps/web/public/card-hashes.json');

  console.log('Loading card data from:', dataRepoPath);
  let cards = loadCards(dataRepoPath);
  console.log(`Found ${cards.length} real cards (products excluded)`);

  const maxCards = process.env['MAX_CARDS'] ? parseInt(process.env['MAX_CARDS'], 10) : undefined;
  if (maxCards !== undefined && maxCards > 0) {
    cards = cards.slice(0, maxCards);
    console.log(`MAX_CARDS=${maxCards} — processing first ${cards.length} only`);
  }
  console.log();

  let completed = 0;
  let skipped = 0;

  const results = await processBatched(
    cards,
    CONCURRENCY,
    async (card): Promise<CardHashEntry | null> => {
      const imageUrl = card.images.small;
      if (!imageUrl) {
        console.warn(`  [SKIP] ${card.id} — no imageSmall URL`);
        skipped++;
        return null;
      }

      try {
        const { ahash, phash, dhash, colorHist, thumb32 } = await computeHashesForImage(imageUrl);

        completed++;
        process.stdout.write(
          `\r  Processing ${completed + skipped}/${cards.length} — last: ${card.id}`,
        );

        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

        return {
          id: card.id,
          name: card.name,
          ahash,
          phash,
          dhash,
          colorHist,
          thumb32,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        skipped++;
        process.stdout.write('\n');
        console.warn(`  [WARN] Failed to hash ${card.id}: ${message}`);
        return null;
      }
    },
  );

  console.log('\n');

  const entries = results.filter((r): r is CardHashEntry => r !== null);

  const output: OutputFile = {
    version: 2,
    generatedAt: new Date().toISOString(),
    totalCards: entries.length,
    cards: entries,
  };

  const outputDir = dirname(outputPath);
  mkdirSync(outputDir, { recursive: true });

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log('Done!');
  console.log(`  Hashed:  ${completed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Output:  ${outputPath}`);
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
