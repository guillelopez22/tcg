"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoDetectAndParse = void 0;
// Patterns for quantity + card name
const QTY_PREFIX_RE = /^(\d+)x?\s+(.+)$/i;
function detectZone(line) {
    const ZONE_HEADER_RE = /^(champions?|legends?|runes?|mains?(?:\s+decks?)?|sideboards?)[:\s]*$/i;
    const m = ZONE_HEADER_RE.exec(line.trim());
    if (!m)
        return null;
    const token = m[1].toLowerCase().replace(/\s+/g, '').replace(/s$/, '');
    if (token === 'champion' || token === 'legend')
        return 'champion';
    if (token === 'rune')
        return 'rune';
    if (token === 'main' || token === 'maindeck' || token === 'sideboard')
        return 'main';
    return null;
}
function detectFormat(text) {
    if (text.includes('## '))
        return 'piltover-archive';
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        if (QTY_PREFIX_RE.test(trimmed))
            return 'riftbound-gg';
        if (/^(.+?)\s+x(\d+)$/i.test(trimmed))
            return 'riftbound-gg';
    }
    return 'unknown';
}
function autoDetectAndParse(text) {
    const format = detectFormat(text);
    const entries = [];
    const unmatched = [];
    let currentZone = 'main';
    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line)
            continue;
        // Check for zone header
        const zoneFromHeader = detectZone(line);
        if (zoneFromHeader !== null) {
            currentZone = zoneFromHeader;
            continue;
        }
        // Handle markdown-style headers
        const mdHeaderMatch = /^##\s+(.+)$/.exec(line);
        if (mdHeaderMatch) {
            const headerText = mdHeaderMatch[1].trim();
            const zoneFromMd = detectZone(headerText);
            if (zoneFromMd !== null) {
                currentZone = zoneFromMd;
            }
            continue;
        }
        // Try prefix pattern: "3x Card Name" or "3 Card Name"
        const prefixMatch = QTY_PREFIX_RE.exec(line);
        if (prefixMatch) {
            const quantity = parseInt(prefixMatch[1], 10);
            const cardName = prefixMatch[2].trim();
            entries.push({ quantity, cardName, zone: currentZone });
            continue;
        }
        // Try suffix pattern: "Card Name x3"
        const suffixMatch = /^(.+?)\s+x(\d+)$/i.exec(line);
        if (suffixMatch) {
            const quantity = parseInt(suffixMatch[2], 10);
            const cardName = suffixMatch[1].trim();
            entries.push({ quantity, cardName, zone: currentZone });
            continue;
        }
        // Could not parse — add to unmatched
        unmatched.push(line);
    }
    return { entries, format, unmatched };
}
exports.autoDetectAndParse = autoDetectAndParse;
