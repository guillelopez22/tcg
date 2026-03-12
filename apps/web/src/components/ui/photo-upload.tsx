'use client';

// Reusable photo upload component for R2 presigned URL uploads.
// Flow: get presigned URL via tRPC -> PUT to presigned URL -> call onUploadComplete.
// Max 5MB, accepts image/jpeg and image/png.

import { useRef, useState } from 'react';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

interface PhotoUploadProps {
  purpose: string;
  currentPhotoUrl?: string | null;
  onUploadComplete: (url: string, key: string) => void;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];

export function PhotoUpload({ purpose, currentPhotoUrl, onUploadComplete }: PhotoUploadProps) {
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const getUploadUrl = trpc.collection.getUploadUrl.useMutation({
    onError(err) {
      toast.error(err.message ?? tCommon('error'));
      setUploading(false);
      setUploadProgress(null);
    },
  });

  const handleFileSelect = async (file: File) => {
    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('File too large. Max size is 5MB.');
      return;
    }

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Only JPEG and PNG images are supported.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // 1. Get presigned upload URL from API
      const { uploadUrl, publicUrl, key } = await getUploadUrl.mutateAsync({
        contentType: file.type,
      });

      // 2. Upload directly to R2 via presigned URL
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      // 3. Notify parent with URL and key
      onUploadComplete(publicUrl, key);
      toast.success(t('photo') + ' uploaded');
    } catch (err) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelect(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      {/* Current photo preview */}
      {currentPhotoUrl && (
        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-surface-border">
          <Image
            src={currentPhotoUrl}
            alt={t('photo')}
            fill
            sizes="96px"
            className="object-cover"
          />
        </div>
      )}

      {/* Upload button / progress */}
      {uploading ? (
        <div className="space-y-1">
          <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-rift-500 transition-all duration-150"
              style={{ width: `${uploadProgress ?? 0}%` }}
            />
          </div>
          <p className="lg-text-muted">Uploading... {uploadProgress ?? 0}%</p>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleInputChange}
            className="sr-only"
            aria-label={`Upload ${purpose} photo`}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="lg-btn-secondary text-sm px-3 py-2"
          >
            {currentPhotoUrl ? 'Change Photo' : `Upload ${t('photo')}`}
          </button>
          <p className="lg-text-muted">JPEG or PNG, max 5MB</p>
        </>
      )}
    </div>
  );
}
