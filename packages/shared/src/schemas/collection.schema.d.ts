import { z } from 'zod';
export declare const collectionListSchema: z.ZodObject<{
    setSlug: z.ZodOptional<z.ZodString>;
    rarity: z.ZodOptional<z.ZodEnum<["Common", "Uncommon", "Rare", "Epic"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | undefined;
    setSlug?: string | undefined;
    cursor?: string | undefined;
}, {
    rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | undefined;
    limit?: number | undefined;
    setSlug?: string | undefined;
    cursor?: string | undefined;
}>;
export declare const collectionAddSchema: z.ZodObject<{
    cardId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    condition: z.ZodDefault<z.ZodEnum<["near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cardId: string;
    quantity: number;
    condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    notes?: string | undefined;
}, {
    cardId: string;
    quantity?: number | undefined;
    condition?: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged" | undefined;
    notes?: string | undefined;
}>;
export declare const collectionUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    quantity: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    quantity: number;
    notes?: string | undefined;
}, {
    id: string;
    quantity: number;
    notes?: string | undefined;
}>;
export declare const collectionRemoveSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const collectionAddBulkSchema: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        cardId: z.ZodString;
        quantity: z.ZodNumber;
        condition: z.ZodEnum<["near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"]>;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
        quantity: number;
        condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    }, {
        cardId: string;
        quantity: number;
        condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        cardId: string;
        quantity: number;
        condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    }[];
}, {
    entries: {
        cardId: string;
        quantity: number;
        condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    }[];
}>;
export type CollectionListInput = z.infer<typeof collectionListSchema>;
export type CollectionAddInput = z.infer<typeof collectionAddSchema>;
export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;
export type CollectionRemoveInput = z.infer<typeof collectionRemoveSchema>;
export type CollectionAddBulkInput = z.infer<typeof collectionAddBulkSchema>;
