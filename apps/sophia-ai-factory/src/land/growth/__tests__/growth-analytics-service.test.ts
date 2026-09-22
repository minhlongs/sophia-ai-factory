/**
 * Unit & Integration Tests for growth-analytics-service.ts
 *
 * Verifies:
 * - Mathematical precision of 4-stage funnel conversion and drop-off rates
 * - Calculation of $5,000 MRR milestone metrics, gaps, ARPU, and tier breakdowns
 * - Resilient fallback behavior when D1 database is uninitialized
 * - Channel attribution breakdown integrity
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFunnelStages,
  calculateMrrProgress,
  getGrowthAnalyticsSummary,
  TARGET_MRR_USD,
  TARGET_PAYING_CUSTOMERS,
} from '@/land/growth/growth-analytics-service';

describe('Growth Analytics Service', () => {
  describe('calculateFunnelStages', () => {
    it('computes conversion and drop-off rates accurately across 4 stages', () => {
      const stages = calculateFunnelStages({
        visitors: 10000,
        leads: 500,  // 5% from visitors
        trials: 100, // 20% from leads
        paid: 10,    // 10% from trials
      });

      expect(stages.length).toBe(4);

      // Stage 1: Visitors
      expect(stages[0].stage).toBe('visitors');
      expect(stages[0].count).toBe(10000);
      expect(stages[0].conversionRateFromPrev).toBe(100.0);
      expect(stages[0].dropoffRateFromPrev).toBe(0.0);

      // Stage 2: Leads
      expect(stages[1].stage).toBe('leads');
      expect(stages[1].count).toBe(500);
      expect(stages[1].conversionRateFromPrev).toBe(5.0);
      expect(stages[1].dropoffRateFromPrev).toBe(95.0);

      // Stage 3: Trials
      expect(stages[2].stage).toBe('trials');
      expect(stages[2].count).toBe(100);
      expect(stages[2].conversionRateFromPrev).toBe(20.0);
      expect(stages[2].dropoffRateFromPrev).toBe(80.0);

      // Stage 4: Paid
      expect(stages[3].stage).toBe('paid');
      expect(stages[3].count).toBe(10);
      expect(stages[3].conversionRateFromPrev).toBe(10.0);
      expect(stages[3].dropoffRateFromPrev).toBe(90.0);
    });

    it('handles zero values without NaN or division by zero errors', () => {
      const stages = calculateFunnelStages({
        visitors: 0,
        leads: 0,
        trials: 0,
        paid: 0,
      });

      expect(stages.length).toBe(4);
      for (const stage of stages) {
        expect(Number.isNaN(stage.conversionRateFromPrev)).toBe(false);
        expect(Number.isNaN(stage.dropoffRateFromPrev)).toBe(false);
      }
    });
  });

  describe('calculateMrrProgress', () => {
    it('calculates MRR, progress percentage, gaps, and ARPU for standard customer distribution', () => {
      // 4 Basic ($199) + 4 Premium ($399) + 2 Enterprise ($799) = 10 customers
      // Total MRR: 4*199 + 4*399 + 2*799 = 796 + 1596 + 1598 = 3990
      const progress = calculateMrrProgress({
        tierCounts: { basic: 4, premium: 4, enterprise: 2, master: 0 },
      });

      expect(progress.targetMrrUsd).toBe(TARGET_MRR_USD);
      expect(progress.targetPayingCustomers).toBe(TARGET_PAYING_CUSTOMERS);
      expect(progress.currentMrrUsd).toBe(3990);
      expect(progress.gapToTargetUsd).toBe(1010); // 5000 - 3990
      expect(progress.progressPct).toBe(79.8);    // (3990 / 5000) * 100
      expect(progress.currentPayingCustomers).toBe(10);
      expect(progress.customerProgressPct).toBe(100.0);
      expect(progress.customerGap).toBe(0);
      expect(progress.arpu).toBe(399); // 3990 / 10

      expect(progress.tierBreakdown.basic.count).toBe(4);
      expect(progress.tierBreakdown.basic.mrr).toBe(796);
      expect(progress.tierBreakdown.premium.count).toBe(4);
      expect(progress.tierBreakdown.premium.mrr).toBe(1596);
      expect(progress.tierBreakdown.enterprise.count).toBe(2);
      expect(progress.tierBreakdown.enterprise.mrr).toBe(1598);
    });

    it('caps progress percentage at 100% when milestone is exceeded', () => {
      const progress = calculateMrrProgress({
        tierCounts: { basic: 10, premium: 5, enterprise: 5, master: 1 },
      });

      expect(progress.currentMrrUsd).toBeGreaterThan(5000);
      expect(progress.progressPct).toBe(100);
      expect(progress.gapToTargetUsd).toBe(0);
      expect(progress.customerGap).toBe(0);
    });

    it('handles zero customers gracefully with 0 ARPU', () => {
      const progress = calculateMrrProgress({
        tierCounts: { basic: 0, premium: 0, enterprise: 0, master: 0 },
      });

      expect(progress.currentMrrUsd).toBe(0);
      expect(progress.arpu).toBe(0);
      expect(progress.gapToTargetUsd).toBe(5000);
      expect(progress.customerGap).toBe(10);
      expect(progress.progressPct).toBe(0);
    });
  });

  describe('getGrowthAnalyticsSummary', () => {
    it('returns a comprehensive summary with all required stages, channels, and leads', async () => {
      const summary = await getGrowthAnalyticsSummary(30);

      expect(summary).toBeDefined();
      expect(summary.funnelStages.length).toBe(4);
      expect(summary.mrrProgress.targetMrrUsd).toBe(5000);
      expect(summary.channelAttribution.length).toBeGreaterThanOrEqual(4);
      expect(summary.recentLeads.length).toBeGreaterThan(0);

      const channelNames = summary.channelAttribution.map((c) => c.channel);
      expect(channelNames).toContain('viral_videos');
      expect(channelNames).toContain('telegram_bot');
      expect(channelNames).toContain('programmatic_seo');
      expect(channelNames).toContain('affiliate_partners');
    });
  });
});
