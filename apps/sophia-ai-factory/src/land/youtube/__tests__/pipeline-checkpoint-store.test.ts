/**
 * Tests for pipeline-checkpoint-store — D1-backed checkpoint persistence.
 * Uses an in-memory SQLite D1 shim with the pipeline-checkpoints table.
 *
 * @module land/youtube/__tests__/pipeline-checkpoint-store
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { getD1 } from '@/seed/db/client';
import {
  D1CheckpointStore,
  createCheckpointStore,
  ensureCheckpointTable,
} from '../pipeline-checkpoint-store';
import { mockYouTubeD1, type YouTubeTestDb } from './youtube-test-db';

const JOB_ID = 'job-1';

let testDb: YouTubeTestDb;

beforeEach(() => {
  vi.clearAllMocks();
  testDb = mockYouTubeD1();
});

// ── ensureCheckpointTable ───────────────────────────────────────────────────

describe('ensureCheckpointTable', () => {
  it('creates the checkpoints table idempotently', async () => {
    await ensureCheckpointTable(testDb.db);
    await ensureCheckpointTable(testDb.db);

    const rows = testDb.raw
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='youtube_pipeline_checkpoints'`,
      )
      .all() as Array<{ name: string }>;
    expect(rows).toHaveLength(1);
  });
});

// ── D1CheckpointStore ───────────────────────────────────────────────────────

describe('D1CheckpointStore', () => {
  let store: D1CheckpointStore;

  beforeEach(() => {
    store = new D1CheckpointStore(testDb.db);
  });

  it('returns null when no checkpoint exists for a (jobId, stage)', async () => {
    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint).toBeNull();
  });

  it('saves and reads back a checkpoint with an artifact', async () => {
    await store.saveGenerationCheckpoint(JOB_ID, 'strategy', {
      status: 'completed',
      artifact: { topic: 'AI news' },
      completedAt: '2026-08-22T00:00:00Z',
    });

    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.stage).toBe('strategy');
    expect(checkpoint?.status).toBe('completed');
    expect(checkpoint?.artifact).toEqual({ topic: 'AI news' });
    expect(checkpoint?.completedAt).toBe('2026-08-22T00:00:00Z');
  });

  it('upserts an existing checkpoint (no duplicate rows)', async () => {
    await store.saveGenerationCheckpoint(JOB_ID, 'script', { status: 'running' });
    await store.saveGenerationCheckpoint(JOB_ID, 'script', {
      status: 'completed',
      artifact: { title: 'Script title' },
      completedAt: '2026-08-22T00:00:00Z',
    });

    const rows = testDb.raw
      .prepare('SELECT COUNT(*) AS cnt FROM youtube_pipeline_checkpoints WHERE job_id = ? AND stage = ?')
      .get(JOB_ID, 'script') as { cnt: number };
    expect(rows.cnt).toBe(1);

    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'script');
    expect(checkpoint?.status).toBe('completed');
    expect(checkpoint?.artifact).toEqual({ title: 'Script title' });
  });

  it('stores error and attempt fields', async () => {
    await store.saveGenerationCheckpoint(JOB_ID, 'strategy', {
      status: 'failed',
      error: 'boom',
      attempt: 2,
    });

    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint?.status).toBe('failed');
    expect(checkpoint?.error).toBe('boom');
    expect(checkpoint?.attempt).toBe(2);
  });

  it('returns null when the stored artifact is malformed JSON', async () => {
    testDb.raw
      .prepare(
        `INSERT INTO youtube_pipeline_checkpoints (job_id, stage, status, artifact)
         VALUES (?, ?, 'completed', ?)`,
      )
      .run(JOB_ID, 'strategy', 'not-json');

    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.artifact).toBeUndefined();
    expect(checkpoint?.status).toBe('completed');
  });

  it('returns null when the artifact column is null', async () => {
    testDb.raw
      .prepare(
        `INSERT INTO youtube_pipeline_checkpoints (job_id, stage, status, artifact)
         VALUES (?, ?, 'completed', NULL)`,
      )
      .run(JOB_ID, 'strategy');

    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.artifact).toBeUndefined();
  });

  it('deletes checkpoints for the given stages', async () => {
    await store.saveGenerationCheckpoint(JOB_ID, 'strategy', { status: 'completed' });
    await store.saveGenerationCheckpoint(JOB_ID, 'script', { status: 'completed' });
    await store.saveGenerationCheckpoint(JOB_ID, 'seo', { status: 'completed' });

    await store.deleteGenerationCheckpoints(JOB_ID, ['strategy', 'script']);

    expect(await store.getGenerationCheckpoint(JOB_ID, 'strategy')).toBeNull();
    expect(await store.getGenerationCheckpoint(JOB_ID, 'script')).toBeNull();
    expect(await store.getGenerationCheckpoint(JOB_ID, 'seo')).not.toBeNull();
  });

  it('is a no-op when deleting zero stages', async () => {
    await store.saveGenerationCheckpoint(JOB_ID, 'strategy', { status: 'completed' });
    await store.deleteGenerationCheckpoints(JOB_ID, []);

    const checkpoint = await store.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint).not.toBeNull();
  });

  it('returns a row via getGenerationJob', async () => {
    await store.saveGenerationCheckpoint(JOB_ID, 'strategy', { status: 'completed' });
    const job = await store.getGenerationJob(JOB_ID);
    expect(job).not.toBeNull();
    expect(job?.job_id).toBe(JOB_ID);
  });

  it('returns null via getGenerationJob when nothing exists', async () => {
    const job = await store.getGenerationJob('missing-job');
    expect(job).toBeNull();
  });
});

// ── createCheckpointStore factory ───────────────────────────────────────────

describe('createCheckpointStore', () => {
  it('returns a D1CheckpointStore when D1 is available', async () => {
    const store = await createCheckpointStore();
    expect(store).toBeInstanceOf(D1CheckpointStore);
  });

  it('returns null when D1 is unavailable', async () => {
    vi.mocked(getD1).mockResolvedValue(null);
    const store = await createCheckpointStore();
    expect(store).toBeNull();
  });

  it('returns a usable store even when ensureCheckpointTable fails', async () => {
    // ensureCheckpointTable runs CREATE TABLE via prepare().run() — make that
    // specific statement throw. The table already exists in the test schema,
    // so the store remains fully usable afterwards.
    const originalPrepare = testDb.db.prepare.bind(testDb.db);
    testDb.db.prepare = (sql: string) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS')) {
        throw new Error('create table failed');
      }
      return originalPrepare(sql);
    };

    const store = await createCheckpointStore();
    expect(store).toBeInstanceOf(D1CheckpointStore);

    await store!.saveGenerationCheckpoint(JOB_ID, 'strategy', { status: 'running' });
    const checkpoint = await store!.getGenerationCheckpoint(JOB_ID, 'strategy');
    expect(checkpoint?.status).toBe('running');
  });
});