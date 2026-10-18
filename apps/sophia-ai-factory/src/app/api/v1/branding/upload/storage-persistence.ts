import { NextResponse } from 'next/server';
import { merge, getOrDefault } from '@/seed/tenant-settings/registry';
import { DEFAULT_BRANDING } from '@/seed/tenant-settings/defaults';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import {
  safeStorageKey,
  FileUploadPolicyError,
} from '@/seed/security/file-upload-policy';
import {
  KIND_FIELD_MAP,
  extFromMime,
  getD1,
  matchesMagicBytes,
  type BrandingKind,
} from './validation';

async function getBucket() {
  const { getVideoBucket } = await import('@/land/video/storage/r2-binding');
  return getVideoBucket();
}

async function putR2(params: {
  bucket: R2Bucket;
  key: string;
  data: ArrayBuffer;
  contentType: string;
}) {
  const { uploadToR2 } = await import('@/land/video/storage/r2-multipart-upload');
  return uploadToR2(params);
}

export async function uploadAndPersistBrandingAsset(params: {
  userId: string;
  brandingKind: BrandingKind;
  fileEntry: Blob;
  mimeType: string;
}): Promise<NextResponse> {
  const { userId, brandingKind, fileEntry, mimeType } = params;

  const bucketRef = await getBucket();
  if (!bucketRef) {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  const ext = extFromMime(mimeType);
  let r2Key: string;
  try {
    r2Key = safeStorageKey(userId, 'branding', `${brandingKind}.${ext}`);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  try {
    const buffer = await fileEntry.arrayBuffer();
    const head = new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength));
    if (!matchesMagicBytes(head, mimeType)) {
      return NextResponse.json(
        { error: 'File contents do not match declared image format' },
        { status: 400 },
      );
    }

    await putR2({
      bucket: bucketRef.bucket,
      key: r2Key,
      data: buffer,
      contentType: mimeType,
    });
  } catch (err) {
    logger.error('[branding/upload] R2 upload failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const base = bucketRef.publicBaseUrl ?? '';
  const publicUrl = base ? `${base}/${r2Key}` : `https://pub-placeholder.r2.dev/${r2Key}`;

  const db = await getD1();
  if (!db) {
    logger.warn('[branding/upload] DB unavailable — URL not persisted', { r2Key });
    return NextResponse.json({ url: publicUrl, kind: brandingKind });
  }

  try {
    const field = KIND_FIELD_MAP[brandingKind];
    if (field === 'socialMeta') {
      const current = await getOrDefault<BrandingSettings>(db, userId, 'branding', DEFAULT_BRANDING);
      const existingSocial = current.socialMeta ?? { title: null, description: null, imageUrl: null };
      await merge(db, userId, 'branding', {
        socialMeta: { ...existingSocial, imageUrl: publicUrl },
      });
    } else {
      await merge(db, userId, 'branding', { [field]: publicUrl });
    }
  } catch (err) {
    logger.warn('[branding/upload] Settings merge failed (non-fatal)', { error: String(err) });
  }

  return NextResponse.json({ url: publicUrl, kind: brandingKind });
}
