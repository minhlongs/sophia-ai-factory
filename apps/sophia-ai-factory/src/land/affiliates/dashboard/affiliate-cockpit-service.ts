/**
 * Executive Affiliate Cockpit Service
 *
 * Aggregates reconciliation ledger data and algorithmic campaign performance
 * into an executive-ready snapshot for non-technical CEOs.
 *
 * Financial Invariant:
 * Net Payable = Gross Commission - Refunded Amount - Risk Holdback
 *
 * Layer: land/affiliates/dashboard (Business Workflow)
 * @module land/affiliates/dashboard/affiliate-cockpit-service
 */

import type { ReconciliationSummary } from '../reconciliation/ecommerce-reconciliation-engine';
import type { ScalingDecision } from '@/tree/affiliate/scaling/auto-campaign-scaler';
import type {
  CockpitExecutiveSnapshot,
  CockpitCampaignEntry,
} from './affiliate-cockpit-types';

export interface CockpitAggregatorInput {
  tenantId: string;
  reconciliation: ReconciliationSummary;
  scalingDecisions: ScalingDecision[];
  killSwitchActive?: boolean;
}

export function generateExecutiveCockpitSnapshot(
  input: CockpitAggregatorInput,
  currentTimestampMs = Date.now(),
): CockpitExecutiveSnapshot {
  const { tenantId, reconciliation, scalingDecisions, killSwitchActive = false } = input;

  const refundRatePercent =
    reconciliation.totalOrdersProcessed > 0
      ? Number(
          (
            (reconciliation.totalRefundedCents /
              Math.max(1, reconciliation.totalGrossCommissionCents)) *
            100
          ).toFixed(2),
        )
      : 0;

  const scaledWinners = scalingDecisions.filter((d) => d.action === 'SCALE_AGGRESSIVE');
  const prunedHooks = scalingDecisions.filter((d) => d.action === 'KILL_PRUNE');

  const topHooks: CockpitCampaignEntry[] = [...scalingDecisions]
    .sort((a, b) => b.epcCents - a.epcCents)
    .slice(0, 10)
    .map((d) => ({
      campaignId: d.campaignId,
      hookName: d.hookName,
      niche: 'saas_global',
      ctrPercent: d.ctrPercent,
      cvrPercent: d.cvrPercent,
      epcCents: d.epcCents,
      recommendedDailyVideos: killSwitchActive ? 0 : d.recommendedDailyVideos,
      action: killSwitchActive ? 'KILL_PRUNE' : d.action,
    }));

  return {
    tenantId,
    generatedAtMs: currentTimestampMs,
    metrics: {
      totalGrossCommissionCents: reconciliation.totalGrossCommissionCents,
      totalHoldbackReserveCents: reconciliation.totalHoldbackCents,
      totalNetPayableCents: reconciliation.totalNetPayableCents,
      totalRefundedCents: reconciliation.totalRefundedCents,
      effectiveRefundRatePercent: refundRatePercent,
      isRefundRiskAlert: reconciliation.highRiskRefundRate || refundRatePercent > 15,
      activeCampaignsCount: scalingDecisions.length,
      scaledWinnersCount: scaledWinners.length,
      prunedHooksCount: prunedHooks.length,
    },
    topPerformingHooks: topHooks,
    killSwitchActive,
  };
}
