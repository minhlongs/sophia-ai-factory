import { describe, it, expect } from 'vitest';
import { generateExecutiveCockpitSnapshot } from '../affiliate-cockpit-service';
import type { ReconciliationSummary } from '../../reconciliation/ecommerce-reconciliation-engine';
import type { ScalingDecision } from '@/tree/affiliate/scaling/auto-campaign-scaler';

describe('Executive Affiliate Cockpit Service', () => {
  const mockReconciliation: ReconciliationSummary = {
    tenantId: 'tenant_ceo_1',
    totalOrdersProcessed: 10,
    totalGrossCommissionCents: 100000, // $1,000.00
    totalRefundedCents: 5000, // $50.00
    totalHoldbackCents: 10000, // 10% risk holdback ($100.00)
    totalNetPayableCents: 85000, // $850.00
    highRiskRefundRate: false,
    entries: [],
  };

  const mockDecisions: ScalingDecision[] = [
    {
      campaignId: 'camp_1',
      hookName: 'AI replaces Developers in 2026',
      ctrPercent: 8.5,
      cvrPercent: 4.2,
      epcCents: 120,
      recommendedDailyVideos: 4,
      action: 'SCALE_AGGRESSIVE',
      reason: 'Viral hook',
    },
    {
      campaignId: 'camp_2',
      hookName: 'Generic SaaS review',
      ctrPercent: 0.5,
      cvrPercent: 0.0,
      epcCents: 0,
      recommendedDailyVideos: 0,
      action: 'KILL_PRUNE',
      reason: 'Low CTR',
    },
  ];

  it('generates an accurate high-level executive snapshot', () => {
    const snapshot = generateExecutiveCockpitSnapshot({
      tenantId: 'tenant_ceo_1',
      reconciliation: mockReconciliation,
      scalingDecisions: mockDecisions,
    });

    expect(snapshot.tenantId).toBe('tenant_ceo_1');
    expect(snapshot.metrics.totalGrossCommissionCents).toBe(100000);
    expect(snapshot.metrics.totalHoldbackReserveCents).toBe(10000);
    expect(snapshot.metrics.totalNetPayableCents).toBe(85000);
    expect(snapshot.metrics.scaledWinnersCount).toBe(1);
    expect(snapshot.metrics.prunedHooksCount).toBe(1);
    expect(snapshot.metrics.isRefundRiskAlert).toBe(false);
    expect(snapshot.topPerformingHooks[0].hookName).toBe('AI replaces Developers in 2026');
  });

  it('forces daily video recommendations to 0 when kill switch is active', () => {
    const snapshot = generateExecutiveCockpitSnapshot({
      tenantId: 'tenant_ceo_1',
      reconciliation: mockReconciliation,
      scalingDecisions: mockDecisions,
      killSwitchActive: true,
    });

    expect(snapshot.killSwitchActive).toBe(true);
    expect(snapshot.topPerformingHooks[0].recommendedDailyVideos).toBe(0);
    expect(snapshot.topPerformingHooks[0].action).toBe('KILL_PRUNE');
  });
});
