/**
 * GET /api/v1/creative-studio/images/[id]/status
 *
 * Poll the status of a single image generation job.
 * IDOR protected: only the owning user can query their jobs.
 *
 * If the job is still pending/processing, syncs latest state from MuAPI.
 * Response: { id, status, resultUrl, thumbnailUrl }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getJobStatus } from '@/tree/clients/muapi-media-client';
import { logger } from '@/seed/utils/logger-utility';
import { errorResponse } from '@/seed/api';

interface MediaJobRow {
  id: string;
  status: string;
  result_url: string | null;
  thumbnail_url: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();

  // Fetch job — IDOR protection: user_id must match
  const { data: job, error: fetchError } = await db
    .from('media_jobs')
    .select('id, status, result_url, thumbnail_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle() as { data: MediaJobRow | null; error: { message: string } | null };

  if (fetchError) {
    logger.error('[creative-studio/images/status] D1 fetch failed', new Error(fetchError.message));
    return errorResponse('Internal server error', 'DATABASE_ERROR', 500);
  }

  if (!job) {
    return errorResponse('Job not found', 'NOT_FOUND', 404);
  }

  // If still in-flight, refresh from MuAPI
  if (job.status === 'pending' || job.status === 'processing') {
    try {
      const pollResult = await getJobStatus(id);
      if (pollResult.success && pollResult.job) {
        const remote = pollResult.job;
        const statusChanged = remote.status !== job.status;
        const hasResult = Boolean(remote.resultUrl);

        if (statusChanged || hasResult) {
          const now = Math.floor(Date.now() / 1000);
          await db.from('media_jobs').update({
            status: remote.status,
            result_url: remote.resultUrl ?? null,
            thumbnail_url: remote.thumbnailUrl ?? null,
            ...(remote.status === 'completed' || remote.status === 'failed'
              ? { completed_at: now }
              : {}),
          }).eq('id', id);

          return NextResponse.json({
            id,
            status: remote.status,
            resultUrl: remote.resultUrl ?? null,
            thumbnailUrl: remote.thumbnailUrl ?? null,
          });
        }
      }
    } catch (err) {
      // Non-fatal: return cached status if MuAPI poll fails
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[creative-studio/images/status] MuAPI poll failed', { id, error: message });
    }
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    resultUrl: job.result_url,
    thumbnailUrl: job.thumbnail_url,
  });
}
