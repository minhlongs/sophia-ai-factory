/**
 * GET /api/media/status?id=<jobId>
 *
 * Poll media generation job status.
 * Returns job progress, result URL when complete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getJobStatus } from '@/lib/clients/muapi-media-client'

export async function GET(req: NextRequest) {
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
}
