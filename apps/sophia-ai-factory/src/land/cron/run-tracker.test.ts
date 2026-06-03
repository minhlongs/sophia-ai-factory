/**
 * Tests for cron run-tracker helpers.
 * Uses an in-memory D1 mock that matches the global d1Mock in test setup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordCronRun, wasRecentlyRun, getCronHealth } from './run-tracker';

// ── D1 mock factory ────────────────────────────────────────────────────
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

// ── recordCronRun ──────────────────────────────────────────────────────
describe('recordCronRun', () => {
  it('calls prepare + bind + run for a success status', async () => {
    const db = makeD1Mock();
    await recordCronRun(db, 'test-cron', 'success');

    expect(db.prepare).toHaveBeenCalledOnce();
    const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith('test-cron', expect.any(Number), 'success', null);
    expect(stmt.run).toHaveBeenCalledOnce();
  });

  it('passes error string when status is failure', async () => {
    const db = makeD1Mock();
    await recordCronRun(db, 'test-cron', 'failure', 'DB timeout');

    const stmt = (db.prepare as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(stmt.bind).toHaveBeenCalledWith('test-cron', expect.any(Number), 'failure', 'DB timeout');
  });

  it('does not throw when DB run() rejects', async () => {
    const db = makeD1Mock({ run: vi.fn().mockRejectedValue(new Error('D1 error')) });
    await expect(recordCronRun(db, 'fail-cron', 'success')).resolves.toBeUndefined();
  });
});

// ── wasRecentlyRun ─────────────────────────────────────────────────────
describe('wasRecentlyRun', () => {
  it('returns false when no recent row exists', async () => {
    const db = makeD1Mock({ first: vi.fn().mockResolvedValue(null) });
    const result = await wasRecentlyRun(db, 'test-cron', 5 * 60 * 1000);
    expect(result).toBe(false);
  });

  it('returns true when a recent row is found', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const db = makeD1Mock({ first: vi.fn().mockResolvedValue({ last_run_at: nowSec }) });
    const result = await wasRecentlyRun(db, 'test-cron', 5 * 60 * 1000);
    expect(result).toBe(true);
  });

  it('returns true (fail-closed) when DB first() rejects — prevents double cron execution', async () => {
    const db = makeD1Mock({ first: vi.fn().mockRejectedValue(new Error('D1 error')) });
    const result = await wasRecentlyRun(db, 'test-cron', 5 * 60 * 1000);
    expect(result).toBe(true);
  });
});

// ── getCronHealth ──────────────────────────────────────────────────────
describe('getCronHealth', () => {
  it('returns null when no record found', async () => {
    const db = makeD1Mock({ first: vi.fn().mockResolvedValue(null) });
    const result = await getCronHealth(db, 'test-cron');
    expect(result).toBeNull();
  });

  it('returns the health record when row exists', async () => {
    const record = {
      cron_name: 'heartbeat',
      last_run_at: 1700000000,
      last_status: 'success',
      last_error: null,
      run_count: 42,
    };
    const db = makeD1Mock({ first: vi.fn().mockResolvedValue(record) });
    const result = await getCronHealth(db, 'heartbeat');
    expect(result).toEqual(record);
  });

  it('returns null (fail-safe) when DB rejects', async () => {
    const db = makeD1Mock({ first: vi.fn().mockRejectedValue(new Error('D1 error')) });
    const result = await getCronHealth(db, 'test-cron');
    expect(result).toBeNull();
  });
});
