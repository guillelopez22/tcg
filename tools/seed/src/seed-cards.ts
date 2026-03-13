import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Types matching the riftbound-tcg-data JSON shape
// ---------------------------------------------------------------------------
export interface RawSetEntry {
  id: string;
  name: string;
  total: number;
  releaseDate: string;
  description: string;
  tcgplayer: { group: number };
}

export interface RawCardEntry {
  id: string;
  number: string;
  code: string;
  name: string;
  cleanName: string;
  images: { small: string | null; large: string | null };
  set: { id: string; name: string; releaseDate: string };
  tcgplayer: { id: number | null; url: string | null } | null;
  rarity: string | null;
  cardType: string | null;
  domain: string | null;
  energyCost: string | null;
  powerCost: string | null;
  might: string | null;
  description: string | null;
  flavorText: string | null;
}

// ---------------------------------------------------------------------------
// Parsing helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Returns true if the raw entry is a non-playable product (booster pack,
 * display box, deck, etc.) rather than a playable card.
 * Products are identified by null rarity in the source data.
 */
export function isProduct(entry: RawCardEntry): boolean {
  return entry.rarity === null;
}

/**
 * Parses a string numeric value from card JSON to an integer.
 * Returns null if the value is null, undefined, or not a valid number.
 */
export function parseIntOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Strips HTML tags from a description string.
 * Card descriptions from TCGPlayer may contain <em>, <strong>, etc.
 */
export function stripHtml(html: string | null | undefined): string | null {
  if (html === null || html === undefined) return null;
  return html.replace(/<[^>]+>/g, '');
}

/**
 * Corrections for tcgplayer group IDs that are wrong in the source data.
 * The riftbound-tcg-data repo has Origins and Origins: Proving Grounds both
 * listed as group 24439, but TCGPlayer actually uses 24344 for Origins.
 */
const TCGPLAYER_GROUP_OVERRIDES: Record<string, number> = {
  origins: 24344,
};

/**
 * Maps a raw set entry to the DB insert shape.
 */
export function mapSetToInsert(raw: RawSetEntry): {
  externalId: string;
  slug: string;
  name: string;
  total: number;
  releaseDate: string;
  description: string | null;
  tcgplayerGroupId: number | null;
} {
  const groupId = TCGPLAYER_GROUP_OVERRIDES[raw.id] ?? raw.tcgplayer?.group ?? null;
  return {
    externalId: raw.id,
    slug: raw.id,
    name: raw.name,
    total: raw.total,
    releaseDate: raw.releaseDate,
    description: raw.description || null,
    tcgplayerGroupId: groupId,
  };
}

/**
 * Maps a raw card entry to the DB insert shape.
 * setId must be resolved separately from the sets that were upserted.
 */
export function mapCardToInsert(
  raw: RawCardEntry,
  setId: string,
): {
  externalId: string;
  number: string;
  code: string;
  name: string;
  cleanName: string;
  setId: string;
  rarity: string;
  cardType: string;
  domain: string;
  energyCost: number | null;
  powerCost: number | null;
  might: number | null;
  description: string | null;
  flavorText: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  tcgplayerId: number | null;
  tcgplayerUrl: string | null;
  isProduct: boolean;
} {
  const product = isProduct(raw);
  return {
    externalId: raw.id,
    number: raw.number,
    code: raw.code,
    name: raw.name,
    cleanName: raw.cleanName,
    setId,
    rarity: raw.rarity ?? '',
    cardType: raw.cardType ?? '',
    domain: raw.domain ?? '',
    energyCost: parseIntOrNull(raw.energyCost),
    powerCost: parseIntOrNull(raw.powerCost),
    might: parseIntOrNull(raw.might),
    description: stripHtml(raw.description),
    flavorText: raw.flavorText ?? null,
    imageSmall: raw.images?.small ?? null,
    imageLarge: raw.images?.large ?? null,
    tcgplayerId: raw.tcgplayer?.id ?? null,
    tcgplayerUrl: raw.tcgplayer?.url ?? null,
    isProduct: product,
  };
}

// ---------------------------------------------------------------------------
// File loading helpers
// ---------------------------------------------------------------------------

/**
 * Loads the sets manifest from the data repo.
 */
export function loadSetsData(dataRepoPath: string): RawSetEntry[] {
  const raw = readFileSync(join(dataRepoPath, 'sets', 'en.json'), 'utf-8');
  return JSON.parse(raw) as RawSetEntry[];
}

/**
 * Loads the card data for a given set slug.
 */
export function loadCardsData(dataRepoPath: string, setSlug: string): RawCardEntry[] {
  const raw = readFileSync(join(dataRepoPath, 'cards', 'en', `${setSlug}.json`), 'utf-8');
  return JSON.parse(raw) as RawCardEntry[];
}

// ---------------------------------------------------------------------------
// Main seed runner — injected db for testability
// ---------------------------------------------------------------------------
export interface SeedDb {
  insertOrUpdateSet(data: ReturnType<typeof mapSetToInsert>): Promise<{ id: string; slug: string }>;
  insertOrUpdateCard(data: ReturnType<typeof mapCardToInsert>): Promise<void>;
}

export interface SeedResult {
  sets: number;
  cards: number;
  products: number;
}

/**
 * Builds a lookup from base card code (e.g. "058/221") to its raw entry.
 * Alt art codes use a suffix like "058a/221" — stripping the 'a' before '/'
 * lets us find the base card and inherit missing cardType / domain.
 */
function buildBaseCardLookup(rawCards: RawCardEntry[]): Map<string, RawCardEntry> {
  const map = new Map<string, RawCardEntry>();
  for (const c of rawCards) {
    // Only index non-alt-art cards (no 'a' suffix before '/')
    if (c.code && !c.code.match(/\d+a\//)) {
      map.set(c.code, c);
    }
  }
  return map;
}

/**
 * For alt art variants with missing cardType/domain, inherit from the base card.
 * E.g. "058a/221" inherits from "058/221".
 */
function inheritMissingFields(raw: RawCardEntry, baseLookup: Map<string, RawCardEntry>): RawCardEntry {
  if (raw.cardType && raw.domain) return raw; // nothing missing
  const altMatch = raw.code?.match(/^(\d+)a(\/\d+)$/);
  if (!altMatch) return raw;
  const baseCode = altMatch[1] + altMatch[2];
  const base = baseLookup.get(baseCode);
  if (!base) return raw;
  return {
    ...raw,
    cardType: raw.cardType ?? base.cardType,
    domain: raw.domain ?? base.domain,
  };
}

export async function seedCards(db: SeedDb, dataRepoPath: string): Promise<SeedResult> {
  const rawSets = loadSetsData(dataRepoPath);
  const setIdMap = new Map<string, string>(); // slug -> DB uuid

  for (const rawSet of rawSets) {
    const inserted = await db.insertOrUpdateSet(mapSetToInsert(rawSet));
    setIdMap.set(inserted.slug, inserted.id);
  }

  let totalCards = 0;
  let totalProducts = 0;

  for (const rawSet of rawSets) {
    const setId = setIdMap.get(rawSet.id);
    if (!setId) continue;

    const rawCards = loadCardsData(dataRepoPath, rawSet.id);
    const baseLookup = buildBaseCardLookup(rawCards);

    // Deduplicate: source data can have duplicate IDs for different printings
    // (e.g. same ID for Overnumbered + Alternate Art). Track seen IDs and
    // append a rarity suffix to make them unique.
    const seenIds = new Set<string>();

    for (const rawCard of rawCards) {
      let enriched = inheritMissingFields(rawCard, baseLookup);

      // If we've already seen this ID, disambiguate with a rarity-based suffix
      if (seenIds.has(enriched.id)) {
        const suffix = (enriched.rarity ?? 'dup').toLowerCase().replace(/\s+/g, '-');
        enriched = { ...enriched, id: `${enriched.id}-${suffix}` };
      }
      seenIds.add(enriched.id);

      const mapped = mapCardToInsert(enriched, setId);
      await db.insertOrUpdateCard(mapped);
      if (mapped.isProduct) {
        totalProducts++;
      } else {
        totalCards++;
      }
    }
  }

  return { sets: rawSets.length, cards: totalCards, products: totalProducts };
}
