/**
 * Schema-level constraint tests for the partial unique index on
 * publishing_jobs(video_id, channel_id) WHERE status IN ('scheduled','uploading','processing').
 *
 * Uses better-sqlite3 in-memory DB to exercise the real SQLite index behaviour
 * without any mocked D1 shim — the only reliable way to verify a DDL constraint.
 *
 * Migration file: migrations/0121_unique_publishing_jobs_video_channel.sql
 */
import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// __dirname = apps/sophia-ai-factory/src/land/publish/__tests__
// migrations/ = apps/sophia-ai-factory/migrations/ → 4 levels up from __tests__
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');

function buildSchema(db: Database.Database): void {
  // Minimal table from migration 0101 (publishing_jobs canonical schema).
  db.exec(`
    CREATE TABLE IF NOT EXISTS publishing_jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('scheduled','uploading','processing','live','failed')),
      caption TEXT,
      hashtags_json TEXT,
      product_link TEXT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at INTEGER NOT NULL,
      provider TEXT NOT NULL DEFAULT ''
    );
  `);

  // Apply the partial unique index from migration 0121.
  const migrationSql = fs.readFileSync(
    path.join(MIGRATIONS_DIR, '0121_unique_publishing_jobs_video_channel.sql'),
    'utf-8',
  );
  db.exec(migrationSql);
}

function insertJob(
  db: Database.Database,
  id: string,
  videoId: string,
  channelId: string,
  status: string,
): void {
  db.prepare(
    `INSERT INTO publishing_jobs
       (id, tenant_id, video_id, channel_id, status, scheduled_at, created_at)
     VALUES (?, 'tenant1', ?, ?, ?, ?, ?)`,
  ).run(id, videoId, channelId, status, Date.now() + 60, Date.now());
}

describe('publishing_jobs partial unique index (migration 0121)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    buildSchema(db);
  });

  it('allows first active job for (video_id, channel_id)', () => {
    expect(() => insertJob(db, 'job1', 'videoA', 'channelB', 'scheduled')).not.toThrow();
  });

  it('rejects second active job with same (video_id, channel_id) and same active status', () => {
    insertJob(db, 'job1', 'videoA', 'channelB', 'scheduled');
    expect(() => insertJob(db, 'job2', 'videoA', 'channelB', 'scheduled')).toThrow(
      /UNIQUE constraint failed/,
    );
  });

  it('rejects duplicate across different active statuses (scheduled vs uploading)', () => {
    insertJob(db, 'job1', 'videoA', 'channelB', 'scheduled');
    expect(() => insertJob(db, 'job2', 'videoA', 'channelB', 'uploading')).toThrow(
      /UNIQUE constraint failed/,
    );
  });

  it('rejects duplicate when existing job is in processing status', () => {
    insertJob(db, 'job1', 'videoA', 'channelB', 'processing');
    expect(() => insertJob(db, 'job2', 'videoA', 'channelB', 'scheduled')).toThrow(
      /UNIQUE constraint failed/,
    );
  });

  it('allows new job for same (video_id, channel_id) after previous job reached terminal status "live"', () => {
    insertJob(db, 'job1', 'videoA', 'channelB', 'live');
    // job1 is terminal → partial index does not cover it → new job is allowed.
    expect(() => insertJob(db, 'job2', 'videoA', 'channelB', 'scheduled')).not.toThrow();
  });

  it('allows new job for same (video_id, channel_id) after previous job reached terminal status "failed"', () => {
    insertJob(db, 'job1', 'videoA', 'channelB', 'failed');
    expect(() => insertJob(db, 'job2', 'videoA', 'channelB', 'scheduled')).not.toThrow();
  });

  it('allows two independent active jobs for different (video_id, channel_id) pairs', () => {
    insertJob(db, 'job1', 'videoA', 'channelB', 'scheduled');
    // Same video, different channel — must be allowed.
    expect(() => insertJob(db, 'job2', 'videoA', 'channelC', 'scheduled')).not.toThrow();
    // Different video, same channel — must be allowed.
    expect(() => insertJob(db, 'job3', 'videoX', 'channelB', 'scheduled')).not.toThrow();
  });

  it('idempotent: running the migration SQL a second time does not error (IF NOT EXISTS)', () => {
    expect(() => buildSchema(db)).not.toThrow();
  });
});
