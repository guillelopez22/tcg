import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens'),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
  displayName: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export const jwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  role: z.string(),
  jti: z.string().optional(),
  iat: z.number(),
  exp: z.number(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
