/**
 * Aggregate ROI Calculator Helper for Analytics
 *
 * Calculates aggregate ROI metrics across all active licenses for a user.
 */

import { createServerClient } from '@/seed/db/client';
import {
  extractLicenseCost,
  sumUsageCredits,
  formatRoiMetrics,
  type ROIMetrics,
  type RaasLicenseRoiRow,
  type UsageEventCreditRow,
} from './roi-projection';

/**
 * Calculate aggregate ROI across all licenses for a user
 *
 * @param userId - User ID to calculate aggregate ROI for
 * @param valuePerCredit - Value per credit in USD (default: 0.01)
 * @param calculateSingleLicenseRoi - Single-license ROI calculator callback
 */
export async function computeUserAggregateRoi(
  userId: string,
  valuePerCredit: number,
  calculateSingleLicenseRoi: (licenseNonce: string, valuePerCredit: number) => Promise<ROIMetrics>,
): Promise<ROIMetrics> {
  const db = createServerClient();

  const { data: rawLicenses } = await db
    .from('raas_licenses')
    .select('nonce, tier, created_at, metadata')
    .eq('created_by', userId)
    .eq('is_revoked', false);
  const licenses = rawLicenses as RaasLicenseRoiRow[] | null;

  if (!licenses || licenses.length === 0) {
    return {
      projectedAnnual: 0,
      actualYTD: 0,
      paybackMonths: 0,
      costPerUsage: 0,
      roiPercent: 0,
      licenseCost: 0,
      totalCredits: 0,
    };
  }

  let totalProjectedAnnual = 0;
  let totalActualYTD = 0;
  let totalCost = 0;

  for (const license of licenses) {
    if (!license.nonce) continue;
    const metrics = await calculateSingleLicenseRoi(license.nonce, valuePerCredit);
    totalProjectedAnnual += metrics.projectedAnnual;
    totalActualYTD += metrics.actualYTD;
    totalCost += extractLicenseCost(license.metadata);
  }

  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;

  const { data: rawAggUsageEvents } = await db
    .from('usage_events')
    .select('credits_used')
    .in(
      'license_nonce',
      licenses.map((l) => l.nonce).filter((n): n is string => !!n),
    )
    .gte('created_at', thirtyDaysAgo);
  const totalCreditsUsed = sumUsageCredits(rawAggUsageEvents as UsageEventCreditRow[] | null);

  return formatRoiMetrics({
    projectedAnnual: totalProjectedAnnual,
    actualYTD: totalActualYTD,
    licenseCost: totalCost,
    totalCreditsUsed,
  });
}
