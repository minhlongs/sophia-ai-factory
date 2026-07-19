/**
 * Tests for cost-snapshot primitive — D1 mocked with sequenced responses.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCostSnapshot } from './cost-snapshot';

interface GlobalResp { total_cost: number; total_units: number; line_count: number; job_count: number }
interface BucketResp { bucket: string; cost: number; units: number; n: number }
interface TenantResp { tenant_id: string; cost: number; line_count: number; job_count: number }

function setD1Mock(opts: {
  global?: GlobalResp | null;
  byStage?: BucketResp[];
  byProvider?: BucketResp[];
  topTenants?: TenantResp[];
  bindCapture?: (...args: unknown[]) => void;
}) {
  let firstCall = 0;
  let allCall = 0;
  const first = vi.fn().mockImplementation(() => {
    firstCall++;
    return Promise.resolve(opts.global ?? null);
  });
  const all = vi.fn().mockImplementation(() => {
    allCall++;
    if (allCall === 1) return Promise.resolve({ results: opts.byStage ?? [], success: true });
    if (allCall === 2) return Promise.resolve({ results: opts.byProvider ?? [], success: true });
    return Promise.resolve({ results: opts.topTenants ?? [], success: true });
  });
  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    opts.bindCapture?.(...args);
    return { first, all };
  });
  const db = { prepare: vi.fn().mockReturnValue({ bind }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

describe('getCostSnapshot', () => {
  it('returns zero snapshot when DB empty', async () => {
    setD1Mock({});
    const result = await getCostSnapshot(0, 100);
    expect(result.global).toEqual({ totalCostUsd: 0, totalUnits: 0, lineCount: 0, jobCount: 0 });
    expect(result.byStage).toEqual([]);
    expect(result.byProvider).toEqual([]);
    expect(result.topTenants).toEqual([]);
    expect(result.monthlyProjectionUsd).toBe(0);
  });

  it('extrapolates monthly projection from window', async () => {
    // 1 day window with $10 spent → 30 days = $300
    setD1Mock({
      global: { total_cost: 10, total_units: 100, line_count: 5, job_count: 2 },
    });
    const result = await getCostSnapshot(0, 86400);
    expect(result.monthlyProjectionUsd).toBeCloseTo(300, 1);
  });

  it('maps stage + provider buckets', async () => {
    setD1Mock({
      byStage: [
        { bucket: 'tts', cost: 5, units: 100, n: 10 },
        { bucket: 'visual', cost: 3, units: 50, n: 5 },
      ],
      byProvider: [
        { bucket: 'coqui', cost: 5, units: 100, n: 10 },
        { bucket: 'moviepy', cost: 3, units: 50, n: 5 },
      ],
    });
    const result = await getCostSnapshot(0, 100);
    expect(result.byStage).toHaveLength(2);
    expect(result.byStage[0]).toEqual({ bucket: 'tts', costUsd: 5, units: 100, lineCount: 10 });
    expect(result.byProvider[0].bucket).toBe('coqui');
  });

  it('maps top tenants', async () => {
    setD1Mock({
      topTenants: [
        { tenant_id: 't-1', cost: 25.5, line_count: 50, job_count: 12 },
      ],
    });
    const result = await getCostSnapshot(0, 100);
    expect(result.topTenants).toHaveLength(1);
    expect(result.topTenants[0]).toEqual({
      tenantId: 't-1',
      costUsd: 25.5,
      lineCount: 50,
      jobCount: 12,
    });
  });

  it('throws when fromTs > toTs', async () => {
    setD1Mock({});
    await expect(getCostSnapshot(200, 100)).rejects.toThrow(/fromTs/);
  });

  it('clamps limit to [1, 100] and floors fractional', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ bindCapture: (...args) => bound.push(args) });
    await getCostSnapshot(0, 100, 9999);
    // 4 queries fire; tenant query is the only one with limit bound (3 args).
    const tenantBinds = bound.find((b) => b.length === 3);
    expect(tenantBinds?.[2]).toBe(100);
  });

  it('coerces numeric strings from D1 driver', async () => {
    setD1Mock({
      global: {
        total_cost: '12.50' as unknown as number,
        total_units: '100' as unknown as number,
        line_count: '5' as unknown as number,
        job_count: '2' as unknown as number,
      },
    });
    const result = await getCostSnapshot(0, 100);
    expect(typeof result.global.totalCostUsd).toBe('number');
    expect(result.global.totalCostUsd).toBe(12.5);
    expect(result.global.lineCount).toBe(5);
  });
});
