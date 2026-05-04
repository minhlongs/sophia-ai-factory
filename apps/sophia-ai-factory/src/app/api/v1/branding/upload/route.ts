/**
 * POST /api/v1/branding/upload — Upload logo, favicon, or social image to R2.
 *
 * Form fields:
 *   kind: 'logo' | 'favicon' | 'social'
 *   file: File (image/png, image/jpeg, image/webp, image/svg+xml; favicon also image/x-icon)
 *
 * Returns: { url: string, kind: string }
 *
 * @module app/api/v1/branding/upload/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { merge, getOrDefault } from '@/lib/tenant-settings/registry';
import { DEFAULT_BRANDING } from '@/lib/tenant-settings/defaults';
import type { BrandingSettings } from '@/lib/tenant-settings/defaults';
import { logger } from '@/seed/utils/logger-utility';
import {
  enforceFileSizeLimit,
  enforceMimeAllowlist,
  safeStorageKey,
  FileUploadPolicyError,
} from '@/seed/security/file-upload-policy';
import { getVideoBucket } from '@/lib/video/r2-binding';
import { uploadToR2 } from '@/lib/video/r2-multipart-upload';

export const dynamic = 'force-dynamic';

const BRANDING_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const IMAGE_MIME_ALLOWLIST = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

const FAVICON_MIME_ALLOWLIST = [
  ...IMAGE_MIME_ALLOWLIST,
  'image/x-icon',
] as const;

const VALID_KINDS = ['logo', 'favicon', 'social'] as const;
type BrandingKind = (typeof VALID_KINDS)[number];

const KIND_FIELD_MAP: Record<BrandingKind, 'logoUrl' | 'faviconUrl' | 'socialMeta'> = {
  logo: 'logoUrl',
  favicon: 'faviconUrl',
  social: 'socialMeta',
};

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
  };
  return map[mime] ?? 'bin';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Early size check
  try {
    enforceFileSizeLimit(req, BRANDING_MAX_BYTES);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const kind = formData.get('kind') as string | null;
  if (!kind || !(VALID_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${VALID_KINDS.join(', ')}` },
      { status: 400 },
    );
  }
  const brandingKind = kind as BrandingKind;

  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const mimeType = fileEntry instanceof File ? (fileEntry.type || 'application/octet-stream') : 'application/octet-stream';
  const allowlist = brandingKind === 'favicon' ? FAVICON_MIME_ALLOWLIST : IMAGE_MIME_ALLOWLIST;
  try {
    enforceMimeAllowlist(mimeType, allowlist);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const bucketRef = await getVideoBucket();
  if (!bucketRef) {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  const ext = extFromMime(mimeType);
  let r2Key: string;
  try {
    r2Key = safeStorageKey(user.id, 'branding', `${brandingKind}.${ext}`);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  try {
    const buffer = await fileEntry.arrayBuffer();
    await uploadToR2({
      bucket: bucketRef.bucket,
      key: r2Key,
      data: buffer,
      contentType: mimeType,
    });
  } catch (err) {
    logger.error('[branding/upload] R2 upload failed', err instanceof Error ? err : undefined);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // Build public URL: prefer R2_PUBLIC_BASE_URL, fallback to r2.dev pattern placeholder
  const base = bucketRef.publicBaseUrl ?? '';
  const publicUrl = base ? `${base}/${r2Key}` : `https://pub-placeholder.r2.dev/${r2Key}`;

  const db = getD1();
  if (!db) {
    logger.warn('[branding/upload] DB unavailable — URL not persisted', { r2Key });
    return NextResponse.json({ url: publicUrl, kind: brandingKind });
  }

  try {
    const field = KIND_FIELD_MAP[brandingKind];
    if (field === 'socialMeta') {
      // Merge into existing socialMeta object
      const current = await getOrDefault<BrandingSettings>(db, user.id, 'branding', DEFAULT_BRANDING);
      const existingSocial = current.socialMeta ?? { title: null, description: null, imageUrl: null };
      await merge(db, user.id, 'branding', {
        socialMeta: { ...existingSocial, imageUrl: publicUrl },
      });
    } else {
      await merge(db, user.id, 'branding', { [field]: publicUrl });
    }
  } catch (err) {
    logger.warn('[branding/upload] Settings merge failed (non-fatal)', { error: String(err) });
  }

  return NextResponse.json({ url: publicUrl, kind: brandingKind });
}
