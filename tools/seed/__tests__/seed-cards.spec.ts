import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import {
  isProduct,
  parseIntOrNull,
  stripHtml,
  mapSetToInsert,
  mapCardToInsert,
  loadSetsData,
  loadCardsData,
  seedCards,
  type RawCardEntry,
  type RawSetEntry,
  type SeedDb,
} from '../src/seed-cards';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PRODUCT_ENTRY: RawCardEntry = {
  id: 'origins-0',
  number: '0',
  code: '0',
  name: 'Origins - Booster Pack',
  cleanName: 'Origins Booster Pack',
  images: {
    small: 'https://tcgplayer-cdn.tcgplayer.com/product/635366_400w.jpg',
    large: 'https://tcgplayer-cdn.tcgplayer.com/product/635366_in_1000x1000.jpg',
  },
  set: { id: 'origins', name: 'Origins', releaseDate: '2025-10-31' },
  tcgplayer: { id: 635366, url: 'https://www.tcgplayer.com/product/635366' },
  rarity: null,
  cardType: null,
  domain: null,
  energyCost: null,
  powerCost: null,
  might: null,
  description: null,
  flavorText: null,
};

const CARD_ENTRY: RawCardEntry = {
  id: 'origins-001-298',
  number: '001/298',
  code: '001/298',
  name: 'Blazing Scorcher',
  cleanName: 'Blazing Scorcher',
  images: {
    small: 'https://tcgplayer-cdn.tcgplayer.com/product/652771_400w.jpg',
    large: 'https://tcgplayer-cdn.tcgplayer.com/product/652771_in_1000x1000.jpg',
  },
  set: { id: 'origins', name: 'Origins', releaseDate: '2025-10-31' },
  tcgplayer: { id: 652771, url: 'https://www.tcgplayer.com/product/652771' },
  rarity: 'Common',
  cardType: 'Unit',
  domain: 'Fury',
  energyCost: '5',
  powerCost: '0',
  might: '5',
  description: 'ACCELERATE <em>(You may pay 1 Fury as an additional cost to have me enter ready.)</em>',
  flavorText: null,
};

const MULTI_DOMAIN_CARD: RawCardEntry = {
  ...CARD_ENTRY,
  id: 'origins-050-298',
  name: 'Test Multi-Domain Card',
  cleanName: 'Test Multi Domain Card',
  domain: 'Fury;Chaos',
  rarity: 'Rare',
  cardType: 'Champion Unit',
};

const SET_ENTRY: RawSetEntry = {
  id: 'origins',
  name: 'Origins',
  total: 360,
  releaseDate: '2025-10-31',
  description: 'The first set of Riftbound',
  tcgplayer: { group: 24439 },
};

// ---------------------------------------------------------------------------
// isProduct()
// ---------------------------------------------------------------------------
describe('isProduct()', () => {
  it('should return true for entries with null rarity', () => {
    expect(isProduct(PRODUCT_ENTRY)).toBe(true);
  });

  it('should return false for entries with a rarity value', () => {
    expect(isProduct(CARD_ENTRY)).toBe(false);
  });

  it('should return false for Common cards', () => {
    expect(isProduct({ ...CARD_ENTRY, rarity: 'Common' })).toBe(false);
  });

  it('should return false for Uncommon cards', () => {
    expect(isProduct({ ...CARD_ENTRY, rarity: 'Uncommon' })).toBe(false);
  });

  it('should return false for Rare cards', () => {
    expect(isProduct({ ...CARD_ENTRY, rarity: 'Rare' })).toBe(false);
  });

  it('should return false for Epic cards', () => {
    expect(isProduct({ ...CARD_ENTRY, rarity: 'Epic' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseIntOrNull()
// ---------------------------------------------------------------------------
describe('parseIntOrNull()', () => {
  it('should parse a valid integer string to number', () => {
    expect(parseIntOrNull('5')).toBe(5);
  });

  it('should parse "0" to 0 (not null)', () => {
    expect(parseIntOrNull('0')).toBe(0);
  });

  it('should parse large integers correctly', () => {
    expect(parseIntOrNull('999')).toBe(999);
  });

  it('should return null for null input', () => {
    expect(parseIntOrNull(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(parseIntOrNull(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseIntOrNull('')).toBeNull();
  });

  it('should return null for non-numeric strings', () => {
    expect(parseIntOrNull('abc')).toBeNull();
  });

  it('should truncate decimal strings (parseInt behavior)', () => {
    expect(parseIntOrNull('3.7')).toBe(3);
  });

  it('should handle negative numbers', () => {
    expect(parseIntOrNull('-1')).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// stripHtml()
// ---------------------------------------------------------------------------
describe('stripHtml()', () => {
  it('should remove <em> tags from description', () => {
    const input = 'ACCELERATE <em>(You may pay 1 Fury.)</em>';
    expect(stripHtml(input)).toBe('ACCELERATE (You may pay 1 Fury.)');
  });

  it('should remove <strong> tags', () => {
    expect(stripHtml('Hello <strong>world</strong>')).toBe('Hello world');
  });

  it('should remove nested HTML tags', () => {
    expect(stripHtml('<div><p>Text</p></div>')).toBe('Text');
  });

  it('should return null for null input', () => {
    expect(stripHtml(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(stripHtml(undefined)).toBeNull();
  });

  it('should return text unchanged if no HTML tags present', () => {
    expect(stripHtml('ACCELERATE (You may pay 1 Fury.)')).toBe(
      'ACCELERATE (You may pay 1 Fury.)',
    );
  });

  it('should handle empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('should handle multiple tags in one string', () => {
    const input = '<em>First</em> and <strong>Second</strong>';
    expect(stripHtml(input)).toBe('First and Second');
  });
});

// ---------------------------------------------------------------------------
// mapSetToInsert()
// ---------------------------------------------------------------------------
describe('mapSetToInsert()', () => {
  it('should map set id to slug field', () => {
    const result = mapSetToInsert(SET_ENTRY);
    expect(result.slug).toBe('origins');
  });

  it('should map name correctly', () => {
    const result = mapSetToInsert(SET_ENTRY);
    expect(result.name).toBe('Origins');
  });

  it('should map total correctly', () => {
    const result = mapSetToInsert(SET_ENTRY);
    expect(result.total).toBe(360);
  });

  it('should map releaseDate correctly', () => {
    const result = mapSetToInsert(SET_ENTRY);
    expect(result.releaseDate).toBe('2025-10-31');
  });

  it('should map tcgplayer group to tcgplayerGroupId (with override for origins)', () => {
    const result = mapSetToInsert(SET_ENTRY);
    // Origins has a corrected group ID (source data has 24439, TCGPlayer uses 24344)
    expect(result.tcgplayerGroupId).toBe(24344);
  });

  it('should set description to null when empty string', () => {
    const emptyDesc: RawSetEntry = { ...SET_ENTRY, description: '' };
    const result = mapSetToInsert(emptyDesc);
    expect(result.description).toBeNull();
  });

  it('should preserve non-empty description', () => {
    const result = mapSetToInsert(SET_ENTRY);
    expect(result.description).toBe('The first set of Riftbound');
  });

  it('should return null tcgplayerGroupId when tcgplayer is undefined', () => {
    const noTcg = { ...SET_ENTRY, tcgplayer: undefined as unknown as RawSetEntry['tcgplayer'] };
    const result = mapSetToInsert(noTcg);
    expect(result.tcgplayerGroupId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapCardToInsert()
// ---------------------------------------------------------------------------
describe('mapCardToInsert()', () => {
  const TEST_SET_ID = '123e4567-e89b-12d3-a456-426614174000';

  it('should map externalId from raw id', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.externalId).toBe('origins-001-298');
  });

  it('should set isProduct to false for playable cards', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.isProduct).toBe(false);
  });

  it('should set isProduct to true for booster packs and products', () => {
    const result = mapCardToInsert(PRODUCT_ENTRY, TEST_SET_ID);
    expect(result.isProduct).toBe(true);
  });

  it('should parse energyCost from string "5" to integer 5', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.energyCost).toBe(5);
  });

  it('should parse powerCost from string "0" to integer 0', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.powerCost).toBe(0);
  });

  it('should parse might from string "5" to integer 5', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.might).toBe(5);
  });

  it('should set energyCost to null when source is null', () => {
    const result = mapCardToInsert(PRODUCT_ENTRY, TEST_SET_ID);
    expect(result.energyCost).toBeNull();
  });

  it('should strip HTML from description', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.description).toBe(
      'ACCELERATE (You may pay 1 Fury as an additional cost to have me enter ready.)',
    );
  });

  it('should set description to null when source is null', () => {
    const result = mapCardToInsert(PRODUCT_ENTRY, TEST_SET_ID);
    expect(result.description).toBeNull();
  });

  it('should preserve semicolon-separated multi-domain values', () => {
    const result = mapCardToInsert(MULTI_DOMAIN_CARD, TEST_SET_ID);
    expect(result.domain).toBe('Fury;Chaos');
  });

  it('should use provided setId as the DB foreign key', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.setId).toBe(TEST_SET_ID);
  });

  it('should map image URLs correctly', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.imageSmall).toContain('400w');
    expect(result.imageLarge).toContain('1000x1000');
  });

  it('should map tcgplayer id and url', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.tcgplayerId).toBe(652771);
    expect(result.tcgplayerUrl).toContain('tcgplayer.com');
  });

  it('should set rarity to empty string for products (not null — DB column is notNull)', () => {
    const result = mapCardToInsert(PRODUCT_ENTRY, TEST_SET_ID);
    expect(result.rarity).toBe('');
  });

  it('should set cardType to empty string for products', () => {
    const result = mapCardToInsert(PRODUCT_ENTRY, TEST_SET_ID);
    expect(result.cardType).toBe('');
  });

  it('should set domain to empty string for products', () => {
    const result = mapCardToInsert(PRODUCT_ENTRY, TEST_SET_ID);
    expect(result.domain).toBe('');
  });

  it('should handle null flavorText', () => {
    const result = mapCardToInsert(CARD_ENTRY, TEST_SET_ID);
    expect(result.flavorText).toBeNull();
  });

  it('should handle null tcgplayer data gracefully', () => {
    const noTcg: RawCardEntry = { ...CARD_ENTRY, tcgplayer: null };
    const result = mapCardToInsert(noTcg, TEST_SET_ID);
    expect(result.tcgplayerId).toBeNull();
    expect(result.tcgplayerUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadSetsData() and loadCardsData() — against real data files
// ---------------------------------------------------------------------------
const DATA_REPO_PATH = join(__dirname, '../../../riftbound-tcg-data');

describe('loadSetsData()', () => {
  it('should load exactly 3 sets from the data repo', () => {
    const data = loadSetsData(DATA_REPO_PATH);
    expect(data).toHaveLength(3);
  });

  it('should include origins, origins-proving-grounds, and spiritforged', () => {
    const data = loadSetsData(DATA_REPO_PATH);
    const ids = data.map((s) => s.id);
    expect(ids).toContain('origins');
    expect(ids).toContain('origins-proving-grounds');
    expect(ids).toContain('spiritforged');
  });

  it('should have required fields on each set', () => {
    const data = loadSetsData(DATA_REPO_PATH);
    for (const set of data) {
      expect(set.id).toBeTruthy();
      expect(set.name).toBeTruthy();
      expect(typeof set.total).toBe('number');
      expect(set.releaseDate).toBeTruthy();
    }
  });

  it('should have tcgplayer group ids on all sets', () => {
    const data = loadSetsData(DATA_REPO_PATH);
    for (const set of data) {
      expect(typeof set.tcgplayer.group).toBe('number');
    }
  });

  it('should throw if the data repo path is wrong', () => {
    expect(() => loadSetsData('/does/not/exist')).toThrow();
  });
});

describe('loadCardsData()', () => {
  it('should load cards array for the origins set', () => {
    const data = loadCardsData(DATA_REPO_PATH, 'origins');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should load cards for origins-proving-grounds', () => {
    const data = loadCardsData(DATA_REPO_PATH, 'origins-proving-grounds');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should load cards for spiritforged', () => {
    const data = loadCardsData(DATA_REPO_PATH, 'spiritforged');
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('should throw for an unknown set slug', () => {
    expect(() => loadCardsData(DATA_REPO_PATH, 'nonexistent-set')).toThrow();
  });

  it('origins should have product entries (null rarity) before playable cards', () => {
    const data = loadCardsData(DATA_REPO_PATH, 'origins');
    const firstEntry = data[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry!.rarity).toBeNull();
  });

  it('origins should contain the known card origins-001-298 (Blazing Scorcher)', () => {
    const data = loadCardsData(DATA_REPO_PATH, 'origins');
    const blazingScorcher = data.find((c) => c.id === 'origins-001-298');
    expect(blazingScorcher).toBeDefined();
    expect(blazingScorcher!.name).toBe('Blazing Scorcher');
    expect(blazingScorcher!.rarity).toBe('Common');
    expect(blazingScorcher!.domain).toBe('Fury');
  });

  it('origins playable cards should have string-typed numeric fields', () => {
    const data = loadCardsData(DATA_REPO_PATH, 'origins');
    const playableCards = data.filter((c) => c.rarity !== null);
    for (const card of playableCards) {
      if (card.energyCost !== null) {
        expect(typeof card.energyCost).toBe('string');
      }
      if (card.might !== null) {
        expect(typeof card.might).toBe('string');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// seedCards() — full orchestration with mocked DB
// ---------------------------------------------------------------------------
describe('seedCards()', () => {
  let mockDb: SeedDb;
  let insertSetCalls: Array<ReturnType<typeof mapSetToInsert>>;
  let insertCardCalls: Array<ReturnType<typeof mapCardToInsert>>;

  beforeEach(() => {
    insertSetCalls = [];
    insertCardCalls = [];

    let setCounter = 0;
    mockDb = {
      insertOrUpdateSet: vi.fn(async (data) => {
        insertSetCalls.push(data);
        setCounter++;
        return { id: `set-uuid-${setCounter}`, slug: data.slug };
      }),
      insertOrUpdateCard: vi.fn(async (data) => {
        insertCardCalls.push(data);
      }),
    };
  });

  it('should call insertOrUpdateSet once per set (3 sets)', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    expect(mockDb.insertOrUpdateSet).toHaveBeenCalledTimes(3);
  });

  it('should return sets count of 3', async () => {
    const result = await seedCards(mockDb, DATA_REPO_PATH);
    expect(result.sets).toBe(3);
  });

  it('should return a positive card count', async () => {
    const result = await seedCards(mockDb, DATA_REPO_PATH);
    expect(result.cards).toBeGreaterThan(0);
  });

  it('should return a positive product count', async () => {
    const result = await seedCards(mockDb, DATA_REPO_PATH);
    expect(result.products).toBeGreaterThan(0);
  });

  it('total (cards + products) should equal total insertOrUpdateCard calls', async () => {
    const result = await seedCards(mockDb, DATA_REPO_PATH);
    expect(result.cards + result.products).toBe(insertCardCalls.length);
    expect(mockDb.insertOrUpdateCard).toHaveBeenCalledTimes(result.cards + result.products);
  });

  it('should correctly classify products vs playable cards', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    const products = insertCardCalls.filter((c) => c.isProduct);
    const playable = insertCardCalls.filter((c) => !c.isProduct);
    expect(products.length).toBeGreaterThan(0);
    expect(playable.length).toBeGreaterThan(0);
  });

  it('should pass numeric types (not strings) for energyCost, powerCost, might', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    const playableCards = insertCardCalls.filter((c) => !c.isProduct && c.energyCost !== null);
    expect(playableCards.length).toBeGreaterThan(0);
    for (const card of playableCards) {
      if (card.energyCost !== null) {
        expect(typeof card.energyCost).toBe('number');
      }
      if (card.powerCost !== null) {
        expect(typeof card.powerCost).toBe('number');
      }
      if (card.might !== null) {
        expect(typeof card.might).toBe('number');
      }
    }
  });

  it('should strip HTML tags from descriptions before inserting', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    for (const card of insertCardCalls) {
      if (card.description !== null) {
        expect(card.description).not.toMatch(/<[^>]+>/);
      }
    }
  });

  it('should pass resolved set UUIDs (not set slugs) as setId', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    for (const card of insertCardCalls) {
      // The setId should be from our mock (set-uuid-N), not the slug string
      expect(card.setId).toMatch(/^set-uuid-\d+$/);
    }
  });

  it('should be idempotent — calling twice calls upsert same number of times', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    const firstRunSets = (mockDb.insertOrUpdateSet as ReturnType<typeof vi.fn>).mock.calls.length;
    const firstRunCards = (mockDb.insertOrUpdateCard as ReturnType<typeof vi.fn>).mock.calls.length;

    // Reset mock call counts but keep same implementation
    vi.clearAllMocks();
    let setCounter = 0;
    mockDb.insertOrUpdateSet = vi.fn(async (data) => {
      setCounter++;
      return { id: `set-uuid-${setCounter}`, slug: data.slug };
    });
    mockDb.insertOrUpdateCard = vi.fn(async () => {});

    await seedCards(mockDb, DATA_REPO_PATH);
    const secondRunSets = (mockDb.insertOrUpdateSet as ReturnType<typeof vi.fn>).mock.calls.length;
    const secondRunCards = (mockDb.insertOrUpdateCard as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(secondRunSets).toBe(firstRunSets);
    expect(secondRunCards).toBe(firstRunCards);
  });

  it('should propagate errors from insertOrUpdateSet', async () => {
    mockDb.insertOrUpdateSet = vi.fn(async () => {
      throw new Error('DB connection lost');
    });
    await expect(seedCards(mockDb, DATA_REPO_PATH)).rejects.toThrow('DB connection lost');
  });

  it('should propagate errors from insertOrUpdateCard', async () => {
    let callCount = 0;
    mockDb.insertOrUpdateCard = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Unique constraint violation');
    });
    await expect(seedCards(mockDb, DATA_REPO_PATH)).rejects.toThrow(
      'Unique constraint violation',
    );
  });

  it('should not insert any cards without a resolved setId', async () => {
    await seedCards(mockDb, DATA_REPO_PATH);
    for (const card of insertCardCalls) {
      expect(card.setId).toBeTruthy();
      expect(card.setId).not.toBe('');
    }
  });

  it('should call insertOrUpdateCard for every entry in the source data (including duplicates)', async () => {
    // NOTE: The source data contains duplicate externalIds (e.g., Origins numbered 299-360
    // are reprints/variants that also appear as origins-proving-grounds cards). The seed
    // script passes all entries to insertOrUpdateCard — the DB UPSERT handles deduplication
    // via ON CONFLICT DO UPDATE. This test verifies the seed does not pre-filter duplicates.
    await seedCards(mockDb, DATA_REPO_PATH);
    // We expect 699 total calls (all source entries) not 674 (unique IDs only)
    expect(insertCardCalls.length).toBe(699);
  });
});
