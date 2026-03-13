export { validateR2Config, r2Endpoint } from './config.js';
export type { R2Config } from './config.js';

export { createR2Client } from './client.js';

export {
  UPLOAD_PURPOSES,
  ALLOWED_MIME_TYPES,
  MIME_TO_EXT,
  MAX_FILE_SIZE_BYTES,
  PRESIGNED_URL_TTL_SECONDS,
  MAX_LISTING_IMAGES,
} from './constants.js';
export type { UploadPurpose, AllowedMimeType } from './constants.js';

export {
  assertAllowedMimeType,
  buildObjectKey,
  generateUploadUrl,
  generateDownloadUrl,
} from './presign.js';
export type {
  GenerateUploadUrlInput,
  GenerateUploadUrlResult,
  GenerateDownloadUrlInput,
} from './presign.js';
