import { z } from 'zod';
export declare const orderCreateSchema: z.ZodObject<{
    listingId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    shippingAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    listingId: string;
    shippingAddress?: string | undefined;
}, {
    listingId: string;
    quantity?: number | undefined;
    shippingAddress?: string | undefined;
}>;
export declare const orderGetByIdSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const myOrdersSchema: z.ZodObject<{
    role: z.ZodEnum<["buyer", "seller"]>;
    status: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    role: "buyer" | "seller";
    limit: number;
    status?: string | undefined;
    cursor?: string | undefined;
}, {
    role: "buyer" | "seller";
    status?: string | undefined;
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export declare const orderUpdateStatusSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["shipped", "delivered", "cancelled", "disputed"]>;
    trackingNumber: z.ZodOptional<z.ZodString>;
    disputeReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "cancelled" | "shipped" | "delivered" | "disputed";
    trackingNumber?: string | undefined;
    disputeReason?: string | undefined;
}, {
    id: string;
    status: "cancelled" | "shipped" | "delivered" | "disputed";
    trackingNumber?: string | undefined;
    disputeReason?: string | undefined;
}>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderGetByIdInput = z.infer<typeof orderGetByIdSchema>;
export type MyOrdersInput = z.infer<typeof myOrdersSchema>;
export type OrderUpdateStatusInput = z.infer<typeof orderUpdateStatusSchema>;
