/**
 * GET /api/v1/creative-studio/images/[id]/download
 *
 * Authenticated download endpoint for user-owned image artifacts.
 * Enforces tenant ownership via `getUserImageJob` (IDOR protection).
 * Streams directly from R2 when `storage_key` is available, or proxies
 * the authorized `result_url` with `Content-Disposition: attachment`.
 *
 * @module app/api/v1/creative-studio/images/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getUserImageJob } from '@/tree/creative-studio/image-job-queries';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export const dynamic = 'force-dynamic';

function buildSafeFilename(prompt: string | null, jobId: string): string {
  const base = (prompt ?? '').trim().slice(0, 48);
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = slug.length > 0 ? slug : 'sophia-image';
  const shortId = jobId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-8) || 'img';
  return `${prefix}-${shortId}.png`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createServerClient();
    const job = await getUserImageJob(db, user.id, id);

    if (!job) {
      return NextResponse.json({ message: 'Image job not found' }, { status: 404 });
    }

    if (job.status !== 'completed' || !job.result_url) {
      return NextResponse.json(
        { message: 'Image artifact is not ready for download' },
        { status: 409 },
      );
    }

    const filename = buildSafeFilename(job.prompt, job.id);

    // 1. Try R2 bucket first when storage_key is recorded
    if (job.storage_key) {
      const r2 = await getVideoBucket();
      if (r2) {
        const object = await r2.bucket.get(job.storage_key);
        if (object && object.body) {
          const headers = new Headers();
          headers.set('Content-Type', object.httpMetadata?.contentType || job.mime || 'image/png');
          headers.set('Content-Disposition', `attachment; filename="${filename}"`);
          headers.set('Cache-Control', 'private, no-transform, max-age=3600');
          if (typeof object.size === 'number' && object.size > 0) {
            headers.set('Content-Length', String(object.size));
          }
          return new Response(object.body, { status: 200, headers });
        }
      }
    }

    // 2. Fallback: proxy from result_url (R2 public CDN, fal.ai CDN, or MuAPI CDN)
    if (!shouldAllowRequest('image-download')) {
      return NextResponse.json(
        { message: 'Download service temporarily unavailable' },
        { status: 503 },
      );
    }

    try {
      const upstream = await fetch(job.result_url, {
        signal: AbortSignal.timeout(15_000),
      });

      if (!upstream.ok || !upstream.body) {
        recordFailure('image-download', classifyError(new Error(`HTTP ${upstream.status}`)));
        return NextResponse.json(
          { message: 'Failed to retrieve image from storage' },
          { status: 502 },
        );
      }

      recordSuccess('image-download');

      const contentType = upstream.headers.get('content-type') || job.mime || 'image/png';
      const headers = new Headers();
      headers.set('Content-Type', contentType);
      headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      headers.set('Cache-Control', 'private, no-transform, max-age=3600');

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        headers.set('Content-Length', contentLength);
      }

      return new Response(upstream.body, { status: 200, headers });
    } catch (fetchErr) {
      recordFailure('image-download', classifyError(fetchErr));
      logger.warn('[creative-studio/images/download] Upstream fetch failed', {
        id,
        error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
      });
      return NextResponse.json(
        { message: 'Failed to retrieve image from storage' },
        { status: 502 },
      );
    }
  } catch (err) {
    logger.error(
      '[creative-studio/images/download] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
