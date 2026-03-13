import { z } from 'zod';
import { CARD_VARIANTS, WISHLIST_TYPES } from '../constants/card.constants';
export const wishlistToggleSchema = z.object({
    cardId: z.string().uuid(),
    type: z.enum(WISHLIST_TYPES),
});
export const wishlistUpdateSchema = z.object({
    id: z.string().uuid(),
    preferredVariant: z.enum(CARD_VARIANTS).optional(),
    maxPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    askingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    isPublic: z.boolean().optional(),
});
export const wishlistListSchema = z.object({
    type: z.enum(WISHLIST_TYPES),
    cursor: z.string().uuid().optional(),
    limit: z.number().min(1).max(100).default(20),
});
