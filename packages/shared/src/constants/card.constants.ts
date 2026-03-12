export const CARD_RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Alternate Art', 'Overnumbered'] as const;
export type CardRarity = (typeof CARD_RARITIES)[number];

export const CARD_TYPES = [
  'Unit',
  'Champion Unit',
  'Spell',
  'Legend',
  'Signature Unit',
  'Signature Spell',
  'Gear',
  'Signature Gear',
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_DOMAINS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'] as const;
export type CardDomain = (typeof CARD_DOMAINS)[number];

export const CARD_CONDITIONS = [
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const CARD_VARIANTS = ['normal', 'alt_art', 'overnumbered', 'signature'] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export const WISHLIST_TYPES = ['want', 'trade'] as const;
export type WishlistType = (typeof WISHLIST_TYPES)[number];

/**
 * Maps a card variant to the card_prices column to use for market value.
 * normal -> marketPrice (non-foil market price)
 * alt_art, overnumbered, signature -> foilMarketPrice (foil market price)
 */
export const FOIL_VARIANTS: ReadonlySet<CardVariant> = new Set(['alt_art', 'overnumbered', 'signature'] as const);

export function isFoilVariant(variant: string): boolean {
  return FOIL_VARIANTS.has(variant as CardVariant);
}

// Deck zones
export const DECK_ZONES = ['main', 'rune', 'champion', 'sideboard'] as const;
export type DeckZone = (typeof DECK_ZONES)[number];

// Riftbound deck size limits
export const MAX_COPIES_PER_CARD = 3;
export const MAX_SIGNATURE_COPIES = 1;
export const MAIN_DECK_SIZE = 40;
export const RUNE_DECK_SIZE = 12;
export const CHAMPION_COUNT = 1;
export const SIDEBOARD_SIZE = 8;

// Card types that go in specific zones
export const SIGNATURE_TYPES = ['Signature Unit', 'Signature Spell', 'Signature Gear'] as const;
export type SignatureType = (typeof SIGNATURE_TYPES)[number];

/**
 * Returns the default deck zone for a given card type.
 * Legend cards go in the champion zone.
 * Rune cards go in the rune zone.
 * Everything else (Unit, Champion Unit, Spell, Gear, Signature cards) goes in main.
 */
export function getZoneForCardType(cardType: string | null): DeckZone {
  if (cardType === 'Legend') return 'champion';
  if (cardType === 'Rune') return 'rune';
  return 'main';
}
