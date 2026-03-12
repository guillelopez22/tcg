/**
 * Upload purposes — determines the key prefix in R2.
 * Keys follow the pattern: {purpose}/{userId}/{uuid}.{ext}
 */
export const UPLOAD_PURPOSES = ['listing', 'avatar', 'collection'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

/**
 * Allowed MIME types for uploads.
 * Only image types are accepted — documents and videos are out of scope.
 */
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Extension map for MIME types — used when generating R2 object keys. */
export const MIME_TO_EXT: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Max file size per purpose (in bytes).
 * Enforced at the presigned URL generation layer via Content-Length-Range
 * conditions — NOT at the NestJS layer (API never touches file bytes).
 */
export const MAX_FILE_SIZE_BYTES: Record<UploadPurpose, number> = {
  listing: 5 * 1024 * 1024,     // 5 MB — card condition photos
  avatar: 2 * 1024 * 1024,      // 2 MB — profile pictures
  collection: 5 * 1024 * 1024,  // 5 MB — collection copy photos
};

/** Presigned URL TTL in seconds (10 minutes). */
export const PRESIGNED_URL_TTL_SECONDS = 600;

/** Max number of images allowed per listing. */
export const MAX_LISTING_IMAGES = 4;
