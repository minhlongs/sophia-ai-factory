/**
 * Tests for cascadeDeleteAccount (Wave 22 Phase 06 + R2 cleanup fix).
 */

import { describe, it, expect, vi } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';
import {
  cascadeDeleteAccount,
  ACCOUNT_DELETE_ORDER,
} from '../cascade-delete';

interface SqlCall {
  sql: string;
  binds: unknown[];
}

function makeDb(opts: {
  rowsPerTable?: Record<string, number>;
  throwOn?: string;
  r2KeyRows?: {
    video_jobs?: Array<{
      audio_r2_key: string | null;
      visual_r2_key: string | null;
      final_r2_key: string | null;
    }>;
    batch_jobs?: Array<{ input_r2_key: string | null }>;
    thumbnail_variants?: Array<{
      r2_key: string | null;
      preview_r2_key: string | null;
    }>;
  };
} = {}) {
  const calls: SqlCall[] = [];
  const db = {
    prepare: vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockImplementation((...binds: unknown[]) => {
        calls.push({ sql, binds });

        // video_jobs SELECT (collectTenantR2Keys)
        if (sql.includes('SELECT') && sql.includes('FROM video_jobs')) {
          const rows = opts.r2KeyRows?.video_jobs ?? [];
          return {
            all: vi.fn().mockResolvedValue({
              results: rows.map((r) => ({ ...r })),
            }),
          };
        }

        // batch_jobs SELECT (collectTenantR2Keys)
        if (sql.includes('SELECT') && sql.includes('FROM batch_jobs')) {
          const rows = opts.r2KeyRows?.batch_jobs ?? [];
          return {
            all: vi.fn().mockResolvedValue({
              results: rows.map((r) => ({ ...r })),
            }),
          };
        }

        // thumbnail_variants SELECT (collectTenantR2Keys)
        if (
          sql.includes('SELECT') &&
          sql.includes('FROM thumbnail_variants')
        ) {
          const rows = opts.r2KeyRows?.thumbnail_variants ?? [];
          return {
            all: vi.fn().mockResolvedValue({
              results: rows.map((r) => ({ ...r })),
            }),
          };
        }

        // account_deletion_requests cleanup
        if (sql.includes('FROM account_deletion_requests')) {
          return {
            run: vi.fn().mockResolvedValue({ meta: { rows_written: 1 } }),
          };
        }

        // ACCOUNT_DELETE_ORDER DELETE statements
        for (const table of ACCOUNT_DELETE_ORDER) {
          if (sql.includes(`FROM ${table}`)) {
            if (opts.throwOn === table)
              return {
                run: vi.fn().mockRejectedValue(new Error(`fail-${table}`)),
              };
            return {
              run: vi.fn().mockResolvedValue({
                meta: { rows_written: opts.rowsPerTable?.[table] ?? 0 },
              }),
            };
          }
        }

        return {
          run: vi.fn().mockResolvedValue({ meta: { rows_written: 0 } }),
        };
      }),
    })),
  };
  return { db: db as unknown as D1Database, calls };
}

function makeR2Bucket(deleteMap: Record<string, 'ok' | 'fail'> = {}) {
  const deletedKeys: string[] = [];
  const bucket = {
    delete: vi.fn().mockImplementation(async (key: string) => {
      deletedKeys.push(key);
      if (deleteMap[key] === 'fail') {
        throw new Error(`R2-delete-fail:${key}`);
      }
    }),
    _getDeleted: () => deletedKeys,
  };
  return bucket as typeof bucket & R2Bucket;
}

describe('cascadeDeleteAccount', () => {
  it('issues a DELETE for every table in ACCOUNT_DELETE_ORDER', async () => {
    const { db, calls } = makeDb();
    const res = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');

    for (const table of ACCOUNT_DELETE_ORDER) {
      expect(
        calls.some(
          (c) => c.sql.includes(`FROM ${table}`) && c.binds[0] === 'tenant-1',
        ),
      ).toBe(true);
    }
    expect(Object.keys(res.byTable)).toEqual([...ACCOUNT_DELETE_ORDER]);
    expect(res.r2Deleted).toBe(0); // no bucket supplied
  });

  it('sums rows_written across tables into totalDeleted', async () => {
    const { db } = makeDb({
      rowsPerTable: {
        audit_log: 3,
        publishing_results: 5,
        users: 1,
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    expect(res.totalDeleted).toBe(9);
    expect(res.byTable.audit_log).toBe(3);
    expect(res.byTable.publishing_results).toBe(5);
    expect(res.byTable.users).toBe(1);
  });

  it('returns 0 for table when DELETE throws (idempotent failure)', async () => {
    const { db } = makeDb({
      throwOn: 'sessions',
      rowsPerTable: { users: 1 },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    expect(res.byTable.sessions).toBe(0);
    expect(res.byTable.users).toBe(1);
  });

  it('cleans up account_deletion_requests row by user_id', async () => {
    const { db, calls } = makeDb();
    await cascadeDeleteAccount(db, 'user-9', 'tenant-9');
    expect(
      calls.some(
        (c) =>
          c.sql.includes('FROM account_deletion_requests') &&
          c.binds[0] === 'user-9',
      ),
    ).toBe(true);
  });

  it('is idempotent when run twice on already-deleted tenant', async () => {
    const { db } = makeDb({ rowsPerTable: {} });
    const a = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    const b = await cascadeDeleteAccount(db, 'user-1', 'tenant-1');
    expect(a.totalDeleted).toBe(0);
    expect(b.totalDeleted).toBe(0);
  });
});

describe('cascadeDeleteAccount — R2 cleanup', () => {
  it('collects R2 keys from video_jobs and deletes them', async () => {
    const bucket = makeR2Bucket();
    const { db } = makeDb({
      r2KeyRows: {
        video_jobs: [
          {
            audio_r2_key: 'tenants/t-1/videos/j1/audio.wav',
            visual_r2_key: 'tenants/t-1/videos/j1/visual.mp4',
            final_r2_key: 'tenants/t-1/videos/j1/final.mp4',
          },
        ],
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    expect(res.r2Deleted).toBe(3);
    expect(bucket._getDeleted()).toHaveLength(3);
    expect(bucket._getDeleted()).toContain(
      'tenants/t-1/videos/j1/audio.wav',
    );
  });

  it('collects R2 keys from batch_jobs via user→tenant join', async () => {
    const bucket = makeR2Bucket();
    const { db } = makeDb({
      r2KeyRows: {
        batch_jobs: [{ input_r2_key: 'batch-uploads/u-1/input.zip' }],
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    expect(res.r2Deleted).toBe(1);
    expect(bucket._getDeleted()).toContain('batch-uploads/u-1/input.zip');
  });

  it('collects R2 keys from thumbnail_variants via user→tenant join', async () => {
    const bucket = makeR2Bucket();
    const { db } = makeDb({
      r2KeyRows: {
        thumbnail_variants: [
          { r2_key: 'thumbs/v-1/0.jpg', preview_r2_key: 'thumbs/v-1/0-preview.jpg' },
        ],
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    expect(res.r2Deleted).toBe(2);
  });

  it('deduplicates R2 keys appearing in multiple tables', async () => {
    const bucket = makeR2Bucket();
    const { db } = makeDb({
      r2KeyRows: {
        video_jobs: [
          {
            audio_r2_key: null,
            visual_r2_key: null,
            final_r2_key: 'shared/key.mp4',
          },
        ],
        batch_jobs: [{ input_r2_key: 'shared/key.mp4' }],
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    // same key in two tables → deleted once
    expect(bucket._getDeleted().filter((k) => k === 'shared/key.mp4')).toHaveLength(1);
    expect(res.r2Deleted).toBe(1);
  });

  it('skips null R2 keys (columns may be unset)', async () => {
    const bucket = makeR2Bucket();
    const { db } = makeDb({
      r2KeyRows: {
        video_jobs: [
          {
            audio_r2_key: 'tenants/t-1/videos/j1/audio.wav',
            visual_r2_key: null,
            final_r2_key: null,
          },
        ],
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    expect(res.r2Deleted).toBe(1);
  });

  it('logs but continues when individual R2 delete fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bucket = makeR2Bucket({
      'tenants/t-1/videos/j1/final.mp4': 'fail',
    });
    const { db } = makeDb({
      r2KeyRows: {
        video_jobs: [
          {
            audio_r2_key: 'tenants/t-1/videos/j1/audio.wav',
            visual_r2_key: null,
            final_r2_key: 'tenants/t-1/videos/j1/final.mp4',
          },
        ],
      },
    });
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    // one succeeded, one failed → r2Deleted = 1, not 0
    expect(res.r2Deleted).toBe(1);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns r2Deleted=0 when bucket supplied but no keys found', async () => {
    const bucket = makeR2Bucket();
    const { db } = makeDb({});
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1', bucket);
    expect(res.r2Deleted).toBe(0);
    expect(bucket._getDeleted()).toHaveLength(0);
  });

  it('returns r2Deleted=0 when no bucket supplied (backward compat)', async () => {
    const { db } = makeDb({});
    const res = await cascadeDeleteAccount(db, 'user-1', 't-1');
    expect(res.r2Deleted).toBe(0);
  });
});
