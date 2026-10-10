import { getHeyGenClient } from '@/land/heygen/heygen-client';
import { downloadAndStore } from '@/land/video/storage/video-storage-service';
import { logger } from '@/seed/utils/logger-utility';
import { TERMINAL, type VideoRow, type SyncSummary } from './sync-types';
import { handleOneBundlePermanentFailure } from './bundle-failure-handler';
import { handleBundleSuccessNotification } from './bundle-success-notifier';

export async function processSyncRow(
  db: D1Database,
  row: VideoRow,
  cutoff: number,
  summary: SyncSummary,
): Promise<void> {
  const createdAt = new Date(Number(row.created_at) * 1000).getTime();

  // ── Timeout path ─────────────────────────────────────────────────────
  if (createdAt < cutoff) {
    if (row.purchase_id) {
      // C3: one-time bundle → permanent failure + compensation + email
      await handleOneBundlePermanentFailure(db, row, 'timeout_24h');
    } else {
      // Legacy onboarding video — keep existing 'failed' status
      await db
        .prepare(
          `UPDATE videos SET status = 'failed', error = 'timeout',
           updated_at = ?1 WHERE id = ?2`,
        )
        .bind(new Date().toISOString(), row.id)
        .run();
    }
    summary.timedOut += 1;
    return;
  }

  // Per-row: user key first (one-time bundle), platform fallback for onboarding videos
  const client = await getHeyGenClient(row.user_id);
  if (!client) {
    logger.warn('[video-status-sync] No HeyGen key for row — skipping', {
      videoId: row.id,
      userId: row.user_id,
    });
    summary.errors += 1;
    return;
  }

  const status = await client.getVideoStatus(row.heygen_job_id);

  if (TERMINAL.has(status.status)) {
    let r2Key: string | null = null;
    let r2SizeBytes: number | null = null;

    if (status.status === 'completed' && status.video_url) {
      try {
        const storageKey = `videos/${row.user_id}/${row.id}.mp4`;
        const stored = await downloadAndStore(
          status.video_url,
          row.id,
          storageKey,
        );
        if (stored.path) {
          r2Key = stored.path;
          r2SizeBytes = stored.sizeBytes;
        }
      } catch (r2Err) {
        logger.error(
          '[video-status-sync] R2 copy failed — keeping HeyGen URL',
          r2Err instanceof Error ? r2Err : undefined,
          { videoId: row.id },
        );
      }
    }

    // ── HeyGen 'failed' path ────────────────────────────────────────
    if (status.status === 'failed' && row.purchase_id) {
      await handleOneBundlePermanentFailure(db, row, status.error ?? 'heygen_failed');
      summary.terminal += 1;
      return;
    }

    await db
      .prepare(
        `UPDATE videos SET
           status = ?1,
           video_url = ?2,
           thumbnail_url = ?3,
           error = ?4,
           r2_key = ?5,
           r2_size_bytes = ?6,
           updated_at = ?7
         WHERE id = ?8`,
      )
      .bind(
        status.status,
        status.video_url ?? null,
        status.thumbnail_url ?? null,
        status.error ?? null,
        r2Key,
        r2SizeBytes,
        new Date().toISOString(),
        row.id,
      )
      .run();
    summary.terminal += 1;

    // One-time bundle: send ready email when video completes
    if (status.status === 'completed' && row.purchase_id) {
      await handleBundleSuccessNotification(row, r2Key, status.video_url);
    }
  }
}
