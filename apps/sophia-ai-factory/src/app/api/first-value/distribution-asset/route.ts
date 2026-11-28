/**
 * POST /api/first-value/distribution-asset
 *
 * Persists an approved narrated MP4 Blob into private tenant-scoped R2 storage
 * and registers a canonical `videos.id` record for the Distribution Center.
 *
 * @module app/api/first-value/distribution-asset/route
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { csrfForbiddenResponse, verifyCsrfToken } from '@/seed/security/csrf';
import { saveApprovedMp4ForDistribution } from '@/land/first-value/distribution-asset-bridge';

export const dynamic = 'force-dynamic';

interface MediaEnv {
  MEDIA_BUCKET?: R2Bucket;
  BACKUPS_BUCKET?: R2Bucket;
}

function resolvePrivateR2Bucket(): R2Bucket | null {
  try {
    const g = globalThis as unknown as Record<string, MediaEnv | undefined>;
    const env = g.__env__ ?? g.__env;
    if (env?.MEDIA_BUCKET) return env.MEDIA_BUCKET;
    if (env?.BACKUPS_BUCKET) return env.BACKUPS_BUCKET;
    const ctx = (globalThis as Record<symbol, { env?: MediaEnv }>)[Symbol.for('__cloudflare-context__')];
    return ctx?.env?.MEDIA_BUCKET ?? ctx?.env?.BACKUPS_BUCKET ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!verifyCsrfToken(request)) {
    return csrfForbiddenResponse();
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data upload' }, { status: 400 });
  }

  const orgId = String(formData.get('orgId') ?? '').trim();
  const artifactId = String(formData.get('artifactId') ?? '').trim();
  const durationSec = Number(formData.get('durationSec') ?? 30);
  const file = formData.get('file');

  if (!orgId || !artifactId || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing orgId, artifactId, or MP4 file' }, { status: 400 });
  }

  const hasAccess = await verifyWorkspaceAccess(orgId, user.id).catch(() => false);
  if (!hasAccess) {
    return NextResponse.json({ code: 'WORKSPACE_FORBIDDEN', error: 'Workspace access denied' }, { status: 403 });
  }

  const d1 = await getD1();
  const r2 = resolvePrivateR2Bucket();
  if (!d1 || !r2) {
    return NextResponse.json(
      { code: 'STORAGE_UNAVAILABLE', error: 'Private R2 or D1 storage binding unavailable' },
      { status: 503 },
    );
  }

  const mp4Bytes = new Uint8Array(await file.arrayBuffer());
  const result = await saveApprovedMp4ForDistribution(d1, r2, {
    orgId,
    userId: user.id,
    artifactId,
    durationSec,
    mp4Bytes,
  });

  if (!result.ok) {
    return NextResponse.json({ code: result.code, error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    {
      videoId: result.videoId,
      r2ObjectKey: result.r2ObjectKey,
      sha256Hex: result.sha256Hex,
      byteSize: result.byteSize,
      idempotentReplay: result.idempotentReplay,
    },
    { status: result.idempotentReplay ? 200 : 201, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
