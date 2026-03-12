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
export declare function autoDetectAndParse(text: string): ParseResult;
