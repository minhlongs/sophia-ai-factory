/**
 * Tests for affiliate leaderboard primitive — D1 mocked.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTopAffiliates } from './leaderboard';

interface RawRow {
  affiliate_id: string;
  email: string | null;
  name: string | null;
  total_clicks: number;
  total_conversions: number;
  total_commission: number;
  epc_calc: number;
}

function setD1Mock(opts: { rows?: RawRow[]; bindCapture?: (...args: unknown[]) => void }) {
  const all = vi.fn().mockResolvedValue({ results: opts.rows ?? [], success: true });
  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    opts.bindCapture?.(...args);
    return { all };
  });
  const prepare = vi.fn().mockReturnValue({ bind });
  const db = { prepare };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
  return { prepare };
}

afterEach(() => vi.clearAllMocks());

describe('getTopAffiliates', () => {
  it('returns empty array when no rows', async () => {
    setD1Mock({});
    const result = await getTopAffiliates(0, 1000, 10, 'epc');
    expect(result).toEqual([]);
  });

  it('maps fields and computes EPC from totals', async () => {
    setD1Mock({
      rows: [
        {
          affiliate_id: 'aff-1',
          email: 'a@x.com',
          name: 'Alex',
          total_clicks: 100,
          total_conversions: 5,
          total_commission: 50,
          epc_calc: 0.5,
        },
      ],
    });
    const result = await getTopAffiliates(0, 1000, 10, 'epc');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      affiliateId: 'aff-1',
      email: 'a@x.com',
      name: 'Alex',
      totalClicks: 100,
      totalConversions: 5,
      totalCommissionUsd: 50,
      epc: 0.5,
    });
  });

  it('EPC is 0 when totalClicks is 0', async () => {
    setD1Mock({
      rows: [
        {
          affiliate_id: 'aff-zero', email: null, name: null,
          total_clicks: 0, total_conversions: 0, total_commission: 25, epc_calc: 0,
        },
      ],
    });
    const result = await getTopAffiliates(0, 1000, 10, 'epc');
    expect(result[0].epc).toBe(0);
  });

  it('clamps limit to [1,100] and floors fractional', async () => {
    const bound: unknown[][] = [];
    setD1Mock({ rows: [], bindCapture: (...args) => bound.push(args) });
    await getTopAffiliates(0, 1000, 9999, 'epc');
    expect(bound[0][2]).toBe(100);

    bound.length = 0;
    await getTopAffiliates(0, 1000, 0, 'epc');
    expect(bound[0][2]).toBe(1);

    bound.length = 0;
    await getTopAffiliates(0, 1000, 25.7, 'epc');
    expect(bound[0][2]).toBe(25);
  });

  it('throws when fromTs > toTs', async () => {
    setD1Mock({});
    await expect(getTopAffiliates(2000, 1000, 10, 'epc')).rejects.toThrow(/fromTs/);
  });

  it('changes ORDER BY column based on sortBy', async () => {
    const sql: string[] = [];
    const all = vi.fn().mockResolvedValue({ results: [], success: true });
    const bind = vi.fn().mockReturnValue({ all });
    const prepare = vi.fn().mockImplementation((q: string) => {
      sql.push(q);
      return { bind };
    });
    (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
      ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
      DB: { prepare },
    };

    await getTopAffiliates(0, 1000, 10, 'epc');
    expect(sql[0]).toMatch(/ORDER BY epc_calc/);

    await getTopAffiliates(0, 1000, 10, 'conversions');
    expect(sql[1]).toMatch(/ORDER BY total_conversions/);

    await getTopAffiliates(0, 1000, 10, 'commission');
    expect(sql[2]).toMatch(/ORDER BY total_commission/);
  });

  it('coerces numeric strings from D1 driver', async () => {
    setD1Mock({
      rows: [
        {
          affiliate_id: 'aff-2', email: null, name: null,
          total_clicks: '50' as unknown as number,
          total_conversions: '3' as unknown as number,
          total_commission: '12.5' as unknown as number,
          epc_calc: 0.25,
        },
      ],
    });
    const result = await getTopAffiliates(0, 1000, 10, 'epc');
    expect(typeof result[0].totalClicks).toBe('number');
    expect(result[0].totalCommissionUsd).toBe(12.5);
    expect(result[0].epc).toBeCloseTo(0.25);
  });
});
