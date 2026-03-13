import { z } from 'zod';
export declare const updateUserSchema: z.ZodObject<{
    displayName: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodString>;
    whatsappPhone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    displayName?: string | undefined;
    bio?: string | undefined;
    city?: string | undefined;
    avatarUrl?: string | undefined;
    whatsappPhone?: string | undefined;
}, {
    displayName?: string | undefined;
    bio?: string | undefined;
    city?: string | undefined;
    avatarUrl?: string | undefined;
    whatsappPhone?: string | undefined;
}>;
export declare const userOutputSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    username: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    bio: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    whatsappPhone: z.ZodNullable<z.ZodString>;
    isVerified: z.ZodBoolean;
    isActive: z.ZodBoolean;
    role: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    displayName: string | null;
    bio: string | null;
    city: string | null;
    avatarUrl: string | null;
    whatsappPhone: string | null;
    id: string;
    email: string;
    username: string;
    isVerified: boolean;
    isActive: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}, {
    displayName: string | null;
    bio: string | null;
    city: string | null;
    avatarUrl: string | null;
    whatsappPhone: string | null;
    id: string;
    email: string;
    username: string;
    isVerified: boolean;
    isActive: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}>;
/** Public profile schema — omits PII fields (email, whatsappPhone). */
export declare const publicUserOutputSchema: z.ZodObject<Omit<{
    id: z.ZodString;
    email: z.ZodString;
    username: z.ZodString;
    displayName: z.ZodNullable<z.ZodString>;
    avatarUrl: z.ZodNullable<z.ZodString>;
    bio: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    whatsappPhone: z.ZodNullable<z.ZodString>;
    isVerified: z.ZodBoolean;
    isActive: z.ZodBoolean;
    role: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "whatsappPhone" | "email">, "strip", z.ZodTypeAny, {
    displayName: string | null;
    bio: string | null;
    city: string | null;
    avatarUrl: string | null;
    id: string;
    username: string;
    isVerified: boolean;
    isActive: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}, {
    displayName: string | null;
    bio: string | null;
    city: string | null;
    avatarUrl: string | null;
    id: string;
    username: string;
    isVerified: boolean;
    isActive: boolean;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserOutput = z.infer<typeof userOutputSchema>;
export type PublicUserOutput = z.infer<typeof publicUserOutputSchema>;
