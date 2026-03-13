import { z } from 'zod';
export declare const cardListSchema: z.ZodObject<{
    setSlug: z.ZodOptional<z.ZodString>;
    rarity: z.ZodOptional<z.ZodEnum<["Common", "Uncommon", "Rare", "Epic"]>>;
    cardType: z.ZodOptional<z.ZodString>;
    domain: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    includeProducts: z.ZodDefault<z.ZodBoolean>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    includeProducts: boolean;
    search?: string | undefined;
    rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | undefined;
    cardType?: string | undefined;
    domain?: string | undefined;
    setSlug?: string | undefined;
    cursor?: string | undefined;
}, {
    search?: string | undefined;
    rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | undefined;
    cardType?: string | undefined;
    domain?: string | undefined;
    limit?: number | undefined;
    setSlug?: string | undefined;
    includeProducts?: boolean | undefined;
    cursor?: string | undefined;
}>;
export declare const cardGetByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const cardGetByExternalIdSchema: z.ZodObject<{
    externalId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    externalId: string;
}, {
    externalId: string;
}>;
export declare const cardSyncSchema: z.ZodObject<{
    lastSyncHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    lastSyncHash?: string | undefined;
}, {
    lastSyncHash?: string | undefined;
}>;
export declare const cardOutputSchema: z.ZodObject<{
    id: z.ZodString;
    externalId: z.ZodString;
    number: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    cleanName: z.ZodString;
    setId: z.ZodString;
    rarity: z.ZodString;
    cardType: z.ZodString;
    domain: z.ZodString;
    energyCost: z.ZodNullable<z.ZodNumber>;
    powerCost: z.ZodNullable<z.ZodNumber>;
    might: z.ZodNullable<z.ZodNumber>;
    description: z.ZodNullable<z.ZodString>;
    flavorText: z.ZodNullable<z.ZodString>;
    imageSmall: z.ZodNullable<z.ZodString>;
    imageLarge: z.ZodNullable<z.ZodString>;
    tcgplayerId: z.ZodNullable<z.ZodNumber>;
    tcgplayerUrl: z.ZodNullable<z.ZodString>;
    isProduct: z.ZodBoolean;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    number: string;
    id: string;
    name: string;
    externalId: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    cleanName: string;
    setId: string;
    rarity: string;
    cardType: string;
    domain: string;
    energyCost: number | null;
    powerCost: number | null;
    might: number | null;
    flavorText: string | null;
    imageSmall: string | null;
    imageLarge: string | null;
    tcgplayerId: number | null;
    tcgplayerUrl: string | null;
    isProduct: boolean;
}, {
    number: string;
    id: string;
    name: string;
    externalId: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    code: string;
    cleanName: string;
    setId: string;
    rarity: string;
    cardType: string;
    domain: string;
    energyCost: number | null;
    powerCost: number | null;
    might: number | null;
    flavorText: string | null;
    imageSmall: string | null;
    imageLarge: string | null;
    tcgplayerId: number | null;
    tcgplayerUrl: string | null;
    isProduct: boolean;
}>;
export declare const collectionConditionSchema: z.ZodEnum<["near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"]>;
export type CardListInput = z.infer<typeof cardListSchema>;
export type CardGetByIdInput = z.infer<typeof cardGetByIdSchema>;
export type CardGetByExternalIdInput = z.infer<typeof cardGetByExternalIdSchema>;
export type CardSyncInput = z.infer<typeof cardSyncSchema>;
export type CardOutput = z.infer<typeof cardOutputSchema>;
