import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import {
  enforceFileSizeLimit,
  enforceMimeAllowlist,
  FileUploadPolicyError,
} from '@/seed/security/file-upload-policy';
import {
  BRANDING_MAX_BYTES,
  FAVICON_MIME_ALLOWLIST,
  IMAGE_MIME_ALLOWLIST,
  VALID_KINDS,
  type BrandingKind,
} from './validation';
import { uploadAndPersistBrandingAsset } from './storage-persistence';

export async function handleBrandingUpload(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(req.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const mimeType =
    fileEntry instanceof File ? fileEntry.type || 'application/octet-stream' : 'application/octet-stream';
  const allowlist = brandingKind === 'favicon' ? FAVICON_MIME_ALLOWLIST : IMAGE_MIME_ALLOWLIST;
  try {
    enforceMimeAllowlist(mimeType, allowlist);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  return uploadAndPersistBrandingAsset({
    userId: user.id,
    brandingKind,
    fileEntry,
    mimeType,
  });
}
