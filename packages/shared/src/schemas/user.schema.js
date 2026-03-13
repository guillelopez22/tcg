import { z } from 'zod';
export const updateUserSchema = z.object({
    displayName: z.string().max(100).optional(),
    bio: z.string().max(1000).optional(),
    city: z.string().max(100).optional(),
    avatarUrl: z.string().url().max(500).refine((url) => url.startsWith('https://'), 'Must be HTTPS URL').optional(),
    whatsappPhone: z.string().max(20).optional(),
});
export const userOutputSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    username: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    city: z.string().nullable(),
    whatsappPhone: z.string().nullable(),
    isVerified: z.boolean(),
    isActive: z.boolean(),
    role: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
});
/** Public profile schema — omits PII fields (email, whatsappPhone). */
export const publicUserOutputSchema = userOutputSchema.omit({
    email: true,
    whatsappPhone: true,
});
