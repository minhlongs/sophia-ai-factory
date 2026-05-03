/**
 * GET /api/media/status?id=<jobId>
 *
 * Poll media generation job status.
 * Returns job progress, result URL when complete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobStatus } from '@/lib/clients/muapi-media-client'
import { logger } from '@/seed/utils/logger-utility'
import { getCurrentUser } from '@/seed/auth/better-auth-session'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const jobId = req.nextUrl.searchParams.get('id')

    if (!jobId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
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
