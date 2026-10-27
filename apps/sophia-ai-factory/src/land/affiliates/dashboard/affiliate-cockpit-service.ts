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
import type { DomainBReconciliationSummary } from '../reconciliation/workspace-domain-b-reconciliation';
import type { ScalingDecision } from '@/tree/affiliate/scaling/auto-campaign-scaler';
import type {
  CockpitExecutiveSnapshot,
  CockpitCampaignEntry,
} from './affiliate-cockpit-types';

const CRYPTO_NETWORKS = new Set(['binance', 'bybit', 'bitget', 'okx', 'coinbase', 'mexc']);
const SAAS_NETWORKS = new Set([
  'partnerstack',
  'rewardful',
  'rakuten',
  'impact',
  'impact_radius',
  'clickbank',
  'shareasale',
  'cj_affiliate',
  'cj',
  'awin',
]);

export interface CockpitAggregatorInput {
  tenantId: string;
  reconciliation: ReconciliationSummary;
  scalingDecisions: ScalingDecision[];
  killSwitchActive?: boolean;
  nicheBreakdown?: {
    cryptoCexCommissionCents: number;
    globalSaasCommissionCents: number;
  };
  domainBSummary?: DomainBReconciliationSummary;
}

export function deriveNicheBreakdownFromDomainB(
  domainBSummary: DomainBReconciliationSummary,
): { cryptoCexCommissionCents: number; globalSaasCommissionCents: number } {
  let cryptoCexCommissionCents = 0;
  let globalSaasCommissionCents = 0;

  for (const [network, stats] of Object.entries(domainBSummary.byNetwork)) {
    const normalized = network.toLowerCase();
    if (CRYPTO_NETWORKS.has(normalized)) {
      cryptoCexCommissionCents += stats.commissionCents;
    } else if (SAAS_NETWORKS.has(normalized)) {
      globalSaasCommissionCents += stats.commissionCents;
    }
  }

  return { cryptoCexCommissionCents, globalSaasCommissionCents };
}

export function mapDomainBToReconciliationSummary(
  domainBSummary: DomainBReconciliationSummary,
): ReconciliationSummary {
  const totalCommission =
    domainBSummary.pendingCents +
    domainBSummary.approvedUnpaidCents +
    domainBSummary.paidReceiptCents +
    domainBSummary.reversedCents;
  const countedOrders = Object.values(domainBSummary.byNetwork).reduce(
    (sum, stats) => sum + ((stats as { count?: number }).count ?? 1),
    0,
  );
  const totalOrdersProcessed =
    countedOrders > 0
      ? countedOrders
      : Object.keys(domainBSummary.byNetwork).length > 0 && totalCommission > 0
        ? 1
        : 0;
  const highRiskRefundRate =
    totalCommission > 0 && domainBSummary.reversedCents / totalCommission > 0.15;

  return {
    tenantId: domainBSummary.workspaceId,
    totalOrdersProcessed,
    totalGrossCommissionCents: totalCommission,
    totalHoldbackCents: domainBSummary.pendingCents,
    totalNetPayableCents: domainBSummary.effectiveCommissionCents,
    totalRefundedCents: domainBSummary.reversedCents,
    highRiskRefundRate,
    entries: [],
  };
}

export function generateExecutiveCockpitSnapshot(
  input: CockpitAggregatorInput,
  currentTimestampMs = Date.now(),
): CockpitExecutiveSnapshot {
  const {
    tenantId,
    reconciliation,
    scalingDecisions,
    killSwitchActive = false,
    nicheBreakdown,
    domainBSummary,
  } = input;

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
      niche: d.niche && d.niche.trim().length > 0 ? d.niche : 'unclassified',
      ctrPercent: d.ctrPercent,
      cvrPercent: d.cvrPercent,
      epcCents: d.epcCents,
      recommendedDailyVideos: killSwitchActive ? 0 : d.recommendedDailyVideos,
      action: killSwitchActive ? 'KILL_PRUNE' : d.action,
    }));

  const resolvedNicheBreakdown =
    nicheBreakdown ?? (domainBSummary ? deriveNicheBreakdownFromDomainB(domainBSummary) : undefined);

  const hasDomainBData =
    domainBSummary !== undefined &&
    (Object.keys(domainBSummary.byCurrency).length > 0 ||
      domainBSummary.pendingCents > 0 ||
      domainBSummary.effectiveCommissionCents > 0 ||
      domainBSummary.reversedCents > 0);

  const hasData =
    hasDomainBData ||
    reconciliation.totalOrdersProcessed > 0 ||
    reconciliation.totalGrossCommissionCents > 0 ||
    scalingDecisions.length > 0;

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
      nicheBreakdown: resolvedNicheBreakdown,
      domainBSummary,
      hasData,
      financialsAvailable: domainBSummary?.totalsAvailable ?? true,
      currencies: domainBSummary?.currencies ?? [],
    },
    topPerformingHooks: topHooks,
    killSwitchActive,
  };
}
