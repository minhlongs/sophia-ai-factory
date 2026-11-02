/**
 * GET /api/media/status?id=<jobId>
 *
 * Poll media generation job status.
 * Enforces strict per-user job ownership via D1 `media_jobs` before polling provider.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getJobStatus } from '@/tree/clients/muapi-media-client'
import { logger } from '@/seed/utils/logger-utility'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getD1 } from '@/seed/db/client'

const StatusParams = z.object({
  id: z.string().min(1).max(128),
});

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawId = req.nextUrl.searchParams.get('id')
    const parsed = StatusParams.safeParse({ id: rawId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid id parameter', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id: jobId } = parsed.data;

    const d1 = await getD1();
    if (!d1) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
    }
    const ownerRow = await d1
      .prepare('SELECT user_id FROM media_jobs WHERE id = ?1 LIMIT 1')
      .bind(jobId)
      .first<{ user_id: string }>();

    if (!ownerRow || ownerRow.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: job does not belong to current user' },
        { status: 403 },
      );
    }

    if (!process.env.MUAPI_API_KEY) {
      return NextResponse.json(
        { error: 'Media generation not configured' },
        { status: 503 },
      )
    }

    const result = await getJobStatus(jobId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to get job status' },
        { status: 502 },
      )
    }

    return NextResponse.json(result.job)
  } catch (error) {
    logger.error('[media/status] GET error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to get media status' }, { status: 500 });
  }
}
