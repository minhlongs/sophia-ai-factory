/**
 * Executive Affiliate Cockpit Types
 *
 * Types for high-level revenue analytics, risk holdbacks,
 * conversion efficiency, and automated campaign controls.
 *
 * Layer: land/affiliates/dashboard (Domain / Business Workflow Types)
 * @module land/affiliates/dashboard/affiliate-cockpit-types
 */

import type { DomainBReconciliationSummary } from '../reconciliation/workspace-domain-b-reconciliation';

export interface CockpitSummaryMetrics {
  totalGrossCommissionCents: number;
  totalHoldbackReserveCents: number;
  totalNetPayableCents: number;
  totalRefundedCents: number;
  effectiveRefundRatePercent: number;
  isRefundRiskAlert: boolean;
  activeCampaignsCount: number;
  scaledWinnersCount: number;
  prunedHooksCount: number;
  /** Multi-niche breakdown */
  nicheBreakdown?: {
    cryptoCexCommissionCents: number;
    globalSaasCommissionCents: number;
  };
  /** Domain B workspace-owned ledger reconciliation summary (multi-currency & lifecycle) */
  domainBSummary?: DomainBReconciliationSummary;
  /** Whether the workspace has any recorded Domain B ledger entries or campaign hooks */
  hasData?: boolean;
  /** False when a single headline figure would mix currencies; use byCurrency. */
  financialsAvailable?: boolean;
  currencies?: string[];
}

export interface CockpitCampaignEntry {
  campaignId: string;
  hookName: string;
  niche: 'saas_global' | 'crypto_global' | 'ecommerce_tiktok' | 'unclassified' | string;
  ctrPercent: number;
  cvrPercent: number;
  epcCents: number;
  recommendedDailyVideos: number;
  action: 'SCALE_AGGRESSIVE' | 'MAINTAIN_STEADY' | 'KILL_PRUNE';
}

export interface CockpitExecutiveSnapshot {
  tenantId: string;
  generatedAtMs: number;
  metrics: CockpitSummaryMetrics;
  topPerformingHooks: CockpitCampaignEntry[];
  killSwitchActive: boolean;
}
