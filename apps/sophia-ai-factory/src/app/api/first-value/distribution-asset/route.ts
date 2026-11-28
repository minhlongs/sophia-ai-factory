/**
 * POST /api/first-value/distribution-asset
 *
 * Bounded streaming binary MP4 ingestion into private tenant-scoped `MEDIA_BUCKET`
 * R2 storage and canonical `videos.id` finalization.
 *
 * Enforces byte limits via a streaming reader BEFORE buffering, even when
 * `Content-Length` is missing or spoofed. Fails closed (503) when `MEDIA_BUCKET`
 * is not configured (never falls back to `BACKUPS_BUCKET`).
 *
 * @module app/api/first-value/distribution-asset/route
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { csrfForbiddenResponse, verifyCsrfToken } from '@/seed/security/csrf';
import {
  MAX_DISTRIBUTION_MP4_BYTES,
  MIN_DISTRIBUTION_MP4_BYTES,
  saveApprovedMp4ForDistribution,
} from '@/land/first-value/distribution-asset-bridge';

export const dynamic = 'force-dynamic';

interface MediaEnv {
  MEDIA_BUCKET?: R2Bucket;
}

function resolvePrivateR2Bucket(): R2Bucket | null {
  try {
    const g = globalThis as unknown as Record<string, MediaEnv | undefined>;
    const env = g.__env__ ?? g.__env;
    if (env?.MEDIA_BUCKET) return env.MEDIA_BUCKET;
    const ctx = (globalThis as Record<symbol, { env?: MediaEnv }>)[Symbol.for('__cloudflare-context__')];
    return ctx?.env?.MEDIA_BUCKET ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads a ReadableStream up to `maxBytes` strictly, aborting immediately if
 * received bytes exceed `maxBytes` (protects against missing or spoofed Content-Length).
 */
export async function readBoundedStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; code: 'PAYLOAD_TOO_LARGE' | 'STREAM_ERROR' }> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('Payload exceeds maximum allowed size').catch(() => {});
        return { ok: false, code: 'PAYLOAD_TOO_LARGE' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: 'STREAM_ERROR' };
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: merged };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!verifyCsrfToken(request)) {
    return csrfForbiddenResponse();
  }

  const orgId = (request.headers.get('x-sophia-org-id') ?? '').trim();
  const artifactId = (request.headers.get('x-sophia-artifact-id') ?? '').trim();
  const durationSec = Number(request.headers.get('x-sophia-duration-sec') ?? '30');
  if (!orgId || !artifactId) {
    return NextResponse.json({ error: 'Missing x-sophia-org-id or x-sophia-artifact-id header' }, { status: 400 });
  }

  // Early rejection signal (not sole boundary — enforced again during streaming read)
  const declaredLen = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLen) && declaredLen > MAX_DISTRIBUTION_MP4_BYTES) {
    return NextResponse.json({ code: 'PAYLOAD_TOO_LARGE', error: 'Upload exceeds 50 MB limit' }, { status: 413 });
  }

  const hasAccess = await verifyWorkspaceAccess(orgId, user.id).catch(() => false);
  if (!hasAccess) {
    return NextResponse.json({ code: 'WORKSPACE_FORBIDDEN', error: 'Workspace access denied' }, { status: 403 });
  }

  const d1 = await getD1();
  const r2 = resolvePrivateR2Bucket();
  if (!d1 || !r2) {
    return NextResponse.json(
      { code: 'STORAGE_UNAVAILABLE', error: 'Private MEDIA_BUCKET or D1 storage binding unavailable' },
      { status: 503 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ code: 'INVALID_MP4_BYTES', error: 'Empty request body' }, { status: 400 });
  }

  const bounded = await readBoundedStream(request.body, MAX_DISTRIBUTION_MP4_BYTES);
  if (!bounded.ok) {
    return NextResponse.json(
      {
        code: bounded.code,
        error: bounded.code === 'PAYLOAD_TOO_LARGE' ? 'Streamed upload exceeds 50 MB limit' : 'Upload stream interrupted',
      },
      { status: bounded.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400 },
    );
  }

  if (bounded.bytes.byteLength < MIN_DISTRIBUTION_MP4_BYTES) {
    return NextResponse.json({ code: 'INVALID_MP4_BYTES', error: 'MP4 file is too small' }, { status: 400 });
  }

  const result = await saveApprovedMp4ForDistribution(d1, r2, {
    orgId,
    userId: user.id,
    artifactId,
    durationSec,
    mp4Bytes: bounded.bytes,
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
