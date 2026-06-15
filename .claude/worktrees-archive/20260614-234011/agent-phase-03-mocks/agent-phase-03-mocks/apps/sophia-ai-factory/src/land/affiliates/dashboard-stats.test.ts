/**
 * Tests for dashboard-stats — getAffiliateClickStats + getRecentConversions.
 * D1 mocked via globalThis.__env.DB pattern (matches click-recorder.test.ts).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAffiliateClickStats, getRecentConversions } from './dashboard-stats';

interface FirstResult {
  total_clicks?: number;
  total_conversions?: number;
  total_commission?: number;
}

interface ConvRow {
  id: string;
  link_id: string;
  offer_id: string;
  network_transaction_id: string;
  gross_amount_usd: number;
  commission_usd: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  attributed_at: number;
}

function setD1Mock(opts: {
  clickRow?: FirstResult | null;
  convRow?: FirstResult | null;
  conversions?: ConvRow[];
  bindCapture?: (...args: unknown[]) => void;
}) {
  const queue: Array<FirstResult | null> = [
    opts.clickRow ?? null,
    opts.convRow ?? null,
  ];
  const bind = vi.fn().mockImplementation((...args: unknown[]) => {
    opts.bindCapture?.(...args);
    return {
      first: vi.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? null)),
      all: vi.fn().mockResolvedValue({ results: opts.conversions ?? [], success: true }),
    };
  });
  const db = { prepare: vi.fn().mockReturnValue({ bind }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('getAffiliateClickStats', () => {
  it('returns zero stats when no clicks and no conversions', async () => {
    setD1Mock({});
    const result = await getAffiliateClickStats('t1', 'aff1', 0, 1);
    expect(result).toEqual({
      totalClicks: 0,
      totalConversions: 0,
      totalCommissionUsd: 0,
      epc: 0,
    });
  });

  it('computes EPC = commission / clicks', async () => {
    setD1Mock({
      clickRow: { total_clicks: 100 },
      convRow: { total_conversions: 5, total_commission: 75 },
    });
    const result = await getAffiliateClickStats('t1', 'aff1', 0, 1);
    expect(result.totalClicks).toBe(100);
    expect(result.totalConversions).toBe(5);
    expect(result.totalCommissionUsd).toBe(75);
    expect(result.epc).toBeCloseTo(0.75, 2);
  });

  it('EPC is 0 when totalClicks is 0 (avoid division by zero)', async () => {
    setD1Mock({
      clickRow: { total_clicks: 0 },
      convRow: { total_conversions: 0, total_commission: 100 },
    });
    const result = await getAffiliateClickStats('t1', 'aff1', 0, 1);
    expect(result.epc).toBe(0);
  });

  it('coerces non-numeric commission to number', async () => {
    setD1Mock({
      clickRow: { total_clicks: 10 },
      convRow: { total_conversions: 1, total_commission: 12.5 },
    });
    const result = await getAffiliateClickStats('t1', 'aff1', 0, 1);
    expect(result.totalCommissionUsd).toBe(12.5);
  });

  it('binds tenantId, affiliateId, fromTs, toTs to both queries', async () => {
    const bound: unknown[][] = [];
    setD1Mock({
      bindCapture: (...args) => bound.push(args),
    });
    await getAffiliateClickStats('tenant-X', 'aff-Y', 1000, 2000);
    expect(bound[0]).toEqual(['tenant-X', 'aff-Y', 1000, 2000]);
    expect(bound[1]).toEqual(['tenant-X', 'aff-Y', 1000, 2000]);
  });
});

describe('getRecentConversions', () => {
  it('returns empty array when no conversions', async () => {
    setD1Mock({ conversions: [] });
    const result = await getRecentConversions('t1', 'aff1', 50, 0);
    expect(result).toEqual([]);
  });

  it('maps row fields to camelCase output', async () => {
    setD1Mock({
      conversions: [
        {
          id: 'conv-1',
          link_id: 'link-1',
          offer_id: 'offer-1',
          network_transaction_id: 'tx-1',
          gross_amount_usd: 100,
          commission_usd: 25,
          status: 'approved',
          attributed_at: 1700000000,
        },
      ],
    });
    const result = await getRecentConversions('t1', 'aff1', 50, 0);
    expect(result).toEqual([
      {
        conversionId: 'conv-1',
        linkId: 'link-1',
        offerId: 'offer-1',
        networkTransactionId: 'tx-1',
        grossAmountUsd: 100,
        commissionUsd: 25,
        status: 'approved',
        attributedAt: 1700000000,
      },
    ]);
  });

  it('clamps limit to [1, 200] and offset to >= 0', async () => {
    const bound: unknown[][] = [];
    setD1Mock({
      conversions: [],
      bindCapture: (...args) => bound.push(args),
    });
    await getRecentConversions('t1', 'aff1', 9999, -50);
    // tenant, affiliate, limit, offset
    expect(bound[0]).toEqual(['t1', 'aff1', 200, 0]);
  });

  it('floors fractional limit/offset', async () => {
    const bound: unknown[][] = [];
    setD1Mock({
      conversions: [],
      bindCapture: (...args) => bound.push(args),
    });
    await getRecentConversions('t1', 'aff1', 50.7, 5.9);
    expect(bound[0]).toEqual(['t1', 'aff1', 50, 5]);
  });

  it('clamps zero limit to 1', async () => {
    const bound: unknown[][] = [];
    setD1Mock({
      conversions: [],
      bindCapture: (...args) => bound.push(args),
    });
    await getRecentConversions('t1', 'aff1', 0, 0);
    expect(bound[0]).toEqual(['t1', 'aff1', 1, 0]);
  });
});
