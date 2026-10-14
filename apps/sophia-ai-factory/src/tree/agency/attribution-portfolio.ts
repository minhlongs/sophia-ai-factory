/**
 * Portfolio KPI Aggregation and Client Revenue Attribution Builders
 * for Agency Attribution Engine.
 * @module tree/agency/attribution-portfolio
 */

import type {
  AgencyKpiOverview,
  AgencyClientSummary,
  AgencyCampaignSummary,
  AgencyRevenueAttribution,
} from '@/seed/types';
import {
  calculateMcuUtilization,
  resolveTierMrr,
  calculateGrossMargin,
  determineVelocityAlert,
} from './attribution-engine';

/**
 * Builds revenue attribution record for an individual client.
 */
export function buildRevenueAttribution(
  subaccountId: string,
  clientName: string,
  tier: string,
  allocatedMcu: number,
  mcuConsumed: number,
  customMrr?: number,
): AgencyRevenueAttribution {
  const mrrUsd = resolveTierMrr(tier, customMrr);
  const { marginPercent } = calculateGrossMargin(mrrUsd, mcuConsumed);
  const velocityStatus = determineVelocityAlert(allocatedMcu, mcuConsumed);

  return {
    subaccountId,
    clientName,
    tier: tier.toLowerCase(),
    mrrUsd,
    mcuConsumed,
    marginPercent,
    velocityStatus,
  };
}

/**
 * Aggregates portfolio KPIs across all clients and campaigns.
 */
export function aggregateAgencyKpis(
  clients: AgencyClientSummary[],
  campaigns: AgencyCampaignSummary[],
  attributions: AgencyRevenueAttribution[],
  previousMonthMrrUsd?: number,
): AgencyKpiOverview {
  const totalActiveClients = clients.filter((c) => c.status === 'active').length;
  const totalAllocatedMcu = clients.reduce(
    (acc, c) => acc + (Number.isFinite(c.allocatedMcu) ? c.allocatedMcu : 0),
    0,
  );
  const totalUsedMcu = clients.reduce(
    (acc, c) => acc + (Number.isFinite(c.usedMcu) ? c.usedMcu : 0),
    0,
  );

  const mcuUtilization = calculateMcuUtilization(totalAllocatedMcu, totalUsedMcu);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === 'in_review' || c.status === 'approved',
  ).length;

  const attributedMrrUsd = attributions.reduce(
    (acc, a) => acc + (Number.isFinite(a.mrrUsd) ? a.mrrUsd : 0),
    0,
  );

  let growthRatePercent = 0;
  if (typeof previousMonthMrrUsd === 'number' && previousMonthMrrUsd > 0) {
    const rawGrowth = ((attributedMrrUsd - previousMonthMrrUsd) / previousMonthMrrUsd) * 100;
    growthRatePercent = Math.round(rawGrowth * 10) / 10;
  } else if (attributedMrrUsd > 0) {
    growthRatePercent = 100;
  }

  return {
    totalActiveClients,
    totalAllocatedMcu,
    totalUsedMcu,
    mcuUtilizationRate: mcuUtilization.usedRatePercent,
    activeCampaigns,
    attributedMrrUsd,
    growthRatePercent,
  };
}
