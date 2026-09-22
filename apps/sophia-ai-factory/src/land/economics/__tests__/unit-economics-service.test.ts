import { describe, it, expect, vi } from 'vitest';
import {
  calculateGrossMarginPct,
  calculateCogsPerVideo,
  calculateLtvCac,
  getUnitEconomicsSummary,
  BENCHMARK_UNIT_ECONOMICS,
} from '../unit-economics-service';
import type { D1Database } from '@cloudflare/workers-types';

describe('UnitEconomicsService', () => {
  describe('calculateGrossMarginPct', () => {
    it('computes gross margin percentage accurately', () => {
      // ($10,000 revenue - $1,500 COGS) / $10,000 = 85.0%
      const margin = calculateGrossMarginPct(10000, 1500);
      expect(margin).toBe(85.0);
    });

    it('returns 0 when revenue is 0', () => {
      expect(calculateGrossMarginPct(0, 500)).toBe(0);
      expect(calculateGrossMarginPct(-100, 200)).toBe(0);
    });

    it('handles negative margins when COGS exceed revenue', () => {
      // ($1,000 revenue - $1,500 COGS) / $1,000 = -50.0%
      const margin = calculateGrossMarginPct(1000, 1500);
      expect(margin).toBe(-50.0);
    });

    it('clamps margins to valid ranges', () => {
      // Very high loss
      expect(calculateGrossMarginPct(100, 5000)).toBe(-100);
    });
  });

  describe('calculateCogsPerVideo', () => {
    it('computes COGS per video to 4 decimal places', () => {
      // $825 COGS / 10,000 videos = $0.0825 / video
      const cogsPerVid = calculateCogsPerVideo(825, 10000);
      expect(cogsPerVid).toBe(0.0825);
    });

    it('returns 0 when no videos completed', () => {
      expect(calculateCogsPerVideo(500, 0)).toBe(0);
    });
  });

  describe('calculateLtvCac', () => {
    it('computes LTV, CAC, LTV:CAC ratio and payback months correctly', () => {
      const result = calculateLtvCac({
        arpuUsd: 388.0,
        grossMarginPct: 88.0,
        monthlyChurnPct: 4.5,
        totalAcquisitionSpendUsd: 2950.0,
        acquiredCustomersCount: 10,
      });

      // LTV = (388 * 0.88) / 0.045 = 7587.56
      expect(result.ltvUsd).toBeCloseTo(7587.56, 0);
      // CAC = 2950 / 10 = 295.0
      expect(result.cacUsd).toBe(295.0);
      // LTV:CAC = 7587.56 / 295 = 25.72
      expect(result.ltvCacRatio).toBeGreaterThan(10.0);
      // Payback months = CAC / (ARPU * margin) = 295 / (388 * 0.88) = ~0.9 mo
      expect(result.paybackMonths).toBeLessThan(3.0);
    });

    it('handles zero acquired customers guard gracefully', () => {
      const result = calculateLtvCac({
        arpuUsd: 199.0,
        grossMarginPct: 80.0,
        monthlyChurnPct: 5.0,
        totalAcquisitionSpendUsd: 500.0,
        acquiredCustomersCount: 0,
      });

      expect(result.cacUsd).toBe(500.0); // Guarded with Math.max(1, 0)
      expect(result.ltvUsd).toBeGreaterThan(0);
      expect(result.ltvCacRatio).toBeGreaterThan(0);
    });
  });

  describe('getUnitEconomicsSummary with Mock D1', () => {
    it('aggregates live database rows from media_jobs, raas_licenses and edge_nodes', async () => {
      const mockD1: Partial<D1Database> = {
        prepare: vi.fn().mockImplementation((query: string) => {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockImplementation(async () => {
              if (query.includes('FROM media_jobs')) {
                return {
                  results: [
                    { model: 'fal-ai/flux-schnell', status: 'completed', provider_cost: 6, latency_ms: 1200, type: 'video' },
                    { model: 'eleven_turbo_v2_5', status: 'completed', provider_cost: 3, latency_ms: 500, type: 'audio' },
                    { model: 'deepseek/deepseek-chat', status: 'completed', provider_cost: 1, latency_ms: 700, type: 'image' },
                    { model: 'mekong_m1_max', status: 'completed', provider_cost: 0, latency_ms: 300, type: 'video' },
                  ],
                };
              }
              if (query.includes('FROM raas_licenses')) {
                return {
                  results: [
                    { tier: 'BASIC', count: 10 },
                    { tier: 'PREMIUM', count: 5 },
                  ],
                };
              }
              if (query.includes('FROM payment_events')) {
                return {
                  results: [
                    { payload: JSON.stringify({ price_amount: 1990 }) },
                    { payload: JSON.stringify({ price_amount: 1995 }) },
                  ],
                };
              }
              return { results: [] };
            }),
            first: vi.fn().mockImplementation(async () => {
              if (query.includes('FROM commission_ledger')) {
                return { total_comm_cents: 50000 }; // $500.00
              }
              if (query.includes('FROM edge_nodes')) {
                return { active_count: 2 };
              }
              return null;
            }),
          };
        }),
      };

      const summary = await getUnitEconomicsSummary(30, mockD1 as unknown as D1Database);

      expect(summary.totalVideosCompleted).toBe(4);
      expect(summary.activePayingCustomers).toBe(15);
      expect(summary.activeEdgeNodes).toBe(2);
      expect(summary.metrics.totalCogsUsd).toBe(0.10); // 10 cents = $0.10
      expect(summary.metrics.grossMarginPct).toBeGreaterThan(95.0);
      expect(summary.metrics.cogsPerVideoUsd).toBe(0.025);
      expect(summary.metrics.breakdownByProvider.length).toBe(4);
      expect(summary.tierEconomics.length).toBe(4);
      expect(summary.providerCosts.length).toBe(4);
    });

    it('falls back cleanly to benchmark data when D1 returns empty or is unavailable', async () => {
      const summary = await getUnitEconomicsSummary(30, null as unknown as D1Database);
      expect(summary.metrics.grossMarginPct).toBe(BENCHMARK_UNIT_ECONOMICS.metrics.grossMarginPct);
      expect(summary.totalVideosCompleted).toBe(BENCHMARK_UNIT_ECONOMICS.totalVideosCompleted);
      expect(summary.activePayingCustomers).toBe(BENCHMARK_UNIT_ECONOMICS.activePayingCustomers);
      expect(summary.timeframeDays).toBe(30);
    });
  });
});
