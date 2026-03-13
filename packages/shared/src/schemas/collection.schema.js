import { z } from 'zod';
import { CARD_RARITIES, CARD_CONDITIONS, CARD_VARIANTS } from '../constants/card.constants';
export const collectionListSchema = z.object({
    setSlug: z.string().optional(),
    rarity: z.enum(CARD_RARITIES).optional(),
    variant: z.enum(CARD_VARIANTS).optional(),
    condition: z.enum(CARD_CONDITIONS).optional(),
    domain: z.string().optional(),
    sortBy: z.enum(['name', 'date_added', 'price', 'set_number']).default('date_added'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    cursor: z.string().uuid().optional(),
    limit: z.number().min(1).max(100).default(20),
});
export const collectionAddSchema = z.object({
    cardId: z.string().uuid(),
    variant: z.enum(CARD_VARIANTS).default('normal'),
    condition: z.enum(CARD_CONDITIONS).default('near_mint'),
    notes: z.string().max(500).optional(),
});
export const collectionUpdateSchema = z.object({
    id: z.string().uuid(),
    variant: z.enum(CARD_VARIANTS).optional(),
    condition: z.enum(CARD_CONDITIONS).optional(),
    purchasePrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
    notes: z.string().max(500).optional(),
    photoUrl: z.string().url().max(500).optional(),
    photoKey: z.string().max(500).optional(),
});
export const collectionRemoveSchema = z.object({
    id: z.string().uuid(),
});
export const collectionAddBulkSchema = z.object({
    entries: z
        .array(z.object({
        cardId: z.string().uuid(),
        variant: z.enum(CARD_VARIANTS).default('normal'),
        condition: z.enum(CARD_CONDITIONS).default('near_mint'),
    }))
        .max(50),
});
export const collectionGetByCardSchema = z.object({
    cardId: z.string().uuid(),
});
