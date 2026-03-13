import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import type { S3Client } from '@aws-sdk/client-s3';

import {
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  PRESIGNED_URL_TTL_SECONDS,
  type AllowedMimeType,
  type UploadPurpose,
} from './constants.js';
import type { R2Config } from './config.js';

export interface GenerateUploadUrlInput {
  purpose: UploadPurpose;
  userId: string;
  contentType: AllowedMimeType;
  /** Original filename — used only for extension fallback, not stored in R2. */
  filename?: string;
}

export interface GenerateUploadUrlResult {
  /** Presigned PUT URL — client uploads directly to this URL. Expires in 10 min. */
  uploadUrl: string;
  /** Public URL for the object after upload — store this in the DB. */
  publicUrl: string;
  /** R2 object key — store alongside publicUrl for future deletion/management. */
  key: string;
  /** Expiry timestamp (Unix ms) — useful for client-side countdown UI. */
  expiresAt: number;
}

export interface GenerateDownloadUrlInput {
  /** R2 object key (stored in DB after upload). */
  key: string;
  /** TTL in seconds — defaults to PRESIGNED_URL_TTL_SECONDS (600s). */
  ttlSeconds?: number;
}

/**
 * Validate that a MIME type is allowed for upload.
 * Returns the type narrowed to AllowedMimeType or throws.
 */
export function assertAllowedMimeType(contentType: string): AllowedMimeType {
  if (!ALLOWED_MIME_TYPES.includes(contentType as AllowedMimeType)) {
    throw new Error(
      `Content type "${contentType}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    );
  }
  return contentType as AllowedMimeType;
}

/**
 * Build the R2 object key for a new upload.
 * Pattern: {purpose}/{userId}/{uuid}.{ext}
 *
 * Examples:
 *   listing/usr_abc123/550e8400-e29b-41d4-a716-446655440000.jpg
 *   avatar/usr_abc123/550e8400-e29b-41d4-a716-446655440000.webp
 */
export function buildObjectKey(
  purpose: UploadPurpose,
  userId: string,
  contentType: AllowedMimeType,
): string {
  const ext = MIME_TO_EXT[contentType];
  const uuid = randomUUID();
  return `${purpose}/${userId}/${uuid}.${ext}`;
}

/**
 * Generate a presigned PUT URL for direct client upload to R2.
 *
 * The client must:
 * 1. PUT the file bytes to `uploadUrl` with the matching Content-Type header
 * 2. Store `publicUrl` in the DB (and `key` if deletion is needed later)
 * 3. Never send file bytes to the API — the API only stores the URL reference
 */
export async function generateUploadUrl(
  client: S3Client,
  config: R2Config,
  input: GenerateUploadUrlInput,
): Promise<GenerateUploadUrlResult> {
  const { purpose, userId, contentType } = input;

  assertAllowedMimeType(contentType);

  const key = buildObjectKey(purpose, userId, contentType);

  const command = new PutObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    // Metadata stored alongside the object in R2 (not returned to client)
    Metadata: {
      purpose,
      userId,
      uploadedAt: new Date().toISOString(),
    },
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_URL_TTL_SECONDS,
  });

  const publicUrl = `${config.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  const expiresAt = Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000;

  return { uploadUrl, publicUrl, key, expiresAt };
}

/**
 * Generate a presigned GET URL for a private R2 object.
 *
 * Only needed if the R2 bucket is private. If using a public bucket or
 * Cloudflare's public R2 URL feature, you can serve `publicUrl` directly
 * without generating a signed GET URL.
 */
export async function generateDownloadUrl(
  client: S3Client,
  config: R2Config,
  input: GenerateDownloadUrlInput,
): Promise<string> {
  const { key, ttlSeconds = PRESIGNED_URL_TTL_SECONDS } = input;

  const command = new GetObjectCommand({
    Bucket: config.R2_BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: ttlSeconds });
}
