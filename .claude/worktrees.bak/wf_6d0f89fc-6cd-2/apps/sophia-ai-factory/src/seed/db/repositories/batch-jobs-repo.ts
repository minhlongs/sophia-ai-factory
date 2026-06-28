import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface BatchJob {
  id: string;
  user_id: string;
  name: string;
  status: string;
  total_videos: number;
  completed_videos: number;
  failed_videos: number;
  estimated_cost_cents: number;
  actual_cost_cents: number;
  input_r2_key: string | null;
  idempotency_key?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateBatchJobResult {
  job: BatchJob;
  created: boolean;
}

export interface BatchVideo {
  id: string;
  batch_id: string;
  row_index: number;
  status: string;
  mission_id: string | null;
  input_data: string;
  output_video_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export async function createBatchJob(input: {
  userId: string;
  name: string;
  totalVideos: number;
  estimatedCostCents: number;
  inputR2Key?: string;
  idempotencyKey?: string;
}): Promise<CreateBatchJobResult> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  // Idempotency: if key provided, check existing first
  if (input.idempotencyKey) {
    const existing = await getBatchJobByIdempotencyKey(input.idempotencyKey);
    if (existing) return { job: existing, created: false };
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await db
    .prepare(
      `INSERT INTO batch_jobs (id, user_id, name, total_videos, estimated_cost_cents, input_r2_key) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.userId, input.name, input.totalVideos, input.estimatedCostCents, input.inputR2Key ?? null)
    .run();

  logger.info('[batch-jobs-repo] Created batch job', { id, userId: input.userId, totalVideos: input.totalVideos });
  const job = await getBatchJob(id);
  if (!job) throw new Error('Failed to create batch job');
  return { job, created: true };
}

export async function getBatchJob(id: string): Promise<BatchJob | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  return db.prepare('SELECT * FROM batch_jobs WHERE id = ?').bind(id).first<BatchJob>() ?? null;
}

export async function getBatchJobByIdempotencyKey(idempotencyKey: string): Promise<BatchJob | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  return db
    .prepare('SELECT * FROM batch_jobs WHERE idempotency_key = ? LIMIT 1')
    .bind(idempotencyKey)
    .first<BatchJob>() ?? null;
}

export async function listBatchJobs(userId: string): Promise<BatchJob[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const result = await db
    .prepare('SELECT * FROM batch_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(userId)
    .all<BatchJob>();
  return result.results ?? [];
}

export async function updateBatchJobStatus(
  id: string,
  status: string,
  completedAt?: string,
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  if (completedAt) {
    await db
      .prepare('UPDATE batch_jobs SET status = ?, completed_at = ? WHERE id = ?')
      .bind(status, completedAt, id)
      .run();
  } else {
    await db
      .prepare('UPDATE batch_jobs SET status = ? WHERE id = ?')
      .bind(status, id)
      .run();
  }
}

export async function incrementBatchProgress(
  batchId: string,
  field: 'completed_videos' | 'failed_videos',
  costCents?: number,
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const costClause = costCents ? `, actual_cost_cents = actual_cost_cents + ${costCents}` : '';
  await db
    .prepare(`UPDATE batch_jobs SET ${field} = ${field} + 1${costClause} WHERE id = ?`)
    .bind(batchId)
    .run();
}

export async function insertBatchVideos(
  batchId: string,
  rows: Array<{ rowIndex: number; inputData: string }>,
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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
      .prepare(`INSERT INTO batch_videos (id, batch_id, row_index, input_data) VALUES ${placeholders}`)
      .bind(...values)
      .run();
  }

  logger.info('[batch-jobs-repo] Inserted batch videos', { batchId, count: rows.length });
}

export async function getBatchVideos(batchId: string): Promise<BatchVideo[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const result = await db
    .prepare('SELECT * FROM batch_videos WHERE batch_id = ? ORDER BY row_index ASC')
    .bind(batchId)
    .all<BatchVideo>();
  return result.results ?? [];
}

export async function updateBatchVideoStatus(
  batchVideoId: string,
  status: string,
  extra?: { missionId?: string; outputVideoUrl?: string; errorMessage?: string },
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const completedAt = ['done', 'failed', 'cancelled'].includes(status) ? new Date().toISOString() : null;

  await db
    .prepare(
      `UPDATE batch_videos SET
        status = ?,
        mission_id = COALESCE(?, mission_id),
        output_video_url = COALESCE(?, output_video_url),
        error_message = COALESCE(?, error_message),
        completed_at = COALESCE(?, completed_at)
      WHERE id = ?`,
    )
    .bind(
      status,
      extra?.missionId ?? null,
      extra?.outputVideoUrl ?? null,
      extra?.errorMessage ?? null,
      completedAt,
      batchVideoId,
    )
    .run();
}

export async function cancelPendingBatchVideos(batchId: string): Promise<number> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const result = await db
    .prepare(
      `UPDATE batch_videos SET status = 'cancelled', completed_at = datetime('now')
       WHERE batch_id = ? AND status IN ('queued')`,
    )
    .bind(batchId)
    .run();
  return result.meta?.changes ?? 0;
}
