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
import { computeUserAggregateRoi } from './roi-aggregate-calculator';

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
  return computeUserAggregateRoi(userId, valuePerCredit, calculateRoiMetrics);
}
