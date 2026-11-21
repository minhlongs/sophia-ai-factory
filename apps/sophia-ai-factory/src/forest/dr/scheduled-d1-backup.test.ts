import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScheduledD1Backup } from './scheduled-d1-backup';

function mockDb(state: { status?: string; lastRunAt?: number; failWrite?: boolean; failRead?: boolean }) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        first: vi.fn(async () => {
          if (state.failRead) throw new Error('d1_read_failed');
          if (state.status === 'success' && (state.lastRunAt ?? 0) >= Number(args[1])) return { last_run_at: state.lastRunAt };
          return null;
        }),
        all: vi.fn(async () => ({ results: [{ name: 't', sql: 'CREATE TABLE t (id INT)' }] })),
        run: vi.fn(async () => {
          if (state.failWrite) return { success: false };
          expect(sql).toContain("WHERE excluded.last_status = 'success' OR cron_run_log.last_status != 'success'");
          const status = String(args[2]);
          const threshold = Number(args[4]);
          if (status === 'success' || state.status !== 'success' || (state.lastRunAt ?? 0) < threshold) {
            state.status = status;
            state.lastRunAt = Number(args[1]);
          }
          return { success: true };
        }),
      })),
      all: vi.fn(async () => ({ results: [] })),
    })),
  } as unknown as D1Database;
}

describe('runScheduledD1Backup', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('fails closed on lookup errors and missing bindings without R2 writes', async () => {
    const bucket = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    expect(await runScheduledD1Backup({})).toMatchObject({ ok: false });
    expect(await runScheduledD1Backup({ DB: mockDb({ failRead: true }), BACKUPS_BUCKET: bucket }))
      .toMatchObject({ ok: false, reason: 'backup_tracking_failed' });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('does not skip a recent failure or accept an invalid existing artifact', async () => {
    const state = { status: 'failure', lastRunAt: Math.floor(Date.now() / 1000) };
    const bucket = { head: vi.fn(async () => ({ size: 0 })), put: vi.fn() } as unknown as R2Bucket;
    expect(await runScheduledD1Backup({ DB: mockDb(state), BACKUPS_BUCKET: bucket }))
      .toMatchObject({ ok: false, reason: 'backup_failed', artifactPresent: false });
    expect(bucket.head).toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('skips when a successful backup exists in the 12h window', async () => {
    const bucket = { head: vi.fn(), put: vi.fn() } as unknown as R2Bucket;
    const res = await runScheduledD1Backup({ DB: mockDb({ status: 'success', lastRunAt: Math.floor(Date.now() / 1000) }), BACKUPS_BUCKET: bucket });
    expect(res).toEqual({ ok: true, skipped: true, reason: 'recently_run' });
    expect(bucket.head).not.toHaveBeenCalled();
  });

  it('distinguishes artifact failure from tracking failure and reuses valid artifacts on retry', async () => {
    let stored: R2Object | null = null;
    const bucket = {
      head: vi.fn(async () => stored),
      put: vi.fn(async (_k: string, body: Uint8Array, opts?: R2PutOptions) => {
        if (stored && opts?.onlyIf && 'etagDoesNotMatch' in opts.onlyIf) return null;
        stored = { size: body.byteLength, httpMetadata: opts?.httpMetadata, customMetadata: opts?.customMetadata } as R2Object;
        return stored;
      }),
    } as unknown as R2Bucket;
    const state = { failWrite: true } as { status?: string; lastRunAt?: number; failWrite?: boolean };
    const first = await runScheduledD1Backup({ DB: mockDb(state), BACKUPS_BUCKET: bucket });
    expect(first).toMatchObject({ ok: false, reason: 'backup_tracking_failed', artifactPresent: true });
    state.failWrite = false;
    const retry = await runScheduledD1Backup({ DB: mockDb(state), BACKUPS_BUCKET: bucket });
    expect(retry).toMatchObject({ ok: true, artifactPresent: true, reusedExistingArtifact: true });
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });

  it('handles competing claims via R2 create-only put without overwriting concurrent recent success', async () => {
    let stored: R2Object | null = null;
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => { releaseFirst = r; });
    const state: { status?: string; lastRunAt?: number } = {};
    let puts = 0;
    const bucket = {
      head: vi.fn(async () => stored),
      put: vi.fn(async (_k: string, body: Uint8Array, opts?: R2PutOptions) => {
        puts += 1;
        if (puts === 1) await gate;
        if (stored) return null;
        stored = { size: body.byteLength, httpMetadata: opts?.httpMetadata, customMetadata: opts?.customMetadata } as R2Object;
        return stored;
      }),
    } as unknown as R2Bucket;
    const run1 = runScheduledD1Backup({ DB: mockDb(state), BACKUPS_BUCKET: bucket });
    const run2 = runScheduledD1Backup({ DB: mockDb(state), BACKUPS_BUCKET: bucket });
    releaseFirst();
    const [a, b] = await Promise.all([run1, run2]);
    expect(a.ok && b.ok).toBe(true);
    expect([a.reusedExistingArtifact, b.reusedExistingArtifact].sort()).toEqual([false, true]);

    const failingBucket = { head: vi.fn(async () => null), put: vi.fn(async () => { throw new Error('r2_down'); }) } as unknown as R2Bucket;
    const failed = await runScheduledD1Backup({ DB: mockDb(state), BACKUPS_BUCKET: failingBucket });
    expect(failed).toMatchObject({ ok: true, skipped: true });

    const concurrentState = { status: 'success', lastRunAt: Math.floor(Date.now() / 1000) };
    const staleDb = mockDb(concurrentState);
    const raced = await runScheduledD1Backup({
      DB: {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: unknown[]) => ({
            first: vi.fn(async () => null),
            run: staleDb.prepare(sql).bind(...args).run,
          })),
        })),
      } as unknown as D1Database,
      BACKUPS_BUCKET: failingBucket,
    });
    expect(raced).toMatchObject({ ok: false, reason: 'backup_failed', artifactPresent: false });
    expect(concurrentState.status).toBe('success');
    expect(state.status).toBe('success');
  });
});
