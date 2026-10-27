import { describe, it, expect } from 'vitest';
import {
  generateExecutiveCockpitSnapshot,
  deriveNicheBreakdownFromDomainB,
  mapDomainBToReconciliationSummary,
} from '../affiliate-cockpit-service';
import type { ReconciliationSummary } from '../../reconciliation/ecommerce-reconciliation-engine';
import type { DomainBReconciliationSummary } from '../../reconciliation/workspace-domain-b-reconciliation';
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
      niche: 'saas_global',
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

  it('generates an accurate high-level executive snapshot with multi-niche attribution', () => {
    const snapshot = generateExecutiveCockpitSnapshot({
      tenantId: 'tenant_ceo_1',
      reconciliation: mockReconciliation,
      scalingDecisions: mockDecisions,
      nicheBreakdown: {
        cryptoCexCommissionCents: 60000,
        globalSaasCommissionCents: 40000,
      },
    });

    expect(snapshot.tenantId).toBe('tenant_ceo_1');
    expect(snapshot.metrics.totalGrossCommissionCents).toBe(100000);
    expect(snapshot.metrics.totalHoldbackReserveCents).toBe(10000);
    expect(snapshot.metrics.totalNetPayableCents).toBe(85000);
    expect(snapshot.metrics.scaledWinnersCount).toBe(1);
    expect(snapshot.metrics.prunedHooksCount).toBe(1);
    expect(snapshot.metrics.isRefundRiskAlert).toBe(false);
    expect(snapshot.metrics.nicheBreakdown).toEqual({
      cryptoCexCommissionCents: 60000,
      globalSaasCommissionCents: 40000,
    });
    expect(snapshot.topPerformingHooks[0].hookName).toBe('AI replaces Developers in 2026');
    expect(snapshot.topPerformingHooks[0].niche).toBe('saas_global');
  });

  it('does NOT guess saas_global when a scaling decision has no niche; marks it unclassified', () => {
    const snapshot = generateExecutiveCockpitSnapshot({
      tenantId: 'tenant_ceo_1',
      reconciliation: mockReconciliation,
      scalingDecisions: mockDecisions,
    });

    const unclassifiedEntry = snapshot.topPerformingHooks.find((h) => h.campaignId === 'camp_2');
    expect(unclassifiedEntry?.niche).toBe('unclassified');
  });

  it('derives nicheBreakdown and reconciliation metrics directly from DomainBReconciliationSummary', () => {
    const domainBSummary: DomainBReconciliationSummary = {
      workspaceId: 'ws_real_1',
      pendingCents: 2000,
      approvedUnpaidCents: 5000,
      reversedCents: 0,
      paidReceiptCents: 15000,
      totalGrossVolumeCents: 0,
      platformFeeCents: 0,
      effectiveCommissionCents: 20000,
      byCurrency: {
        USD: {
          currency: 'USD',
          pendingCents: 0,
          approvedUnpaidCents: 5000,
          reversedCents: 0,
          paidReceiptCents: 0,
          totalGrossVolumeCents: 0,
          effectiveCommissionCents: 5000,
        },
        USDT: {
          currency: 'USDT',
          pendingCents: 2000,
          approvedUnpaidCents: 0,
          reversedCents: 0,
          paidReceiptCents: 15000,
          totalGrossVolumeCents: 0,
          effectiveCommissionCents: 15000,
        },
      },
      byNetwork: {
        partnerstack: { grossCents: 0, commissionCents: 5000, paidCents: 0, count: 1 },
        bybit: { grossCents: 0, commissionCents: 17000, paidCents: 15000, count: 2 },
      },
    };

    const nicheBreakdown = deriveNicheBreakdownFromDomainB(domainBSummary);
    expect(nicheBreakdown).toEqual({
      cryptoCexCommissionCents: 17000,
      globalSaasCommissionCents: 5000,
    });

    const reconciliation = mapDomainBToReconciliationSummary(domainBSummary);
    const snapshot = generateExecutiveCockpitSnapshot({
      tenantId: 'ws_real_1',
      reconciliation,
      scalingDecisions: [],
      domainBSummary,
    });

    expect(snapshot.metrics.hasData).toBe(true);
    expect(snapshot.metrics.totalNetPayableCents).toBe(20000);
    expect(snapshot.metrics.totalHoldbackReserveCents).toBe(2000);
    expect(snapshot.metrics.nicheBreakdown).toEqual({
      cryptoCexCommissionCents: 17000,
      globalSaasCommissionCents: 5000,
    });
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
