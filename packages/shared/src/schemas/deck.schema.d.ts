import { z } from 'zod';
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
    cards: z.ZodOptional<z.ZodArray<z.ZodObject<{
        cardId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
        quantity: number;
    }, {
        cardId: string;
        quantity: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    isPublic: boolean;
    description?: string | undefined;
    cards?: {
        cardId: string;
        quantity: number;
    }[] | undefined;
}, {
    name: string;
    description?: string | undefined;
    cards?: {
        cardId: string;
        quantity: number;
    }[] | undefined;
    isPublic?: boolean | undefined;
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
    }, "strip", z.ZodTypeAny, {
        cardId: string;
        quantity: number;
    }, {
        cardId: string;
        quantity: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    cards: {
        cardId: string;
        quantity: number;
    }[];
    deckId: string;
}, {
    cards: {
        cardId: string;
        quantity: number;
    }[];
    deckId: string;
}>;
export declare const deckBrowseSchema: z.ZodObject<{
    domain: z.ZodOptional<z.ZodString>;
    search: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    search?: string | undefined;
    domain?: string | undefined;
    cursor?: string | undefined;
}, {
    search?: string | undefined;
    domain?: string | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export type DeckListInput = z.infer<typeof deckListSchema>;
export type DeckGetByIdInput = z.infer<typeof deckGetByIdSchema>;
export type DeckCreateInput = z.infer<typeof deckCreateSchema>;
export type DeckUpdateInput = z.infer<typeof deckUpdateSchema>;
export type DeckDeleteInput = z.infer<typeof deckDeleteSchema>;
export type DeckSetCardsInput = z.infer<typeof deckSetCardsSchema>;
export type DeckBrowseInput = z.infer<typeof deckBrowseSchema>;
