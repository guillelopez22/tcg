/**
 * deck-import-parser — Pure text parser for external deck format imports.
 *
 * Supports heuristic format detection (riftbound-gg, piltover-archive, unknown)
 * and zone assignment from section headers.
 */

export interface ParsedDeckEntry {
  quantity: number;
  cardName: string;
  zone: 'main' | 'rune' | 'champion';
}

export interface ParseResult {
  entries: ParsedDeckEntry[];
  format: 'riftbound-gg' | 'piltover-archive' | 'unknown';
  unmatched: string[];
}

// Patterns for quantity + card name
// Supports: "3x Card Name", "3 Card Name", "Card Name x3", "Card Name 3"
const QTY_PREFIX_RE = /^(\d+)x?\s+(.+)$/i;
const QTY_SUFFIX_RE = /^(.+?)\s+x?(\d+)$/i;

// Zone header patterns — lines that set the current zone context
// Supports singular and plural forms: "Champion:", "Champions:", "Rune:", "Runes:", "Main Deck:", etc.
const ZONE_HEADER_RE = /^(champions?|legends?|runes?|mains?(?:\s+decks?)?|sideboards?)[:\s]*$/i;

function detectZone(line: string): 'main' | 'rune' | 'champion' | null {
  const m = ZONE_HEADER_RE.exec(line.trim());
  if (!m) return null;
  const token = m[1]!.toLowerCase().replace(/\s+/g, '').replace(/s$/, ''); // normalize plurals
  if (token === 'champion' || token === 'legend') return 'champion';
  if (token === 'rune') return 'rune';
  if (token === 'main' || token === 'maindeck' || token === 'sideboard') return 'main';
  return null;
}

function detectFormat(text: string): 'riftbound-gg' | 'piltover-archive' | 'unknown' {
  if (text.includes('## ')) return 'piltover-archive';
  // If there are any parseable qty+name lines, treat as riftbound-gg
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (QTY_PREFIX_RE.test(trimmed) || QTY_SUFFIX_RE.test(trimmed)) {
      return 'riftbound-gg';
    }
  }
  return 'unknown';
}

/**
 * Parses a deck list text into structured entries with zone, quantity, and card name.
 *
 * Format detection heuristics:
 * - "## " markdown headers → piltover-archive
 * - Lines with quantity patterns → riftbound-gg
 * - Otherwise → unknown
 *
 * Lines that cannot be parsed are collected in `unmatched` — nothing is silently dropped.
 */
export function autoDetectAndParse(text: string): ParseResult {
  const format = detectFormat(text);
  const entries: ParsedDeckEntry[] = [];
  const unmatched: string[] = [];

  let currentZone: 'main' | 'rune' | 'champion' = 'main';

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines
    if (!line) continue;

    // Check for zone header
    const zoneFromHeader = detectZone(line);
    if (zoneFromHeader !== null) {
      currentZone = zoneFromHeader;
      continue;
    }

    // Also handle markdown-style headers (## Champion, ## Runes, ## Main Deck)
    const mdHeaderMatch = /^##\s+(.+)$/.exec(line);
    if (mdHeaderMatch) {
      const headerText = mdHeaderMatch[1]!.trim();
      const zoneFromMd = detectZone(headerText);
      if (zoneFromMd !== null) {
        currentZone = zoneFromMd;
      }
      // Don't add the header to unmatched — it's structural
      continue;
    }

    // Try prefix pattern: "3x Card Name" or "3 Card Name"
    const prefixMatch = QTY_PREFIX_RE.exec(line);
    if (prefixMatch) {
      const quantity = parseInt(prefixMatch[1]!, 10);
      const cardName = prefixMatch[2]!.trim();
      entries.push({ quantity, cardName, zone: currentZone });
      continue;
    }

    // Try suffix pattern: "Card Name x3" or "Card Name 3"
    // Only if the trailing number is clearly a quantity (not part of the card name)
    // We require x-prefix or the number to be at the very end after whitespace
    const suffixMatch = /^(.+?)\s+x(\d+)$/i.exec(line);
    if (suffixMatch) {
      const quantity = parseInt(suffixMatch[2]!, 10);
      const cardName = suffixMatch[1]!.trim();
      entries.push({ quantity, cardName, zone: currentZone });
      continue;
    }

    // Could not parse this line — add to unmatched (never silently drop)
    unmatched.push(line);
  }

  return { entries, format, unmatched };
}
