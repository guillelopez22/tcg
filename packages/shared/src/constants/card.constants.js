export const CARD_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Alternate Art', 'Overnumbered'];
export const CARD_TYPES = [
    'Unit',
    'Champion Unit',
    'Spell',
    'Legend',
    'Signature Unit',
    'Signature Spell',
    'Gear',
    'Signature Gear',
    'Rune',
    'Battlefield',
    'Token',
];
export const CARD_DOMAINS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
export const CARD_CONDITIONS = [
    'near_mint',
    'lightly_played',
    'moderately_played',
    'heavily_played',
    'damaged',
];
export const CARD_VARIANTS = ['normal', 'alt_art', 'overnumbered', 'signature'];
export const WISHLIST_TYPES = ['want', 'trade'];
/**
 * Maps a card variant to the card_prices column to use for market value.
 * normal -> marketPrice (non-foil market price)
 * alt_art, overnumbered, signature -> foilMarketPrice (foil market price)
 */
export const FOIL_VARIANTS = new Set(['alt_art', 'overnumbered', 'signature']);
export function isFoilVariant(variant) {
    return FOIL_VARIANTS.has(variant);
}
// Deck zones
export const DECK_ZONES = ['main', 'rune', 'legend', 'champion', 'battlefield', 'sideboard'];
// Riftbound deck size limits
export const MAX_COPIES_PER_CARD = 3;
export const MAX_SIGNATURE_COPIES = 3;
/** Total main deck size: legend (1) + champion (1) + main zone cards = 40 */
export const MAIN_DECK_SIZE = 40;
export const RUNE_DECK_SIZE = 12;
export const LEGEND_COUNT = 1;
export const CHAMPION_COUNT = 1;
export const BATTLEFIELD_COUNT = 3;
export const SIDEBOARD_SIZE = 8;
// Card types that go in specific zones
export const SIGNATURE_TYPES = ['Signature Unit', 'Signature Spell', 'Signature Gear'];
/**
 * Returns the default deck zone for a given card type.
 * Legend → legend zone, Rune → rune zone, Battlefield → battlefield zone.
 * Champion Units default to main — only ONE is manually designated
 * as the chosen champion (champion zone). The rest are regular main-deck units.
 * Everything else → main zone.
 */
export function getZoneForCardType(cardType) {
    if (cardType === 'Legend')
        return 'legend';
    if (cardType === 'Rune')
        return 'rune';
    if (cardType === 'Battlefield')
        return 'battlefield';
    return 'main';
}
