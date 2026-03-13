import { z } from 'zod';
import { CARD_RARITIES, CARD_CONDITIONS } from '../constants/card.constants';
import { LISTING_STATUSES, SHIPPING_OPTIONS } from '../constants/listing.constants';

export const listingListSchema = z.object({
  cardId: z.string().uuid().optional(),
  setSlug: z.string().optional(),
  rarity: z.enum(CARD_RARITIES).optional(),
  condition: z.enum(CARD_CONDITIONS).optional(),
  city: z.string().optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'newest', 'oldest']).default('newest'),
  cursor: z.string().uuid().optional(),
  limit: z.number().min(1).max(50).default(20),
});

export const listingGetByIdSchema = z.object({
  id: z.string().uuid(),
});

export const listingCreateSchema = z.object({
  cardId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  priceInCents: z.number().int().min(25).max(1000000),
  condition: z.enum(CARD_CONDITIONS),
  quantity: z.number().int().min(1).max(99).default(1),
  imageUrls: z.array(z.string().url()).max(4).optional(),
  shippingAvailable: z.enum(SHIPPING_OPTIONS).default('local'),
});

export const listingUpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  priceInCents: z.number().int().min(25).max(1000000).optional(),
  imageUrls: z.array(z.string().url()).max(4).optional(),
  status: z.enum(['active', 'cancelled']).optional(),
});

export const myListingsSchema = z.object({
  status: z.enum(LISTING_STATUSES).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.number().min(1).max(50).default(20),
});

export type ListingListInput = z.infer<typeof listingListSchema>;
export type ListingGetByIdInput = z.infer<typeof listingGetByIdSchema>;
export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type MyListingsInput = z.infer<typeof myListingsSchema>;
