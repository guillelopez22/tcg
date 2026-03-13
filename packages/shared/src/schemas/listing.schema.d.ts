import { z } from 'zod';
export declare const listingListSchema: z.ZodObject<{
    cardId: z.ZodOptional<z.ZodString>;
    setSlug: z.ZodOptional<z.ZodString>;
    rarity: z.ZodOptional<z.ZodEnum<["Common", "Uncommon", "Rare", "Epic"]>>;
    condition: z.ZodOptional<z.ZodEnum<["near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"]>>;
    city: z.ZodOptional<z.ZodString>;
    minPrice: z.ZodOptional<z.ZodNumber>;
    maxPrice: z.ZodOptional<z.ZodNumber>;
    search: z.ZodOptional<z.ZodString>;
    sortBy: z.ZodDefault<z.ZodEnum<["price_asc", "price_desc", "newest", "oldest"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    sortBy: "price_asc" | "price_desc" | "newest" | "oldest";
    search?: string | undefined;
    rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | undefined;
    city?: string | undefined;
    cardId?: string | undefined;
    condition?: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged" | undefined;
    setSlug?: string | undefined;
    cursor?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
}, {
    search?: string | undefined;
    rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | undefined;
    city?: string | undefined;
    cardId?: string | undefined;
    condition?: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged" | undefined;
    limit?: number | undefined;
    setSlug?: string | undefined;
    cursor?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    sortBy?: "price_asc" | "price_desc" | "newest" | "oldest" | undefined;
}>;
export declare const listingGetByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const listingCreateSchema: z.ZodObject<{
    cardId: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    priceInCents: z.ZodNumber;
    condition: z.ZodEnum<["near_mint", "lightly_played", "moderately_played", "heavily_played", "damaged"]>;
    quantity: z.ZodDefault<z.ZodNumber>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    shippingAvailable: z.ZodDefault<z.ZodEnum<["local", "national", "both"]>>;
}, "strip", z.ZodTypeAny, {
    cardId: string;
    quantity: number;
    condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    title: string;
    priceInCents: number;
    shippingAvailable: "local" | "national" | "both";
    description?: string | undefined;
    imageUrls?: string[] | undefined;
}, {
    cardId: string;
    condition: "near_mint" | "lightly_played" | "moderately_played" | "heavily_played" | "damaged";
    title: string;
    priceInCents: number;
    description?: string | undefined;
    quantity?: number | undefined;
    imageUrls?: string[] | undefined;
    shippingAvailable?: "local" | "national" | "both" | undefined;
}>;
export declare const listingUpdateSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    priceInCents: z.ZodOptional<z.ZodNumber>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    status: z.ZodOptional<z.ZodEnum<["active", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description?: string | undefined;
    title?: string | undefined;
    priceInCents?: number | undefined;
    status?: "active" | "cancelled" | undefined;
    imageUrls?: string[] | undefined;
}, {
    id: string;
    description?: string | undefined;
    title?: string | undefined;
    priceInCents?: number | undefined;
    status?: "active" | "cancelled" | undefined;
    imageUrls?: string[] | undefined;
}>;
export declare const myListingsSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["draft", "active", "sold", "cancelled", "expired"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    status?: "active" | "sold" | "cancelled" | "draft" | "expired" | undefined;
    cursor?: string | undefined;
}, {
    status?: "active" | "sold" | "cancelled" | "draft" | "expired" | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export type ListingListInput = z.infer<typeof listingListSchema>;
export type ListingGetByIdInput = z.infer<typeof listingGetByIdSchema>;
export type ListingCreateInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateSchema>;
export type MyListingsInput = z.infer<typeof myListingsSchema>;
