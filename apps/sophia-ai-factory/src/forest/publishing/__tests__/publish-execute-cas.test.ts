/**
 * C3 Regression: CAS claim must block concurrent duplicate execution.
 *
 * Uses better-sqlite3 / FakeD1 to exercise the raw D1 UPDATE … WHERE status='scheduled'
 * pattern introduced in publish-execute.ts after the C3 fix.
 *
 * Verifies that only ONE of two concurrent claims succeeds (meta.changes === 1)
 * and the second returns meta.changes === 0 (skipped).
 */

import { describe, it, expect } from 'vitest';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS publishing_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER,
    retry_count INTEGER DEFAULT 0
  )`,
];

/**
 * Direct port of the CAS update from publish-execute.ts:
 *   rawDb.prepare('UPDATE publishing_jobs SET status = ?, started_at = ? WHERE id = ? AND status = ?')
 *        .bind('uploading', now, jobId, 'scheduled').run()
 */
async function attemptClaim(fakeDb: ReturnType<typeof createFakeD1>, jobId: string, now: number) {
  return fakeDb
    .prepare('UPDATE publishing_jobs SET status = ?, started_at = ? WHERE id = ? AND status = ?')
    .bind('uploading', now, jobId, 'scheduled')
    .run();
}

describe('C3 CAS regression — atomic claim blocks duplicate execution', () => {
  it('first claim succeeds (meta.changes === 1), second is a no-op (meta.changes === 0)', async () => {
    const fakeD1 = createFakeD1(SCHEMA);
    const jobId = 'job-cas-test-1';
    const now = Math.floor(Date.now() / 1000);

    // Seed a scheduled job
    fakeD1._db.prepare(`INSERT INTO publishing_jobs (id, tenant_id, status, retry_count) VALUES (?, ?, ?, 0)`)
      .run(jobId, 'tenant-1', 'scheduled');

    // First worker claims the job
    const result1 = await attemptClaim(fakeD1, jobId, now);
    expect(result1.meta.changes).toBe(1);

    // Second worker (concurrent / retry) attempts the same claim — must be blocked
    const result2 = await attemptClaim(fakeD1, jobId, now + 1);
    expect(result2.meta.changes).toBe(0);
  });

  it('claim against non-existent job returns meta.changes === 0', async () => {
    const fakeD1 = createFakeD1(SCHEMA);
    const result = await attemptClaim(fakeD1, 'no-such-job', Math.floor(Date.now() / 1000));
    expect(result.meta.changes).toBe(0);
  });

  it('claim against already-uploading job returns meta.changes === 0', async () => {
    const fakeD1 = createFakeD1(SCHEMA);
    const jobId = 'job-uploading';
    const now = Math.floor(Date.now() / 1000);

    fakeD1._db.prepare(`INSERT INTO publishing_jobs (id, tenant_id, status, retry_count) VALUES (?, ?, ?, 0)`)
      .run(jobId, 'tenant-1', 'uploading');

    const result = await attemptClaim(fakeD1, jobId, now);
    expect(result.meta.changes).toBe(0);
  });

  it('parallel claims: exactly one succeeds out of two simultaneous attempts', async () => {
    const fakeD1 = createFakeD1(SCHEMA);
    const jobId = 'job-parallel';
    const now = Math.floor(Date.now() / 1000);

    fakeD1._db.prepare(`INSERT INTO publishing_jobs (id, tenant_id, status, retry_count) VALUES (?, ?, ?, 0)`)
      .run(jobId, 'tenant-1', 'scheduled');

    // Simulate two parallel workers — both fire at ~same time
    const [r1, r2] = await Promise.all([
      attemptClaim(fakeD1, jobId, now),
      attemptClaim(fakeD1, jobId, now),
    ]);

    const totalChanges = r1.meta.changes + r2.meta.changes;
    expect(totalChanges).toBe(1); // exactly one succeeds
  });
});
