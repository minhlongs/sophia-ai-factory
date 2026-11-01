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

import { getD1 } from '@/seed/db/client';
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

interface ArtifactStorageRow {
  id: string;
  tenant_id: string;
  storage_key: string | null;
}

async function resolveStorageRow(
  db: D1Database,
  videoId: string,
  userId: string,
): Promise<{ ownerId: string; r2Key: string | null } | null> {
  const row = await db
    .prepare(`SELECT id, user_id, r2_key FROM videos WHERE id = ?1 LIMIT 1`)
    .bind(videoId)
    .first<VideoR2Row>();
  if (row) {
    return { ownerId: row.user_id, r2Key: row.r2_key };
  }

  const artifact = await db
    .prepare(
      `SELECT id, tenant_id, storage_key
       FROM affiliate_media_artifacts
       WHERE (id = ?1 OR run_id = ?1) AND is_fixture = 0
       ORDER BY CASE WHEN tenant_id = ?2 THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .bind(videoId, userId)
    .first<ArtifactStorageRow>();
  if (!artifact) return null;
  return { ownerId: artifact.tenant_id, r2Key: artifact.storage_key };
}

// ── Implementation ─────────────────────────────────────────────────────────────

/**
 * Returns `https://{R2_PUBLIC_HOSTNAME}/{r2_key}` for a video row or OPC artifact.
 *
 * Enforces:
 *   1. Row exists in `videos` or `affiliate_media_artifacts` table.
 *   2. `videos.user_id === userId` or `affiliate_media_artifacts.tenant_id === userId`.
 *   3. `r2_key` / `storage_key` IS NOT NULL (mirrored to R2).
 *
 * Throws:
 *   - `VideoNotFoundError`    — row not in DB
 *   - `VideoUnauthorizedError` — owner mismatch
 *   - `VideoNotMirroredError`  — key is null/empty
 *   - `Error`                  — R2_PUBLIC_HOSTNAME not configured
 */
export async function getCanonicalVideoUrl(
  videoId: string,
  userId: string,
): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const resolved = await resolveStorageRow(db, videoId, userId);
  if (!resolved) {
    logger.warn('[getCanonicalVideoUrl] Video row not found', { videoId });
    throw new VideoNotFoundError(videoId);
  }

  if (resolved.ownerId !== userId) {
    logger.warn('[getCanonicalVideoUrl] Ownership mismatch', {
      videoId,
      requestedBy: userId,
      owner: resolved.ownerId,
    });
    throw new VideoUnauthorizedError(videoId);
  }

  if (!resolved.r2Key) {
    logger.info('[getCanonicalVideoUrl] r2_key is null — video not yet mirrored', {
      videoId,
    });
    throw new VideoNotMirroredError(videoId);
  }

  const r2Host = process.env.R2_PUBLIC_HOSTNAME;
  if (!r2Host) {
    throw new Error('[getCanonicalVideoUrl] R2_PUBLIC_HOSTNAME env var not configured');
  }

  return `https://${r2Host}/${resolved.r2Key}`;
}
