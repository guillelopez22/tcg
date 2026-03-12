import { z } from 'zod';
export declare const deckCardEntrySchema: z.ZodObject<{
    cardId: z.ZodString;
    quantity: z.ZodNumber;
    zone: z.ZodDefault<z.ZodEnum<["main", "rune", "champion", "sideboard"]>>;
}, "strip", z.ZodTypeAny, {
    cardId: string;
    quantity: number;
    zone: "main" | "rune" | "champion" | "sideboard";
}, {
    cardId: string;
    quantity: number;
    zone?: "main" | "rune" | "champion" | "sideboard" | undefined;
}>;
export declare const deckListSchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export declare const deckGetByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const deckCreateSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodDefault<z.ZodBoolean>;
    coverCardId: z.ZodOptional<z.ZodString>;
    cards: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cardId: z.ZodString;
        quantity: z.ZodNumber;
        zone: z.ZodDefault<z.ZodEnum<["main", "rune", "champion", "sideboard"]>>;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
        quantity: number;
        zone: "main" | "rune" | "champion" | "sideboard";
    }, {
        cardId: string;
        quantity: number;
        zone?: "main" | "rune" | "champion" | "sideboard" | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isPublic: boolean;
    description?: string | undefined;
    coverCardId?: string | undefined;
    cards?: {
        cardId: string;
        quantity: number;
        zone: "main" | "rune" | "champion" | "sideboard";
    }[] | undefined;
}, {
    name: string;
    description?: string | undefined;
    isPublic?: boolean | undefined;
    coverCardId?: string | undefined;
    cards?: {
        cardId: string;
        quantity: number;
        zone?: "main" | "rune" | "champion" | "sideboard" | undefined;
    }[] | undefined;
}>;
export declare const deckUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    isPublic: z.ZodOptional<z.ZodBoolean>;
    coverCardId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name?: string | undefined;
    description?: string | undefined;
    coverCardId?: string | undefined;
    isPublic?: boolean | undefined;
}, {
    id: string;
    name?: string | undefined;
    description?: string | undefined;
    coverCardId?: string | undefined;
    isPublic?: boolean | undefined;
}>;
export declare const deckDeleteSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const deckSetCardsSchema: z.ZodObject<{
    deckId: z.ZodString;
    cards: z.ZodArray<z.ZodObject<{
        cardId: z.ZodString;
        quantity: z.ZodNumber;
        zone: z.ZodDefault<z.ZodEnum<["main", "rune", "champion", "sideboard"]>>;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
        quantity: number;
        zone: "main" | "rune" | "champion" | "sideboard";
    }, {
        cardId: string;
        quantity: number;
        zone?: "main" | "rune" | "champion" | "sideboard" | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    deckId: string;
    cards: {
        cardId: string;
        quantity: number;
        zone: "main" | "rune" | "champion" | "sideboard";
    }[];
}, {
    deckId: string;
    cards: {
        cardId: string;
        quantity: number;
        zone?: "main" | "rune" | "champion" | "sideboard" | undefined;
    }[];
}>;
export declare const deckBrowseSchema: z.ZodObject<{
    domain: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    championName: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    search?: string | undefined;
    domain?: string | undefined;
    championName?: string | undefined;
    cursor?: string | undefined;
}, {
    search?: string | undefined;
    domain?: string | undefined;
    championName?: string | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export declare const deckSuggestSchema: z.ZodObject<{
    deckId: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<["owned_first", "best_fit"]>>;
    zone: z.ZodDefault<z.ZodEnum<["main", "rune", "champion", "sideboard"]>>;
}, "strip", z.ZodTypeAny, {
    deckId: string;
    mode: "owned_first" | "best_fit";
    zone: "main" | "rune" | "champion" | "sideboard";
}, {
    deckId: string;
    mode?: "owned_first" | "best_fit" | undefined;
    zone?: "main" | "rune" | "champion" | "sideboard" | undefined;
}>;
export declare const deckBuildabilitySchema: z.ZodObject<{
    deckId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deckId: string;
}, {
    deckId: string;
}>;
export declare const shareCodeGenerateSchema: z.ZodObject<{
    deckId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    deckId: string;
}, {
    deckId: string;
}>;
export declare const shareCodeResolveSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export declare const deckImportTextSchema: z.ZodObject<{
    text: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    name?: string | undefined;
}, {
    text: string;
    name?: string | undefined;
}>;
export declare const deckImportUrlSchema: z.ZodObject<{
    url: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    name?: string | undefined;
}, {
    url: string;
    name?: string | undefined;
}>;
export type DeckCardEntry = z.infer<typeof deckCardEntrySchema>;
export type DeckListInput = z.infer<typeof deckListSchema>;
export type DeckGetByIdInput = z.infer<typeof deckGetByIdSchema>;
export type DeckCreateInput = z.infer<typeof deckCreateSchema>;
export type DeckUpdateInput = z.infer<typeof deckUpdateSchema>;
export type DeckDeleteInput = z.infer<typeof deckDeleteSchema>;
export type DeckSetCardsInput = z.infer<typeof deckSetCardsSchema>;
export type DeckBrowseInput = z.infer<typeof deckBrowseSchema>;
export type DeckSuggestInput = z.infer<typeof deckSuggestSchema>;
export type DeckBuildabilityInput = z.infer<typeof deckBuildabilitySchema>;
export type ShareCodeGenerateInput = z.infer<typeof shareCodeGenerateSchema>;
export type ShareCodeResolveInput = z.infer<typeof shareCodeResolveSchema>;
export type DeckImportTextInput = z.infer<typeof deckImportTextSchema>;
export type DeckImportUrlInput = z.infer<typeof deckImportUrlSchema>;
