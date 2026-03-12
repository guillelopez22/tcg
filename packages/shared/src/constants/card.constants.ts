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
