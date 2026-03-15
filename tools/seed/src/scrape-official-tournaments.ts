/**
 * Scrapes official Riftbound tournament articles and imports decklists into the DB.
 *
 * Data source: Riftbound official news articles (Next.js app with __NEXT_DATA__ JSON).
 * Decklists are embedded as HTML in the `richText.body` field of the articleRichText blade.
 *
 * Usage:
 *   DATABASE_URL=... pnpm --filter @la-grieta/seed exec tsx src/scrape-official-tournaments.ts
 *
 * Idempotent: decks are matched by stable name "[Official] {Legend} by Player #{placement} - {Tournament}".
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import { createDbClient } from '@la-grieta/db';
import { users, decks, deckCards, cards } from '@la-grieta/db';
import { eq, and, ilike } from 'drizzle-orm';
import { getZoneForCardType, validateDeckFormat } from '@la-grieta/shared';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SYSTEM_USERNAME = 'la-grieta-system';

const TOURNAMENT_ARTICLES = [
  {
    url: 'https://riftbound.leagueoflegends.com/en-us/news/organizedplay/the-best-decks-out-of-bologna/',
    tournament: 'RQ Bologna',
    region: 'Europe',
  },
  {
    url: 'https://riftbound.leagueoflegends.com/en-us/news/organizedplay/vegas-top-decks/',
    tournament: 'RQ Las Vegas',
    region: 'North America',
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedCardEntry {
  name: string;
  quantity: number;
}

interface ParsedDecklist {
  placement: number | null;
  legendName: string | null;
  championName: string | null;
  mainDeck: ParsedCardEntry[];
  runes: ParsedCardEntry[];
  battlefields: string[];
  sideboard: ParsedCardEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Parses a quantity-prefixed card name like "2 Azir, Ascendant" → { quantity: 2, name: "Azir, Ascendant" }.
 * If no leading number is found, quantity defaults to 1.
 */
const SKIP_LINES = new Set([
  'main deck', 'main deck:', 'rune pool', 'rune pool:', 'runes', 'runes:',
  'battlefields', 'battlefields:', 'sideboard', 'sideboard:',
  'legend', 'legend:', 'champion', 'champion:',
]);

function parseCardLine(line: string): ParsedCardEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Skip section headers
  if (SKIP_LINES.has(trimmed.toLowerCase())) return null;
  if (/^(main deck|rune pool|battlefields|sideboard|legend|champion)\b/i.test(trimmed)) return null;

  const match = trimmed.match(/^(\d+)\s+(.+)$/);
  if (match) {
    const quantity = parseInt(match[1]!, 10);
    const name = match[2]!.trim();
    if (name && name.length > 1) return { quantity, name };
  }

  // No leading number — treat as quantity 1 (skip very short entries)
  if (trimmed.length < 3) return null;
  return { quantity: 1, name: trimmed };
}

/**
 * Extracts plain text lines from a cheerio element, splitting on <br> tags.
 * Returns non-empty trimmed strings.
 */
function extractTextLines($el: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string[] {
  // Replace <br> with newline sentinels, then get text
  $el.find('br').replaceWith('\n');
  const raw = $el.text();
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Strips known label prefixes ("Legend: ", "Champion: ", etc.) and returns the value.
 */
function stripLabel(text: string, ...labels: string[]): string {
  for (const label of labels) {
    const lower = text.toLowerCase();
    const labelLower = label.toLowerCase();
    if (lower.startsWith(labelLower)) {
      return text.slice(label.length).trim();
    }
  }
  return text.trim();
}

/**
 * Fetches an official article page and returns the HTML body string from the articleRichText blade.
 */
async function fetchArticleBody(url: string): Promise<string> {
  console.log(`  Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LaGrietaBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const html = await response.text();

  // Extract __NEXT_DATA__ JSON from the page
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match || !match[1]) {
    throw new Error(`No __NEXT_DATA__ found on ${url}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextData: any;
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    throw new Error(`Failed to parse __NEXT_DATA__ JSON from ${url}`);
  }

  // Navigate to the richText body — the structure is:
  //   props.pageProps.page.blades[2].richText.body
  // We search all blades for one with a richText.body field to be resilient.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blades: any[] = nextData?.props?.pageProps?.page?.blades ?? [];

  // Try index 2 first (as documented), then fall back to searching all blades
  const candidateBlades = blades[2]?.richText?.body
    ? [blades[2]]
    : blades.filter((b) => b?.richText?.body);

  if (candidateBlades.length === 0) {
    // Dump blade structure to help debug
    const bladeInfo = blades.map((b, i) => `[${i}] type=${b?.type ?? 'unknown'}, keys=${Object.keys(b ?? {}).join(',')}`);
    throw new Error(
      `No blade with richText.body found on ${url}.\nBlades: ${bladeInfo.join(' | ')}`,
    );
  }

  const body: string = candidateBlades[0].richText.body;
  if (typeof body !== 'string') {
    throw new Error(`richText.body is not a string on ${url}`);
  }

  return body;
}

/**
 * Parses the HTML body of an official article and returns all decklists found.
 *
 * The article uses a table-based layout where each deck is a <tr> with two <td> cells:
 *   - Left <td>: Legend, Champion, Main Deck cards, Runes
 *   - Right <td>: Battlefields, Sideboard
 *
 * Placement info is in the preceding <h3> element (e.g., "Legend Rank: 1 / 33 players").
 */
function parseArticleBody(html: string): ParsedDecklist[] {
  const $ = cheerio.load(html);
  const decklists: ParsedDecklist[] = [];

  // Each deck appears inside a <tr> that contains two <td> cells.
  // Placement is in the nearest preceding <h3>.
  $('tr').each((_i, row) => {
    const tds = $(row).find('td');
    if (tds.length < 1) return;

    // Collect all text from the row to check it looks like a decklist
    const leftTd = $(tds[0]!);
    const rightTd = tds.length >= 2 ? $(tds[1]!) : null;

    const leftText = leftTd.text();
    // Must contain at least a legend or champion reference to be a decklist
    if (!/legend|champion/i.test(leftText)) return;

    // Find placement from the nearest preceding h3
    let placement: number | null = null;
    const prevH3 = $(row).closest('table').prev('h3');
    if (prevH3.length) {
      const h3Text = prevH3.text();
      // "Legend Rank: 1 / 33 players" or "Legend Rank: 1/33"
      const rankMatch = h3Text.match(/legend\s+rank\s*:\s*(\d+)/i);
      if (rankMatch) {
        placement = parseInt(rankMatch[1]!, 10);
      }
    }

    // Parse the left <td>
    const decklist = parseLeftCell($, leftTd, placement);
    if (rightTd) {
      parseRightCell($, rightTd, decklist);
    }

    // Only keep entries that have at least a legend or champion
    if (decklist.legendName || decklist.championName || decklist.mainDeck.length > 0) {
      decklists.push(decklist);
    }
  });

  return decklists;
}

/**
 * Parses the left <td> which contains:
 *   <p><strong>Legend: </strong>Ornn, ...</p>
 *   <p><strong>Champion: </strong>Ornn, ...</p>
 *   <p><strong>Main Deck</strong><br>2 Card<br>...</p>
 *   <p>8 Calm Rune<br>4 Mind Rune</p>
 */
function parseLeftCell(
  $: cheerio.CheerioAPI,
  td: cheerio.Cheerio<cheerio.Element>,
  placement: number | null,
): ParsedDecklist {
  const decklist: ParsedDecklist = {
    placement,
    legendName: null,
    championName: null,
    mainDeck: [],
    runes: [],
    battlefields: [],
    sideboard: [],
  };

  // Clone to avoid mutating the original for line extraction
  const tdClone = td.clone();

  let currentSection: 'none' | 'main' | 'rune' = 'none';

  tdClone.find('p').each((_i, p) => {
    const $p = $(p);

    // Extract the bold label (if any) — the first <strong> in this <p>
    const strongText = $p.find('strong').first().text().trim();
    const strongLower = strongText.toLowerCase();

    // Detect section by the bold header
    if (strongLower.startsWith('legend:') || strongLower === 'legend:') {
      const fullText = $p.text().trim();
      decklist.legendName = stripLabel(fullText, 'Legend:', 'Legend: ');
      currentSection = 'none';
      return;
    }

    if (strongLower.startsWith('champion:') || strongLower === 'champion:') {
      const fullText = $p.text().trim();
      decklist.championName = stripLabel(fullText, 'Champion:', 'Champion: ');
      currentSection = 'none';
      return;
    }

    if (strongLower === 'main deck' || strongLower.includes('main deck')) {
      currentSection = 'main';
      // The main deck cards follow as <br>-separated lines within the same <p>
      const lines = extractTextLines($p, $);
      // Skip the "Main Deck" header itself
      for (const line of lines) {
        if (/^main\s*deck$/i.test(line)) continue;
        const entry = parseCardLine(line);
        if (entry) decklist.mainDeck.push(entry);
      }
      return;
    }

    // A paragraph without a recognisable header — infer section from content
    if (currentSection === 'main' || currentSection === 'rune') {
      const lines = extractTextLines($p, $);
      for (const line of lines) {
        if (!line) continue;
        const entry = parseCardLine(line);
        if (!entry) continue;

        // Rune cards contain "rune" in their name
        if (/rune/i.test(entry.name)) {
          decklist.runes.push(entry);
          currentSection = 'rune';
        } else {
          decklist.mainDeck.push(entry);
        }
      }
    }
  });

  return decklist;
}

/**
 * Parses the right <td> which contains:
 *   <p><strong>Battlefields</strong></p>
 *   <ul><li>Aspirant's Climb</li>...</ul>
 *   <p><strong>Sideboard</strong></p>
 *   <ul><li>2 Card Name</li>...</ul>
 */
function parseRightCell(
  $: cheerio.CheerioAPI,
  td: cheerio.Cheerio<cheerio.Element>,
  decklist: ParsedDecklist,
): void {
  let currentSection: 'none' | 'battlefield' | 'sideboard' = 'none';

  // Walk through each child element in order
  td.children().each((_i, el) => {
    const tag = el.type === 'tag' ? el.name : null;
    if (!tag) return;

    if (tag === 'p') {
      const $p = $(el);
      const strongText = $p.find('strong').first().text().trim().toLowerCase();

      if (strongText.includes('battlefield')) {
        currentSection = 'battlefield';
        return;
      }
      if (strongText.includes('sideboard')) {
        currentSection = 'sideboard';
        return;
      }
    }

    if (tag === 'ul') {
      const $ul = $(el);
      $ul.find('li').each((_j, li) => {
        const text = $(li).text().trim();
        if (!text) return;

        if (currentSection === 'battlefield') {
          decklist.battlefields.push(text);
        } else if (currentSection === 'sideboard') {
          const entry = parseCardLine(text);
          if (entry) decklist.sideboard.push(entry);
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Looks up a card by clean_name using ILIKE (case-insensitive, partial-match tolerant).
 * Returns the first matching card's id and cardType, or null if not found.
 */
async function findCardByName(
  db: ReturnType<typeof createDbClient>,
  name: string,
): Promise<{ id: string; cardType: string; domain: string } | null> {
  // Normalize: strip punctuation to match DB clean_name format
  // DB clean_name strips apostrophes, commas, periods, exclamation marks, etc.
  const cleaned = name.trim()
    .replace(/^\d+\s+/, '')              // Strip leading "1 " quantity prefix if parser leaked it
    .replace(/[,.''\u2019\u2018!?]/g, '') // "Doran's" → "Dorans", "Thwonk!" → "Thwonk"
    .replace(/\./g, '')                   // "B.F. Sword" → "BF Sword"
    .replace(/-/g, ' ')                   // "Thousand-Tailed" → "Thousand Tailed"
    .replace(/\s+/g, ' ')                // collapse spaces
    .trim();

  // Try exact clean_name match first
  let rows = await db
    .select({ id: cards.id, cardType: cards.cardType, domain: cards.domain })
    .from(cards)
    .where(ilike(cards.cleanName, cleaned))
    .limit(1);

  if (rows.length > 0) return rows[0] ?? null;

  // Try with % wrapping for partial match
  rows = await db
    .select({ id: cards.id, cardType: cards.cardType, domain: cards.domain })
    .from(cards)
    .where(ilike(cards.cleanName, `%${cleaned}%`))
    .limit(1);

  if (rows.length > 0) return rows[0] ?? null;

  // Try removing common articles ("the", "of", "a") for looser match
  const loose = cleaned
    .replace(/\bthe\b/gi, '')
    .replace(/\bof\b/gi, '')
    .replace(/\ba\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (loose !== cleaned) {
    rows = await db
      .select({ id: cards.id, cardType: cards.cardType, domain: cards.domain })
      .from(cards)
      .where(ilike(cards.cleanName, `%${loose}%`))
      .limit(1);

    if (rows.length > 0) return rows[0] ?? null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main import logic
// ---------------------------------------------------------------------------

async function scrapeAndImport(databaseUrl: string): Promise<void> {
  const db = createDbClient(databaseUrl);

  // ------------------------------------------------------------------
  // Step 1: Ensure system user exists
  // ------------------------------------------------------------------
  let systemUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, SYSTEM_USERNAME))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!systemUser) {
    console.log('Creating system user...');
    const [created] = await db
      .insert(users)
      .values({
        username: SYSTEM_USERNAME,
        email: 'system@la-grieta.app',
        passwordHash: '$invalid$',
        displayName: 'La Grieta',
      })
      .returning({ id: users.id });
    if (!created) throw new Error('Failed to create system user');
    systemUser = created;
    console.log(`System user created: ${systemUser.id}`);
  } else {
    console.log(`System user found: ${systemUser.id}`);
  }

  const systemUserId = systemUser.id;

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkippedDecks = 0;
  const unmatchedCardNames = new Set<string>();

  // ------------------------------------------------------------------
  // Step 2: Process each article
  // ------------------------------------------------------------------
  for (const article of TOURNAMENT_ARTICLES) {
    console.log(`\n=== ${article.tournament} (${article.region}) ===`);

    let bodyHtml: string;
    try {
      bodyHtml = await fetchArticleBody(article.url);
    } catch (err) {
      console.error(`  Failed to fetch article: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const parsedDecks = parseArticleBody(bodyHtml);
    console.log(`  Found ${parsedDecks.length} decklist(s)`);

    if (parsedDecks.length === 0) {
      console.warn('  No decklists parsed — HTML structure may have changed');
      continue;
    }

    // ------------------------------------------------------------------
    // Step 3: Import each decklist
    // ------------------------------------------------------------------
    for (const parsed of parsedDecks) {
      const legendLabel = parsed.legendName ?? 'Unknown Legend';
      const placementLabel = parsed.placement !== null ? `#${parsed.placement}` : 'unranked';
      const stableName = `[Official] ${legendLabel} by Player ${placementLabel} - ${article.tournament}`.slice(0, 100);

      console.log(`\n  Processing: ${stableName}`);
      console.log(`    Legend: ${parsed.legendName ?? 'none'}`);
      console.log(`    Champion: ${parsed.championName ?? 'none'}`);
      console.log(`    Main deck entries: ${parsed.mainDeck.length}`);
      console.log(`    Runes: ${parsed.runes.length}`);
      console.log(`    Battlefields: ${parsed.battlefields.length}`);
      console.log(`    Sideboard: ${parsed.sideboard.length}`);

      // ------------------------------------------------------------------
      // Step 3a: Resolve all card names to DB card rows
      // ------------------------------------------------------------------
      // Collect all names we need to look up
      const allEntries: Array<{ name: string; quantity: number; sourceZone: 'legend' | 'champion' | 'main' | 'rune' | 'battlefield' | 'sideboard' }> = [];

      if (parsed.legendName) {
        allEntries.push({ name: parsed.legendName, quantity: 1, sourceZone: 'legend' });
      }
      if (parsed.championName) {
        allEntries.push({ name: parsed.championName, quantity: 1, sourceZone: 'champion' });
      }
      for (const e of parsed.mainDeck) {
        allEntries.push({ name: e.name, quantity: e.quantity, sourceZone: 'main' });
      }
      for (const e of parsed.runes) {
        allEntries.push({ name: e.name, quantity: e.quantity, sourceZone: 'rune' });
      }
      for (const bf of parsed.battlefields) {
        allEntries.push({ name: bf, quantity: 1, sourceZone: 'battlefield' });
      }
      for (const e of parsed.sideboard) {
        allEntries.push({ name: e.name, quantity: e.quantity, sourceZone: 'sideboard' });
      }

      // Resolve each name, de-duplicate lookups
      const nameToCard = new Map<string, { id: string; cardType: string; domain: string } | null>();
      for (const entry of allEntries) {
        if (!nameToCard.has(entry.name)) {
          const card = await findCardByName(db, entry.name);
          nameToCard.set(entry.name, card);
          if (!card) {
            console.warn(`    [UNMATCHED] "${entry.name}"`);
            unmatchedCardNames.add(entry.name);
          }
        }
      }

      // Build the flat deckCardValues list
      type DeckCardValue = { deckId: string; cardId: string; quantity: number; zone: string };
      const deckCardValues: DeckCardValue[] = [];
      let thisSkipped = 0;
      let championAssigned = false;

      for (const entry of allEntries) {
        const card = nameToCard.get(entry.name);
        if (!card) {
          thisSkipped++;
          continue;
        }

        let zone: string = entry.sourceZone;

        // For cards explicitly sourced from main/sideboard, double-check zone using cardType
        // (e.g., if a Rune card ended up in mainDeck list due to parsing, correct it)
        if (entry.sourceZone === 'main') {
          const inferredZone = getZoneForCardType(card.cardType);
          // Only override if it's a zone-specific type (legend, rune, battlefield)
          if (inferredZone !== 'main') {
            zone = inferredZone;
          }
        }

        // Champion Unit: first occurrence → champion zone, rest → main
        if (entry.sourceZone === 'champion') {
          if (!championAssigned) {
            championAssigned = true;
            deckCardValues.push({ deckId: '', cardId: card.id, quantity: 1, zone: 'champion' });
            if (entry.quantity > 1) {
              deckCardValues.push({ deckId: '', cardId: card.id, quantity: entry.quantity - 1, zone: 'main' });
            }
          } else {
            // Subsequent champion entries go to main
            deckCardValues.push({ deckId: '', cardId: card.id, quantity: entry.quantity, zone: 'main' });
          }
          continue;
        }

        deckCardValues.push({ deckId: '', cardId: card.id, quantity: entry.quantity, zone });
      }

      if (thisSkipped > 0) {
        console.log(`    Skipped ${thisSkipped} unmatched card(s)`);
      }

      // Determine cover card (prefer legend, then first card)
      const legendEntry = deckCardValues.find((v) => v.zone === 'legend');
      const coverCardId = legendEntry?.cardId ?? deckCardValues[0]?.cardId ?? null;

      // Derive deck domain from the legend card
      const legendCard = parsed.legendName ? nameToCard.get(parsed.legendName) : null;
      const domain = legendCard?.domain ?? null;

      // ------------------------------------------------------------------
      // Step 3b: Upsert the deck
      // ------------------------------------------------------------------
      const existing = await db
        .select({ id: decks.id })
        .from(decks)
        .where(and(eq(decks.name, stableName), eq(decks.userId, systemUserId)))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      let deckId: string;

      if (existing) {
        await db
          .update(decks)
          .set({
            description: `Official tournament deck from ${article.tournament} — ${article.url}`,
            isPublic: true,
            domain,
            tournament: article.tournament,
            region: article.region,
            placement: parsed.placement,
            coverCardId,
            updatedAt: new Date(),
          })
          .where(eq(decks.id, existing.id));

        await db.delete(deckCards).where(eq(deckCards.deckId, existing.id));

        deckId = existing.id;
        totalUpdated++;
        console.log(`    Updated: ${stableName}`);
      } else {
        const [createdDeck] = await db
          .insert(decks)
          .values({
            userId: systemUserId,
            name: stableName,
            description: `Official tournament deck from ${article.tournament} — ${article.url}`,
            isPublic: true,
            domain,
            tournament: article.tournament,
            region: article.region,
            placement: parsed.placement,
            coverCardId,
          })
          .returning({ id: decks.id });

        if (!createdDeck) {
          console.error(`    Failed to create deck: ${stableName}`);
          totalSkippedDecks++;
          continue;
        }

        deckId = createdDeck.id;
        totalCreated++;
        console.log(`    Created: ${stableName}`);
      }

      // Assign deckId to all card rows and insert
      const finalCardValues = deckCardValues.map((v) => ({ ...v, deckId }));
      if (finalCardValues.length > 0) {
        await db.insert(deckCards).values(finalCardValues);
      }

      // Compute status via validateDeckFormat
      const cardTypeMap = new Map<string, string | null>(
        finalCardValues.map((v) => {
          const found = [...nameToCard.values()].find((c) => c?.id === v.cardId);
          return [v.cardId, found?.cardType ?? null];
        }),
      );

      const errors = validateDeckFormat(finalCardValues, cardTypeMap);
      const status = errors.length === 0 ? 'complete' : 'draft';
      await db.update(decks).set({ status }).where(eq(decks.id, deckId));

      if (errors.length > 0) {
        console.log(`    Status: draft (${errors.join(', ')})`);
      } else {
        console.log(`    Status: complete`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n=== Import Complete ===');
  console.log(`  Created:        ${totalCreated}`);
  console.log(`  Updated:        ${totalUpdated}`);
  console.log(`  Skipped decks:  ${totalSkippedDecks}`);
  console.log(`  Unmatched card names (${unmatchedCardNames.size}):`);
  for (const name of [...unmatchedCardNames].sort()) {
    console.log(`    - ${name}`);
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const databaseUrl = requireEnv('DATABASE_URL');
  await scrapeAndImport(databaseUrl);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Official tournament scrape failed:', err);
  process.exit(1);
});
