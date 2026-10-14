import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { BatchVideo } from './types';

export async function insertBatchVideos(
  batchId: string,
  rows: Array<{ rowIndex: number; inputData: string }>
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const CHUNK_SIZE = 50;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const values = chunk.flatMap((r) => [
      crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      batchId,
      r.rowIndex,
      r.inputData,
    ]);

    await db
      .prepare(
        `INSERT INTO batch_videos (id, batch_id, row_index, input_data) VALUES ${placeholders}`
      )
      .bind(...values)
      .run();
  }

  logger.info('[batch-jobs-repo] Inserted batch videos', {
    batchId,
    count: rows.length,
  });
}

export async function getBatchVideos(batchId: string): Promise<BatchVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const result = await db
    .prepare('SELECT * FROM batch_videos WHERE batch_id = ? ORDER BY row_index ASC')
    .bind(batchId)
    .all<BatchVideo>();
  return result.results ?? [];
}

export async function updateBatchVideoStatus(
  batchVideoId: string,
  status: string,
  extra?: { missionId?: string; outputVideoUrl?: string; errorMessage?: string }
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const completedAt = ['done', 'failed', 'cancelled'].includes(status)
    ? new Date().toISOString()
    : null;

  await db
    .prepare(
      `UPDATE batch_videos SET
        status = ?,
        mission_id = COALESCE(?, mission_id),
        output_video_url = COALESCE(?, output_video_url),
        error_message = COALESCE(?, error_message),
        completed_at = COALESCE(?, completed_at)
      WHERE id = ?`
    )
    .bind(
      status,
      extra?.missionId ?? null,
      extra?.outputVideoUrl ?? null,
      extra?.errorMessage ?? null,
      completedAt,
      batchVideoId
    )
    .run();
}

export async function cancelPendingBatchVideos(batchId: string): Promise<number> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const result = await db
    .prepare(
      `UPDATE batch_videos SET status = 'cancelled', completed_at = datetime('now')
       WHERE batch_id = ? AND status IN ('queued')`
    )
    .bind(batchId)
    .run();
  return result.meta?.changes ?? 0;
}
