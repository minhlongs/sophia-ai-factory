/**
 * Video Access Control — refund-aware R2 streaming authorization.
 *
 * Validates video access (ownership, revocation state) before the caller
 * streams bytes from R2 via the Worker route.
 *
 * Design: C4 streaming approach (KISS)
 *   - No presigned URLs — CF R2 binding has no createSignedUrl()
 *   - Auth gate = this module + the route handler
 *   - Route proxies bucket.get(r2_key) → Response(object.body)
 *
 * Returns null if:
 *   - Video not found or not owned by userId
 *   - access_revoked = 1 (purchase was refunded)
 *   - r2_key is null (video not yet stored in R2)
 *
 * @module lib/video/video-access-control
 */

import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getVideoBucket } from './r2-binding'

/** Metadata returned to the streaming route on success */
export interface VideoAccessGranted {
  r2Key: string
  r2Bucket: R2Bucket
  publicBaseUrl: string | null
}

export type VideoAccessDeniedReason =
  | 'not_found'
  | 'unauthorized'
  | 'revoked'
  | 'not_ready'
  | 'r2_unavailable'

export interface VideoAccessRow {
  id: string
  user_id: string
  r2_key: string | null
  access_revoked: number
}

/**
 * Fetch video access row from D1.
 * Returns null on error or not found.
 */
async function getVideoAccessRow(videoId: string): Promise<VideoAccessRow | null> {
  try {
    const db = await getD1Raw()
    return await db
      .prepare(
        `SELECT id, user_id, r2_key, access_revoked
         FROM videos
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(videoId)
      .first<VideoAccessRow>()
  } catch (err) {
    logger.error('[VideoAccessControl] DB lookup failed', err instanceof Error ? err : undefined, { videoId })
    return null
  }
}

/**
 * Authorize video access. On success returns the R2 key + bucket for streaming.
 * Caller proxies R2 object bytes to the response — no URL signing needed.
 *
 * @returns { granted, r2Key, r2Bucket } on success
 *          { denied, reason } on access denial
 */
export async function authorizeVideoAccess(
  videoId: string,
  userId: string,
): Promise<
  | { granted: true; access: VideoAccessGranted }
  | { denied: true; reason: VideoAccessDeniedReason }
> {
  const row = await getVideoAccessRow(videoId)

  if (!row) {
    return { denied: true, reason: 'not_found' }
  }

  if (row.user_id !== userId) {
    logger.error('[VideoAccessControl] Ownership mismatch', undefined, { videoId, userId })
    return { denied: true, reason: 'unauthorized' }
  }

  if (row.access_revoked === 1) {
    logger.error('[VideoAccessControl] Access revoked — refund applied', undefined, { videoId, userId })
    return { denied: true, reason: 'revoked' }
  }

  if (!row.r2_key) {
    return { denied: true, reason: 'not_ready' }
  }

  const r2ref = await getVideoBucket()
  if (!r2ref) {
    logger.error('[VideoAccessControl] R2 binding unavailable', undefined, { videoId })
    return { denied: true, reason: 'r2_unavailable' }
  }

  return {
    granted: true,
    access: {
      r2Key: row.r2_key,
      r2Bucket: r2ref.bucket,
      publicBaseUrl: r2ref.publicBaseUrl,
    },
  }
}
