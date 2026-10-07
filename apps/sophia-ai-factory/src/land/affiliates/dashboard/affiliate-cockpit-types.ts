/**
 * Executive Affiliate Cockpit Types
 *
 * Types for high-level revenue analytics, risk holdbacks,
 * conversion efficiency, and automated campaign controls.
 *
 * Layer: land/affiliates/dashboard (Domain / Business Workflow Types)
 * @module land/affiliates/dashboard/affiliate-cockpit-types
 */

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
}

export interface CockpitCampaignEntry {
  campaignId: string;
  hookName: string;
  niche: string;
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
