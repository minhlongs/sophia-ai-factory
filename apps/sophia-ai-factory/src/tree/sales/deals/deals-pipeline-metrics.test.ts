import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@/seed/db/client';
import { getDealsPipelineMetrics } from './deals-pipeline-metrics';

function makeDb(stats: unknown) {
  return {
    prepare: vi.fn(() => ({ first: vi.fn().mockResolvedValue(stats) })),
  } as unknown as D1Database;
}

describe('enterprise deals pipeline metrics', () => {
  it('converts database aggregates to stable numeric dashboard values', async () => {
    const result = await getDealsPipelineMetrics(makeDb({
      total_deals: 4, hot_deals: 1, warm_deals: 2, cold_deals: 1,
      total_val_cents: 17500, avg_bant: 79.6, won_deals: 1,
    }));
    expect(result).toEqual({ totalDeals: 4, hotDeals: 1, warmDeals: 2, coldDeals: 1, totalEstimatedValueCents: 17500, avgBantScore: 80, wonDeals: 1 });
  });

  it('uses zero defaults when the aggregate query returns no row', async () => {
    await expect(getDealsPipelineMetrics(makeDb(null))).resolves.toEqual({
      totalDeals: 0, hotDeals: 0, warmDeals: 0, coldDeals: 0,
      totalEstimatedValueCents: 0, avgBantScore: 0, wonDeals: 0,
    });
  });
});
