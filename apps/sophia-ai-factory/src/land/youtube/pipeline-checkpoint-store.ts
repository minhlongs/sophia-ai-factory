/**
 * D1-backed CheckpointStore for the YouTube content pipeline.
 * Wraps the recovery-checkpoint contract over youtube_learning_snapshots-style rows.
 * @module land/youtube/pipeline-checkpoint-store
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { Checkpoint, CheckpointStore, GenerationStage } from '@/tree/youtube-strategy/recovery-checkpoint';

const STAGE_TABLE = 'youtube_pipeline_checkpoints';

export async function ensureCheckpointTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${STAGE_TABLE} (
        job_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        artifact TEXT,
        error TEXT,
        started_at TEXT,
        completed_at TEXT,
        attempt INTEGER,
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (job_id, stage)
      )`,
    )
    .run();
}

export class D1CheckpointStore implements CheckpointStore {
  constructor(private readonly db: D1Database) {}

  async getGenerationCheckpoint(jobId: string, stage: GenerationStage): Promise<Checkpoint | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${STAGE_TABLE} WHERE job_id = ?1 AND stage = ?2 LIMIT 1`)
      .bind(jobId, stage)
      .first<Record<string, unknown>>();
    if (!row) return null;
    let artifact: Record<string, unknown> | undefined;
    if (row.artifact && typeof row.artifact === 'string') {
      try {
        const parsed = JSON.parse(row.artifact);
        if (parsed && typeof parsed === 'object') artifact = parsed as Record<string, unknown>;
      } catch {
        // ignore malformed artifact
      }
    }
    return {
      stage: String(row.stage) as GenerationStage,
      status: (String(row.status) as Checkpoint['status']) ?? 'pending',
      artifact,
      error: row.error == null ? null : String(row.error),
      startedAt: row.started_at == null ? null : String(row.started_at),
      completedAt: row.completed_at == null ? null : String(row.completed_at),
      attempt: row.attempt == null ? undefined : Number(row.attempt),
    };
  }

  async saveGenerationCheckpoint(
    jobId: string,
    stage: GenerationStage,
    data: Partial<Checkpoint>,
  ): Promise<void> {
    const artifact = data.artifact ? JSON.stringify(data.artifact) : null;
    await this.db
      .prepare(
        `INSERT INTO ${STAGE_TABLE} (job_id, stage, status, artifact, error, started_at, completed_at, attempt)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(job_id, stage) DO UPDATE SET
           status = excluded.status,
           artifact = excluded.artifact,
           error = excluded.error,
           started_at = excluded.started_at,
           completed_at = excluded.completed_at,
           attempt = excluded.attempt,
           updated_at = datetime('now')`,
      )
      .bind(
        jobId,
        stage,
        data.status ?? 'running',
        artifact,
        data.error ?? null,
        data.startedAt ?? null,
        data.completedAt ?? null,
        data.attempt ?? null,
      )
      .run();
  }

  async deleteGenerationCheckpoints(jobId: string, stages: GenerationStage[]): Promise<void> {
    if (stages.length === 0) return;
    const placeholders = stages.map((_, i) => `?${i + 2}`).join(',');
    await this.db
      .prepare(`DELETE FROM ${STAGE_TABLE} WHERE job_id = ?1 AND stage IN (${placeholders})`)
      .bind(jobId, ...stages)
      .run();
  }

  async getGenerationJob(jobId: string): Promise<Record<string, unknown> | null> {
    const row = await this.db
      .prepare(`SELECT * FROM ${STAGE_TABLE} WHERE job_id = ?1 LIMIT 1`)
      .bind(jobId)
      .first<Record<string, unknown>>();
    return row ?? null;
  }
}

export async function createCheckpointStore(): Promise<D1CheckpointStore | null> {
  const _db = await getD1();
  if (!_db) {
    logger.warn('createCheckpointStore: D1 not available — checkpointing disabled');
    return null;
  }
  const db = _db;
  try {
    await ensureCheckpointTable(db);
  } catch (err) {
    logger.warn('createCheckpointStore: ensureCheckpointTable failed', { error: toError(err).message });
  }
  return new D1CheckpointStore(db);
}