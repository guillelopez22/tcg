import { z } from 'zod';

/**
 * Zod schema for R2 environment variables.
 * Validated once at module load — the process exits early with a clear message
 * rather than failing silently on the first upload attempt.
 */
const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z
    .string()
    .url('R2_PUBLIC_URL must be a valid URL (e.g. https://uploads.lagrieta.app)')
    .min(1),
});

export type R2Config = z.infer<typeof r2EnvSchema>;

/**
 * Parse and validate R2 environment variables.
 * Throws a descriptive ZodError if any variable is missing or invalid.
 * Call this once during app bootstrap (e.g. in NestJS ConfigModule).
 */
export function validateR2Config(env: NodeJS.ProcessEnv = process.env): R2Config {
  const result = r2EnvSchema.safeParse(env);
  if (!result.success) {
    const messages = result.error.errors.map((e) => `  ${e.path.join('.')}: ${e.message}`).join('\n');
    throw new Error(`R2 configuration error:\n${messages}`);
  }
  return result.data;
}

/**
 * Cloudflare R2 S3-compatible endpoint.
 * Format: https://<account_id>.r2.cloudflarestorage.com
 */
export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}
