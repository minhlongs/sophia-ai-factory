import { describe, it, expect } from 'vitest';
import {
  calculateMcuUtilization,
  resolveTierMrr,
  calculateGrossMargin,
  determineVelocityAlert,
  buildRevenueAttribution,
  aggregateAgencyKpis,
  STANDARD_TIER_MRR,
} from '../attribution-engine';
import type { AgencyClientSummary, AgencyCampaignSummary, AgencyRevenueAttribution } from '@/seed/types';

describe('Agency Revenue Attribution & Analytics Engine', () => {
  describe('calculateMcuUtilization', () => {
    it('calculates normal utilization and remaining balance', () => {
      const res = calculateMcuUtilization(1000, 250);
      expect(res.allocated).toBe(1000);
      expect(res.used).toBe(250);
      expect(res.remaining).toBe(750);
      expect(res.usedRatePercent).toBe(25);
      expect(res.isOverQuota).toBe(false);
    });

    it('detects over-quota condition', () => {
      const res = calculateMcuUtilization(500, 600);
      expect(res.allocated).toBe(500);
      expect(res.used).toBe(600);
      expect(res.remaining).toBe(0);
      expect(res.usedRatePercent).toBe(100);
      expect(res.isOverQuota).toBe(true);
    });

    it('safely handles zero or non-finite allocation without NaN/Infinity', () => {
      const res1 = calculateMcuUtilization(0, 0);
      expect(res1.usedRatePercent).toBe(0);
      expect(res1.isOverQuota).toBe(false);

      const res2 = calculateMcuUtilization(0, 50);
      expect(res2.usedRatePercent).toBe(100);
      expect(res2.isOverQuota).toBe(true);

      const res3 = calculateMcuUtilization(-100, 50);
      expect(res3.usedRatePercent).toBe(100);
    });
  });

  describe('resolveTierMrr', () => {
    it('resolves standard tier prices', () => {
      expect(resolveTierMrr('starter')).toBe(STANDARD_TIER_MRR.starter);
      expect(resolveTierMrr('Growth')).toBe(STANDARD_TIER_MRR.growth);
      expect(resolveTierMrr('scale')).toBe(STANDARD_TIER_MRR.scale);
      expect(resolveTierMrr('ENTERPRISE')).toBe(STANDARD_TIER_MRR.enterprise);
    });

    it('uses custom MRR override when provided', () => {
      expect(resolveTierMrr('starter', 1500)).toBe(1500);
    });

    it('falls back to starter tier for unrecognized or missing tiers', () => {
      expect(resolveTierMrr('unknown_tier')).toBe(STANDARD_TIER_MRR.starter);
      expect(resolveTierMrr(null)).toBe(STANDARD_TIER_MRR.starter);
    });
  });

  describe('calculateGrossMargin', () => {
    it('computes gross profit and margin percentage accurately', () => {
      // MRR $299, 1000 MCU consumed at $0.05 = $50 compute cost -> $249 profit -> 83.3% margin
      const margin = calculateGrossMargin(299, 1000, 0.05);
      expect(margin.computeCostUsd).toBe(50);
      expect(margin.grossProfitUsd).toBe(249);
      expect(margin.marginPercent).toBe(83.3);
    });

    it('handles zero MRR gracefully without division by zero', () => {
      const margin = calculateGrossMargin(0, 500, 0.05);
      expect(margin.marginPercent).toBe(0);
    });
  });

  describe('determineVelocityAlert', () => {
    it('flags normal for < 80% usage', () => {
      expect(determineVelocityAlert(1000, 500)).toBe('normal');
      expect(determineVelocityAlert(1000, 790)).toBe('normal');
    });

    it('flags near_limit for 80% - 99.9% usage', () => {
      expect(determineVelocityAlert(1000, 800)).toBe('near_limit');
      expect(determineVelocityAlert(1000, 950)).toBe('near_limit');
    });

    it('flags exceeded for >= 100% usage', () => {
      expect(determineVelocityAlert(1000, 1000)).toBe('exceeded');
      expect(determineVelocityAlert(1000, 1200)).toBe('exceeded');
    });
  });

  describe('buildRevenueAttribution', () => {
    it('constructs complete attribution record for a subaccount', () => {
      const record = buildRevenueAttribution('sub_1', 'Client One', 'growth', 2000, 500);
      expect(record.subaccountId).toBe('sub_1');
      expect(record.clientName).toBe('Client One');
      expect(record.tier).toBe('growth');
      expect(record.mrrUsd).toBe(299);
      expect(record.mcuConsumed).toBe(500);
      expect(record.velocityStatus).toBe('normal');
      expect(record.marginPercent).toBeGreaterThan(80);
    });
  });

  describe('aggregateAgencyKpis', () => {
    it('aggregates portfolio metrics across active clients, campaigns, and MRR', () => {
      const clients: AgencyClientSummary[] = [
        {
          id: 'c1',
          name: 'Client 1',
          slug: 'client-1',
          status: 'active',
          allocatedMcu: 1000,
          usedMcu: 200,
          mcuUtilizationRate: 20,
          portalUrl: '/portal/client-1',
          activeCampaignsCount: 2,
          createdAt: '2026-01-01',
        },
        {
          id: 'c2',
          name: 'Client 2',
          slug: 'client-2',
          status: 'suspended',
          allocatedMcu: 500,
          usedMcu: 500,
          mcuUtilizationRate: 100,
          portalUrl: '/portal/client-2',
          activeCampaignsCount: 0,
          createdAt: '2026-01-01',
        },
      ];

      const campaigns: AgencyCampaignSummary[] = [
        {
          id: 'camp1',
          subaccountId: 'c1',
          clientName: 'Client 1',
          title: 'Spring Promo',
          status: 'in_review',
          rendersCount: 5,
          mcuConsumed: 100,
          updatedAt: '2026-01-02',
        },
        {
          id: 'camp2',
          subaccountId: 'c1',
          clientName: 'Client 1',
          title: 'Draft Campaign',
          status: 'draft',
          rendersCount: 0,
          mcuConsumed: 0,
          updatedAt: '2026-01-02',
        },
      ];

      const attributions: AgencyRevenueAttribution[] = [
        {
          subaccountId: 'c1',
          clientName: 'Client 1',
          tier: 'growth',
          mrrUsd: 299,
          mcuConsumed: 200,
          marginPercent: 85,
          velocityStatus: 'normal',
        },
      ];

      const kpis = aggregateAgencyKpis(clients, campaigns, attributions, 200);

      expect(kpis.totalActiveClients).toBe(1);
      expect(kpis.totalAllocatedMcu).toBe(1500);
      expect(kpis.totalUsedMcu).toBe(700);
      expect(kpis.activeCampaigns).toBe(1);
      expect(kpis.attributedMrrUsd).toBe(299);
      expect(kpis.growthRatePercent).toBe(49.5); // ((299 - 200)/200)*100
    });
  });
});
