import { z } from 'zod';
import { CARD_RARITIES, CARD_CONDITIONS } from '../constants/card.constants';
export const cardPriceOutputSchema = z.object({
    id: z.string().uuid(),
    cardId: z.string().uuid(),
    tcgplayerProductId: z.number(),
    lowPrice: z.string().nullable(),
    midPrice: z.string().nullable(),
    highPrice: z.string().nullable(),
    marketPrice: z.string().nullable(),
    directLowPrice: z.string().nullable(),
    foilLowPrice: z.string().nullable(),
    foilMidPrice: z.string().nullable(),
    foilHighPrice: z.string().nullable(),
    foilMarketPrice: z.string().nullable(),
    foilDirectLowPrice: z.string().nullable(),
    updatedAt: z.date(),
    createdAt: z.date(),
});
export const cardListSchema = z.object({
    setSlug: z.string().optional(),
    rarity: z.enum(CARD_RARITIES).optional(),
    cardType: z.string().optional(),
    domain: z.string().optional(),
    search: z.string().max(100).optional(),
    includeProducts: z.boolean().default(false),
    cursor: z.string().uuid().optional(),
    limit: z.number().min(1).max(100).default(20),
});
export const cardGetByIdSchema = z.object({
    id: z.string().uuid(),
});
export const cardGetByExternalIdSchema = z.object({
    externalId: z.string(),
});
export const cardSyncSchema = z.object({
    lastSyncHash: z.string().optional(),
});
export const cardGetPriceSchema = z.object({
    cardId: z.string().uuid(),
});
export const cardOutputSchema = z.object({
    id: z.string().uuid(),
    externalId: z.string(),
    number: z.string(),
    code: z.string(),
    name: z.string(),
    cleanName: z.string(),
    setId: z.string().uuid(),
    rarity: z.string(),
    cardType: z.string(),
    domain: z.string(),
    energyCost: z.number().nullable(),
    powerCost: z.number().nullable(),
    might: z.number().nullable(),
    description: z.string().nullable(),
    flavorText: z.string().nullable(),
    imageSmall: z.string().nullable(),
    imageLarge: z.string().nullable(),
    tcgplayerId: z.number().nullable(),
    tcgplayerUrl: z.string().nullable(),
    isProduct: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
export const collectionConditionSchema = z.enum(CARD_CONDITIONS);
