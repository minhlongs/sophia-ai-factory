/**
 * GET /api/videos/[id]/url
 *
 * Streams video bytes directly from R2 after auth + ownership check.
 * Strategy: C4 streaming (no presigned URLs — CF R2 binding has no createSignedUrl).
 *
 * Security:
 *   - Requires authenticated session (getCurrentUser)
 *   - Verifies ownership (user_id match on videos row)
 *   - Blocks revoked access (access_revoked = 1 means purchase refunded)
 *
 * Error cases:
 *   401 — not authenticated
 *   403 — access revoked (refund applied)
 *   404 — video not found or not owned by caller
 *   425 — video not yet stored in R2 (render incomplete)
 *   503 — R2 binding unavailable
 *
 * @module app/api/videos/[id]/url
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/better-auth-session'
import { authorizeVideoAccess } from '@/lib/video/video-access-control'
import { logger } from '@/lib/utils/logger-utility'

export const dynamic = 'force-dynamic'

const STREAM_CACHE_MAX_AGE = 300 // 5 minutes, private (not shared/CDN)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id: videoId } = await params

  const authResult = await authorizeVideoAccess(videoId, user.id)

  if ('denied' in authResult) {
    const statusMap: Record<string, number> = {
      not_found: 404,
      unauthorized: 404, // Don't leak existence to unauthorized callers
      revoked: 403,
      not_ready: 425,
      r2_unavailable: 503,
    }

    if (authResult.reason === 'revoked') {
      logger.error('[VideoUrlRoute] Access denied — revoked', undefined, {
        videoId,
        userId: user.id,
      })
    }

    return NextResponse.json(
      { error: authResult.reason },
      { status: statusMap[authResult.reason] ?? 404 },
    )
  }

  const { r2Key, r2Bucket, publicBaseUrl } = authResult.access

  // If bucket has a public base URL, redirect — no streaming overhead needed
  if (publicBaseUrl) {
    return NextResponse.redirect(`${publicBaseUrl}/${r2Key}`, { status: 302 })
  }

  // Private bucket: stream bytes through this Worker route
  try {
    const object = await r2Bucket.get(r2Key)
    if (!object) {
      logger.error('[VideoUrlRoute] R2 object not found after auth', undefined, { videoId, r2Key })
      return NextResponse.json({ error: 'not_ready' }, { status: 425 })
    }

    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'video/mp4')
    headers.set('Cache-Control', `private, max-age=${STREAM_CACHE_MAX_AGE}`)
    if (object.size) {
      headers.set('Content-Length', String(object.size))
    }
    // Allow <video> element to seek
    headers.set('Accept-Ranges', 'bytes')

    return new Response(object.body, { status: 200, headers })
  } catch (err) {
    logger.error('[VideoUrlRoute] R2 get failed', err instanceof Error ? err : undefined, { videoId, r2Key })
    return NextResponse.json({ error: 'r2_unavailable' }, { status: 503 })
  }
}
