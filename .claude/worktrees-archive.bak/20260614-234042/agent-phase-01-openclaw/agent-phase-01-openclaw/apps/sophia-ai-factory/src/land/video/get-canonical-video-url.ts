/**
 * Canonical Video URL resolver.
 *
 * Reads a `videos` row by id + user_id (ownership enforced), returns
 * the R2-hosted URL that passes `assertSafeVideoUrl` SSRF guard.
 *
 * Only rows with `r2_key` populated are eligible — videos still being
 * mirrored or failed videos will receive a `VideoNotMirroredError`.
 *
 * @module lib/video/get-canonical-video-url
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

// ── Error types ───────────────────────────────────────────────────────────────

export class VideoNotFoundError extends Error {
  constructor(videoId: string) {
    super(`[getCanonicalVideoUrl] Video not found: ${videoId}`);
    this.name = 'VideoNotFoundError';
  }
}

export class VideoUnauthorizedError extends Error {
  constructor(videoId: string) {
    super(`[getCanonicalVideoUrl] Unauthorized access to video: ${videoId}`);
    this.name = 'VideoUnauthorizedError';
  }
}

export class VideoNotMirroredError extends Error {
  constructor(videoId: string) {
    super(
      `[getCanonicalVideoUrl] Video not yet mirrored to R2 — try again later: ${videoId}`,
    );
    this.name = 'VideoNotMirroredError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoR2Row {
  id: string;
  user_id: string;
  r2_key: string | null;
}

// ── Implementation ─────────────────────────────────────────────────────────────

/**
 * Returns `https://{R2_PUBLIC_HOSTNAME}/{r2_key}` for a video row.
 *
 * Enforces:
 *   1. Row exists in `videos` table.
 *   2. `videos.user_id === userId` (ownership check).
 *   3. `videos.r2_key IS NOT NULL` (mirrored to R2).
 *
 * Throws:
 *   - `VideoNotFoundError`    — row not in DB
 *   - `VideoUnauthorizedError` — user_id mismatch
 *   - `VideoNotMirroredError`  — r2_key is null
 *   - `Error`                  — R2_PUBLIC_HOSTNAME not configured
 */
export async function getCanonicalVideoUrl(
  videoId: string,
  userId: string,
): Promise<string> {
  const db = await getD1Raw();

  const row = await db
    .prepare(
      `SELECT id, user_id, r2_key
       FROM videos
       WHERE id = ?1
       LIMIT 1`,
    )
    .bind(videoId)
    .first<VideoR2Row>();

  if (!row) {
    logger.warn('[getCanonicalVideoUrl] Video row not found', { videoId });
    throw new VideoNotFoundError(videoId);
  }

  if (row.user_id !== userId) {
    logger.warn('[getCanonicalVideoUrl] Ownership mismatch', {
      videoId,
      requestedBy: userId,
      owner: row.user_id,
    });
    throw new VideoUnauthorizedError(videoId);
  }

  if (!row.r2_key) {
    logger.info('[getCanonicalVideoUrl] r2_key is null — video not yet mirrored', {
      videoId,
    });
    throw new VideoNotMirroredError(videoId);
  }

  const r2Host = process.env.R2_PUBLIC_HOSTNAME;
  if (!r2Host) {
    throw new Error('[getCanonicalVideoUrl] R2_PUBLIC_HOSTNAME env var not configured');
  }

  return `https://${r2Host}/${row.r2_key}`;
}
