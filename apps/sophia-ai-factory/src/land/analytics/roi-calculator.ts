/**
 * ROI (Return on Investment) Calculator for Analytics
 *
 * Calculates ROI metrics for license holders
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

export type { ROIMetrics } from './roi-projection';

/**
 * Calculate ROI metrics for a specific license
 *
 * @param licenseNonce - License nonce to calculate ROI for
 * @param valuePerCredit - Value per credit in USD (default: 0.01)
 */
export async function calculateRoiMetrics(
  licenseNonce: string,
  valuePerCredit: number = 0.01
): Promise<ROIMetrics> {
  const db = createServerClient();

  const { data: rawLicense } = await db
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .eq('nonce', licenseNonce)
    .single();
  const license = rawLicense as RaasLicenseRoiRow | null;

  if (!license) {
    throw new Error('License not found');
  }

  const licenseCost = extractLicenseCost(license.metadata);
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

  const { data: rawUsageEvents } = await db
    .from('usage_events')
    .select('credits_used, created_at')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', thirtyDaysAgo);
  const totalCreditsUsed = sumUsageCredits(rawUsageEvents as UsageEventCreditRow[] | null);

  const yearStart = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);

  const { data: rawYtdUsage } = await db
    .from('usage_events')
    .select('credits_used')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', yearStart);
  const ytdCredits = sumUsageCredits(rawYtdUsage as UsageEventCreditRow[] | null);

  const actualYTD = ytdCredits * valuePerCredit;
  const monthsSinceCreation = Math.max(
    1,
    Math.floor((Date.now() / 1000 - license.created_at) / (30 * 86400))
  );
  const projectedAnnual = (actualYTD / monthsSinceCreation) * 12;

  return formatRoiMetrics({
    projectedAnnual,
    actualYTD,
    licenseCost,
    totalCreditsUsed,
  });
}

/**
 * Calculate aggregate ROI across all licenses for a user
 *
 * @param userId - User ID to calculate aggregate ROI for
 * @param valuePerCredit - Value per credit in USD (default: 0.01)
 */
export async function calculateAggregateRoi(
  userId: string,
  valuePerCredit: number = 0.01
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
    const metrics = await calculateRoiMetrics(license.nonce, valuePerCredit);
    totalProjectedAnnual += metrics.projectedAnnual;
    totalActualYTD += metrics.actualYTD;
    totalCost += extractLicenseCost(license.metadata);
  }

  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

  const { data: rawAggUsageEvents } = await db
    .from('usage_events')
    .select('credits_used')
    .in(
      'license_nonce',
      licenses.map((l) => l.nonce).filter((n): n is string => !!n)
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
