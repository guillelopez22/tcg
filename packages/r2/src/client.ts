import { S3Client } from '@aws-sdk/client-s3';

import { r2Endpoint, type R2Config } from './config.js';

/**
 * Create an S3Client configured for Cloudflare R2.
 *
 * R2 is S3-compatible but requires:
 * - A custom endpoint (not AWS)
 * - Region set to "auto" (R2 ignores it but the SDK requires a value)
 *
 * The client is intentionally not a singleton here — callers (e.g. NestJS
 * services) should instantiate once via their DI container and reuse it.
 */
export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(config.R2_ACCOUNT_ID),
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
    // R2 does not support path-style addressing for presigned URLs
    forcePathStyle: false,
  });
}
