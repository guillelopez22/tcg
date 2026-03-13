import { z } from 'zod';
export const orderCreateSchema = z.object({
    listingId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
    shippingAddress: z.string().max(500).optional(),
});
export const orderGetByIdSchema = z.object({
    id: z.string().uuid(),
});
export const myOrdersSchema = z.object({
    role: z.enum(['buyer', 'seller']),
    status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'completed', 'disputed', 'cancelled', 'refunded']).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.number().min(1).max(50).default(20),
});
export const orderUpdateStatusSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(['shipped', 'delivered', 'cancelled', 'disputed']),
    trackingNumber: z.string().max(100).optional(),
    disputeReason: z.string().max(1000).optional(),
});
