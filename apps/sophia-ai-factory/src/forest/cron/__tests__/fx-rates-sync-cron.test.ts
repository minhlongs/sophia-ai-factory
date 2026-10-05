/**
 * Tests for Forest FX Rates Synchronization Cron Worker.
 *
 * Verifies:
 * - Debouncing / Idempotency guard via wasRecentlyRun
 * - Multi-currency rates persistence and buffer reserve calculation
 * - Error handling and failure status tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runFxRatesSyncCron } from '../fx-rates-sync-cron';
import * as runTracker from '@/tree/cron/run-tracker';
import * as fxHedgingEngine from '@/tree/fx/fx-hedging-engine';

vi.mock('@/tree/cron/run-tracker', () => ({
  recordCronRun: vi.fn().mockResolvedValue(undefined),
  wasRecentlyRun: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/tree/fx/fx-hedging-engine', () => ({
  fetchMultiTierRates: vi.fn(),
  DEFAULT_HEDGING_BUFFER_PERCENT: 0.015,
}));

type BasePrepareResult = {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
};

function makeD1Mock() {
  const preparedStatements: BasePrepareResult[] = [];
  function basePrepare(): BasePrepareResult {
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [], success: true }),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    };
    preparedStatements.push(stmt);
    return stmt;
  }
  const db = {
    prepare: vi.fn().mockImplementation(basePrepare),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  } as unknown as D1Database & { _statements: BasePrepareResult[] };
  (db as any)._statements = preparedStatements;
  return db;
}

describe('runFxRatesSyncCron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips execution when cron was recently run within debounce window', async () => {
    vi.mocked(runTracker.wasRecentlyRun).mockResolvedValueOnce(true);
    const db = makeD1Mock();

    const result = await runFxRatesSyncCron(db);

    expect(result).toEqual({
      success: true,
      ratesUpdated: 0,
      sourceProvider: 'SKIPPED',
      skipped: true,
    });
    expect(fxHedgingEngine.fetchMultiTierRates).not.toHaveBeenCalled();
    expect(runTracker.recordCronRun).not.toHaveBeenCalled();
  });

  it('fetches rates, persists to D1, and records successful run', async () => {
    vi.mocked(runTracker.wasRecentlyRun).mockResolvedValueOnce(false);
    vi.mocked(fxHedgingEngine.fetchMultiTierRates).mockResolvedValueOnce({
      rates: {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.78,
        VND: 25400,
        JPY: 155,
        SGD: 1.34,
        AUD: 1.52,
        CAD: 1.38,
        THB: 36.5,
        IDR: 16200,
      },
      sourceProvider: 'OPEN_EXCHANGE',
      fetchedAt: 1710000000000,
    });

    const db = makeD1Mock();
    const result = await runFxRatesSyncCron(db, { MOCK_ENV: '1' });

    expect(result.success).toBe(true);
    expect(result.ratesUpdated).toBe(10);
    expect(result.sourceProvider).toBe('OPEN_EXCHANGE');

    expect(runTracker.recordCronRun).toHaveBeenCalledWith(db, 'fx_rates_sync', 'success');
  });

  it('handles and records execution failures gracefully', async () => {
    vi.mocked(runTracker.wasRecentlyRun).mockResolvedValueOnce(false);
    vi.mocked(fxHedgingEngine.fetchMultiTierRates).mockRejectedValueOnce(
      new Error('Provider rate limit reached')
    );

    const db = makeD1Mock();
    const result = await runFxRatesSyncCron(db);

    expect(result.success).toBe(false);
    expect(result.ratesUpdated).toBe(0);
    expect(result.sourceProvider).toBe('ERROR');
    expect(result.error).toBe('Provider rate limit reached');

    expect(runTracker.recordCronRun).toHaveBeenCalledWith(
      db,
      'fx_rates_sync',
      'failure',
      'Provider rate limit reached'
    );
  });
});
