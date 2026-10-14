import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { BatchJob, CreateBatchJobInput, CreateBatchJobResult } from './types';

export async function createBatchJob(
  input: CreateBatchJobInput
): Promise<CreateBatchJobResult> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  if (input.idempotencyKey) {
    const existing = await getBatchJobByIdempotencyKey(input.idempotencyKey);
    if (existing) return { job: existing, created: false };
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await db
    .prepare(
      `INSERT INTO batch_jobs (id, user_id, name, total_videos, estimated_cost_cents, input_r2_key) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.userId,
      input.name,
      input.totalVideos,
      input.estimatedCostCents,
      input.inputR2Key ?? null
    )
    .run();

  logger.info('[batch-jobs-repo] Created batch job', {
    id,
    userId: input.userId,
    totalVideos: input.totalVideos,
  });
  const job = await getBatchJob(id);
  if (!job) throw new Error('Failed to create batch job');
  return { job, created: true };
}

export async function getBatchJob(id: string): Promise<BatchJob | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  return db.prepare('SELECT * FROM batch_jobs WHERE id = ?').bind(id).first<BatchJob>() ?? null;
}

export async function getBatchJobByIdempotencyKey(
  idempotencyKey: string
): Promise<BatchJob | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  return (
    db
      .prepare('SELECT * FROM batch_jobs WHERE idempotency_key = ? LIMIT 1')
      .bind(idempotencyKey)
      .first<BatchJob>() ?? null
  );
}

export async function listBatchJobs(userId: string): Promise<BatchJob[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  const result = await db
    .prepare('SELECT * FROM batch_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(userId)
    .all<BatchJob>();
  return result.results ?? [];
}

export async function updateBatchJobStatus(
  id: string,
  status: string,
  completedAt?: string
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
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
  costCents?: number
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;
  if (costCents && Number.isSafeInteger(costCents) && costCents >= 0) {
    await db
      .prepare(
        `UPDATE batch_jobs SET ${field} = ${field} + 1, actual_cost_cents = actual_cost_cents + ? WHERE id = ?`
      )
      .bind(costCents, batchId)
      .run();
  } else {
    await db
      .prepare(`UPDATE batch_jobs SET ${field} = ${field} + 1 WHERE id = ?`)
      .bind(batchId)
      .run();
  }
}
