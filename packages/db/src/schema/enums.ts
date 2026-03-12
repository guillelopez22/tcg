import { pgEnum } from 'drizzle-orm/pg-core';

export const cardConditionEnum = pgEnum('card_condition', [
  'mint',
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
]);

export const cardVariantEnum = pgEnum('card_variant', [
  'normal',
  'alt_art',
  'overnumbered',
  'signature',
]);

export const wishlistTypeEnum = pgEnum('wishlist_type', ['want', 'trade']);

export const listingStatusEnum = pgEnum('listing_status', [
  'active',
  'sold',
  'cancelled',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'completed',
  'disputed',
  'cancelled',
  'refunded',
]);
