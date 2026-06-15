/**
 * Tests for cron-run-stats — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { listCronRunSummaries } from './cron-run-stats';

interface RawRow {
  cron_name: string;
  last_run_at: number;
  last_status: string;
  last_error: string | null;
  run_count: number;
}

function setD1Mock(rows: RawRow[]) {
  const all = vi.fn().mockResolvedValue({ results: rows, success: true });
  const bind = vi.fn().mockReturnValue({ all });
  const db = { prepare: vi.fn().mockReturnValue({ bind, all }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('listCronRunSummaries', () => {
  it('returns empty array when no rows', async () => {
    setD1Mock([]);
    const result = await listCronRunSummaries();
    expect(result).toEqual([]);
  });

  it('maps fields and computes ageSec', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    setD1Mock([
      {
        cron_name: 'email-drip',
        last_run_at: nowSec - 600,
        last_status: 'success',
        last_error: null,
        run_count: 42,
      },
    ]);
    const result = await listCronRunSummaries();
    expect(result.length).toBe(1);
    expect(result[0].cronName).toBe('email-drip');
    expect(result[0].lastStatus).toBe('success');
    expect(result[0].runCount).toBe(42);
    expect(result[0].ageSec).toBeGreaterThanOrEqual(599);
    expect(result[0].ageSec).toBeLessThanOrEqual(601);
  });

  it('passes through failure status + error message', async () => {
    setD1Mock([
      {
        cron_name: 'payout-batcher',
        last_run_at: 1700000000,
        last_status: 'failure',
        last_error: 'NOWPayments timeout',
        run_count: 5,
      },
    ]);
    const result = await listCronRunSummaries();
    expect(result[0].lastStatus).toBe('failure');
    expect(result[0].lastError).toBe('NOWPayments timeout');
  });

  it('preserves DESC order from SQL', async () => {
    setD1Mock([
      { cron_name: 'a', last_run_at: 200, last_status: 'success', last_error: null, run_count: 1 },
      { cron_name: 'b', last_run_at: 100, last_status: 'success', last_error: null, run_count: 1 },
    ]);
    const result = await listCronRunSummaries();
    expect(result.map((r) => r.cronName)).toEqual(['a', 'b']);
  });

  it('coerces numeric strings to numbers (D1 driver edge case)', async () => {
    setD1Mock([
      {
        cron_name: 'x',
        last_run_at: '1700000000' as unknown as number,
        last_status: 'success',
        last_error: null,
        run_count: '7' as unknown as number,
      },
    ]);
    const result = await listCronRunSummaries();
    expect(typeof result[0].lastRunAt).toBe('number');
    expect(typeof result[0].runCount).toBe('number');
    expect(result[0].runCount).toBe(7);
  });
});
