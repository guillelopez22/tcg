/**
 * Scraper library for riftdecks.com
 *
 * Exports functions to fetch and parse deck data from the community site.
 * Uses cheerio for HTML parsing, native fetch for HTTP.
 * Includes a 500ms polite delay between requests.
 */

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://riftdecks.com';

const USER_AGENT = 'La Grieta Deck Sync/1.0 (+https://lagrieta.app)';

const REQUEST_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChampionEntry {
  slug: string;
  name: string;
  tier: string;
}

export interface DeckLink {
  url: string;
  name: string;
}

export interface ScrapedCard {
  externalId: string;
  quantity: number;
  cardType: string;
}

export interface ScrapedDeck {
  name: string;
  champion: string;
  domain: string;
  cards: ScrapedCard[];
  sourceUrl: string;
}

export interface TournamentEntry {
  name: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  return response.text();
}

/**
 * Convert a riftdecks.com image path to our DB externalId format.
 *
 * Examples:
 *   /img/cards/riftbound/OGN/ogn-185-298_full.png → origins-185-298
 *   /img/cards/riftbound/SFD/sfd-020a-221_full.png → spiritforged-020a-221
 *   /img/cards/riftbound/OPG/opg-010-123_full.png → origins-proving-grounds-010-123
 */
export function mapImagePathToExternalId(imagePath: string): string {
  // Extract filename from path: /img/cards/riftbound/OGN/ogn-185-298_full.png → ogn-185-298_full.png
  const parts = imagePath.split('/');
  const filename = parts[parts.length - 1] ?? '';
  const setDir = parts[parts.length - 2] ?? '';

  // Strip _full.png suffix
  const withoutSuffix = filename.replace(/_full\.png$/, '').replace(/\.png$/, '');

  // Map the set directory code to the full set slug prefix used in externalIds
  const setDirUpper = setDir.toUpperCase();
  const setCodeMap: Record<string, string> = {
    OGN: 'origins',
    SFD: 'spiritforged',
    OPG: 'origins-proving-grounds',
  };

  const setSlug = setCodeMap[setDirUpper];
  if (!setSlug) {
    // Unknown set — return as-is, lowercase
    return withoutSuffix.toLowerCase();
  }

  // The filename starts with the lowercase set prefix (e.g. "ogn-", "sfd-", "opg-")
  // Replace that prefix with the full slug
  const setCodePrefixMap: Record<string, string> = {
    OGN: 'ogn-',
    SFD: 'sfd-',
    OPG: 'opg-',
  };
  const shortPrefix = setCodePrefixMap[setDirUpper] ?? '';
  if (shortPrefix && withoutSuffix.toLowerCase().startsWith(shortPrefix)) {
    const cardPart = withoutSuffix.slice(shortPrefix.length);
    return `${setSlug}-${cardPart}`;
  }

  return withoutSuffix.toLowerCase();
}

// ---------------------------------------------------------------------------
// Scraper functions
// ---------------------------------------------------------------------------

/**
 * Fetch /stats/tier-list and return all champion entries with their tier.
 *
 * Page structure: a table where each row contains:
 *   <td><a href="/legends/{slug}">Champion Name</a></td>
 *   <td><span class="badge bg-azure">S</span></td>   (or bg-green=A, bg-yellow=B, bg-orange=C)
 */
export async function scrapeTierListChampions(): Promise<ChampionEntry[]> {
  const html = await fetchHtml(`${BASE_URL}/stats/tier-list`);
  const $ = cheerio.load(html);
  const champions: ChampionEntry[] = [];

  // Map badge CSS classes to tier letters
  const badgeTierMap: Record<string, string> = {
    'bg-azure': 'S',
    'bg-green': 'A',
    'bg-yellow': 'B',
    'bg-orange': 'C',
  };

  // Each champion is in a table row with a link to /legends/{slug}
  $('a[href^="/legends/"]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    const slug = href.replace('/legends/', '').split('?')[0] ?? '';
    if (!slug) return;

    // Find the containing row (<tr>) and look for a tier badge
    const row = $(el).closest('tr');
    let tier = 'unknown';

    row.find('span.badge').each((_j, badge) => {
      const classes = $(badge).attr('class') ?? '';
      for (const [cssClass, tierLetter] of Object.entries(badgeTierMap)) {
        if (classes.includes(cssClass) && !classes.includes(`${cssClass}-lt`)) {
          tier = tierLetter;
          return false; // break
        }
      }
    });

    const name = $(el).text().trim() || slug;

    if (!champions.find((c) => c.slug === slug)) {
      champions.push({ slug, name, tier });
    }
  });

  return champions;
}

/**
 * Fetch /legends/{slug} and return the top N deck links.
 */
export async function scrapeChampionDecks(
  championSlug: string,
  limit = 3,
): Promise<DeckLink[]> {
  await delay(REQUEST_DELAY_MS);
  const html = await fetchHtml(`${BASE_URL}/legends/${championSlug}`);
  const $ = cheerio.load(html);
  const deckLinks: DeckLink[] = [];

  // Deck pages link to /riftbound-metagame/deck-{slug}-{id}
  $('a[href*="/riftbound-metagame/deck-"]').each((_i, el) => {
    if (deckLinks.length >= limit) return false;
    const href = $(el).attr('href') ?? '';
    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const name = $(el).text().trim() || href;
    if (!deckLinks.find((d) => d.url === url)) {
      deckLinks.push({ url, name });
    }
    return;
  });

  return deckLinks.slice(0, limit);
}

/**
 * Fetch a deck page and parse its card list.
 *
 * Card rows have the structure:
 *   <tr class="card-list-item"
 *       data-card-type="unit"
 *       data-quantity="3"
 *       data-image-src="/img/cards/riftbound/OGN/ogn-185-298_full.png">
 *     <td>...</td>
 *   </tr>
 */
export async function scrapeDeckPage(deckUrl: string): Promise<ScrapedDeck | null> {
  await delay(REQUEST_DELAY_MS);

  let html: string;
  try {
    html = await fetchHtml(deckUrl);
  } catch (err) {
    console.warn(`Failed to fetch deck page ${deckUrl}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  const $ = cheerio.load(html);

  // Deck name: try <h1> first, then <title>
  const deckName =
    $('h1').first().text().trim() ||
    $('title').text().replace('| Riftdecks', '').replace('| riftdecks.com', '').trim();

  if (!deckName) {
    console.warn(`Could not determine deck name for ${deckUrl}`);
    return null;
  }

  // Champion: look for a link to /legends/ on the page
  let champion = '';
  $('a[href^="/legends/"]').each((_i, el) => {
    if (!champion) {
      champion = $(el).text().trim();
    }
  });

  // Domain: look for a data-domain attribute or a domain badge element
  let domain = '';
  const domainEl = $('[data-domain], [class*="domain-badge"], [class*="Domain"]').first();
  if (domainEl.length) {
    domain = domainEl.attr('data-domain') ?? domainEl.text().trim();
  }

  // Cards: parse card-list-item rows
  const cards: ScrapedCard[] = [];
  const seen = new Set<string>();

  $('tr.card-list-item').each((_i, el) => {
    const imageSrc = $(el).attr('data-image-src') ?? '';
    const quantityStr = $(el).attr('data-quantity') ?? '1';
    const cardType = $(el).attr('data-card-type') ?? 'unknown';

    if (!imageSrc) return;

    const externalId = mapImagePathToExternalId(imageSrc);
    if (!externalId || seen.has(externalId)) return;

    seen.add(externalId);
    const quantity = parseInt(quantityStr, 10);
    cards.push({
      externalId,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      cardType,
    });
  });

  if (cards.length === 0) {
    console.warn(`No cards parsed from deck page ${deckUrl}`);
    return null;
  }

  return {
    name: deckName,
    champion,
    domain,
    cards,
    sourceUrl: deckUrl,
  };
}

/**
 * Fetch /riftbound-tournaments and return the top N recent tournament URLs.
 */
export async function scrapeRecentTournaments(limit = 3): Promise<TournamentEntry[]> {
  await delay(REQUEST_DELAY_MS);
  const html = await fetchHtml(`${BASE_URL}/riftbound-tournaments`);
  const $ = cheerio.load(html);
  const tournaments: TournamentEntry[] = [];

  // Tournament links: look for links to /riftbound-tournaments/{slug} or similar
  $('a[href*="/riftbound-tournaments/"]').each((_i, el) => {
    if (tournaments.length >= limit) return false;
    const href = $(el).attr('href') ?? '';
    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const name = $(el).text().trim() || href;
    if (!tournaments.find((t) => t.url === url)) {
      tournaments.push({ url, name });
    }
    return;
  });

  return tournaments.slice(0, limit);
}

/**
 * Scrape deck links from a tournament page.
 * Looks for links to /riftbound-metagame/deck-* pages.
 */
export async function scrapeTournamentDecks(
  tournamentUrl: string,
  limit = 8,
): Promise<DeckLink[]> {
  await delay(REQUEST_DELAY_MS);
  const html = await fetchHtml(tournamentUrl);
  const $ = cheerio.load(html);
  const deckLinks: DeckLink[] = [];

  $('a[href*="/riftbound-metagame/deck-"]').each((_i, el) => {
    if (deckLinks.length >= limit) return false;
    const href = $(el).attr('href') ?? '';
    const url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    const name = $(el).text().trim() || href;
    if (!deckLinks.find((d) => d.url === url)) {
      deckLinks.push({ url, name });
    }
    return;
  });

  return deckLinks.slice(0, limit);
}
