/**
 * Tests for tree/cron run-tracker helpers.
 * Directly exercises the canonical run-tracker implementation in the tree layer.
 */

import { describe, it, expect, vi } from 'vitest';
import { recordCronRun, wasRecentlyRun, getCronHealth } from './run-tracker';

type BasePrepareResult = {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
};

function makeD1Mock(overrides?: Partial<BasePrepareResult>) {
  function basePrepare(): BasePrepareResult {
    return {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
      ...overrides,
    };
  }
  return {
    prepare: vi.fn().mockReturnValue(basePrepare()),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  } as unknown as D1Database;
}

describe('tree/cron run-tracker', () => {
  describe('recordCronRun', () => {
    it('records successful cron run with upsert bind parameters', async () => {
      const db = makeD1Mock();
      await recordCronRun(db, 'tree-cron-test', 'success');

      expect(db.prepare).toHaveBeenCalledOnce();
      const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(stmt.bind).toHaveBeenCalledWith('tree-cron-test', expect.any(Number), 'success', null);
      expect(stmt.run).toHaveBeenCalledOnce();
    });

    it('records failed cron run with error details', async () => {
      const db = makeD1Mock();
      await recordCronRun(db, 'tree-cron-test', 'failure', 'Connection timeout');

      const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(stmt.bind).toHaveBeenCalledWith('tree-cron-test', expect.any(Number), 'failure', 'Connection timeout');
    });

    it('handles database error gracefully without throwing', async () => {
      const db = makeD1Mock({ run: vi.fn().mockRejectedValue(new Error('D1 write fault')) });
      await expect(recordCronRun(db, 'faulty-cron', 'success')).resolves.toBeUndefined();
    });
  });

  describe('wasRecentlyRun', () => {
    it('returns false when no execution found within threshold', async () => {
      const db = makeD1Mock({ first: vi.fn().mockResolvedValue(null) });
      const result = await wasRecentlyRun(db, 'tree-cron-test', 60_000);
      expect(result).toBe(false);
    });

    it('returns true when an execution exists within threshold', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const db = makeD1Mock({ first: vi.fn().mockResolvedValue({ last_run_at: nowSec }) });
      const result = await wasRecentlyRun(db, 'tree-cron-test', 60_000);
      expect(result).toBe(true);
    });

    it('fails closed (returns true) on query error to prevent duplicate runs', async () => {
      const db = makeD1Mock({ first: vi.fn().mockRejectedValue(new Error('Query failed')) });
      const result = await wasRecentlyRun(db, 'tree-cron-test', 60_000);
      expect(result).toBe(true);
    });
  });

  describe('getCronHealth', () => {
    it('returns null if cron record does not exist', async () => {
      const db = makeD1Mock({ first: vi.fn().mockResolvedValue(null) });
      const result = await getCronHealth(db, 'tree-cron-test');
      expect(result).toBeNull();
    });

    it('returns record when cron run log entry is found', async () => {
      const mockRecord = {
        cron_name: 'tree-cron-test',
        last_run_at: 1710000000,
        last_status: 'success',
        last_error: null,
        run_count: 5,
      };
      const db = makeD1Mock({ first: vi.fn().mockResolvedValue(mockRecord) });
      const result = await getCronHealth(db, 'tree-cron-test');
      expect(result).toEqual(mockRecord);
    });

    it('returns null fail-safely on error', async () => {
      const db = makeD1Mock({ first: vi.fn().mockRejectedValue(new Error('DB read error')) });
      const result = await getCronHealth(db, 'tree-cron-test');
      expect(result).toBeNull();
    });
  });
});
