/**
 * ROI (Return on Investment) Calculator for Analytics
 *
 * Calculates ROI metrics for license holders
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';

/**
 * ROI Metrics result
 */
export interface ROIMetrics {
  projectedAnnual: number;
  actualYTD: number;
  paybackMonths: number;
  costPerUsage: number;
  roiPercent: number;      // ROI percentage: (projectedAnnual - licenseCost) / licenseCost * 100
  licenseCost: number;      // Original license cost from Polar
  totalCredits: number;     // Total credits used
}

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
  const supabase = await createAdminClient();

  // Get license details
  // Note: Using type assertion for Supabase query result since generated types
  // may not be available. The query returns RaasLicenseRow format.
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .eq('nonce', licenseNonce)
    .single();

  if (!license) {
    throw new Error('License not found');
  }

  // Get license cost from metadata
  const metadata = license.metadata as { amount_usd?: { amount: number }; price?: number };
  const licenseCost = metadata?.amount_usd?.amount || metadata?.price || 0;

  // Get usage data for the license (last 30 days)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

  const { data: usageEvents } = await supabase
    .from('usage_events')
    .select('credits_used, created_at')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', thirtyDaysAgo);

  // Calculate total credits used
  const totalCreditsUsed = usageEvents?.reduce((sum, e) => sum + (e.credits_used || 0), 0) || 0;

  // Calculate cost per usage
  const costPerUsage = totalCreditsUsed > 0 ? licenseCost / totalCreditsUsed : 0;

  // Get year-to-date usage for actual YTD calculation
  const yearStart = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);

  const { data: ytdUsage } = await supabase
    .from('usage_events')
    .select('credits_used')
    .eq('license_nonce', licenseNonce)
    .gte('created_at', yearStart);

  const ytdCredits = ytdUsage?.reduce((sum, e) => sum + (e.credits_used || 0), 0) || 0;

  // Calculate actual YTD value based on credits used
  const actualYTD = ytdCredits * valuePerCredit;

  // Project annual revenue based on current usage
  const monthsSinceCreation = Math.max(
    1,
    Math.floor((Date.now() / 1000 - license.created_at) / (30 * 86400))
  );
  const projectedAnnual = (actualYTD / monthsSinceCreation) * 12;

  // Calculate ROI percentage: (projectedAnnual - licenseCost) / licenseCost * 100
  const roiPercent = licenseCost > 0
    ? ((projectedAnnual - licenseCost) / licenseCost) * 100
    : 0;

  // Calculate payback period in months
  const paybackMonths = licenseCost > 0 && projectedAnnual > 0
    ? Math.ceil(licenseCost / (projectedAnnual / 12))
    : 0;

  return {
    projectedAnnual: Math.round(projectedAnnual * 100) / 100,
    actualYTD: Math.round(actualYTD * 100) / 100,
    paybackMonths: Math.max(1, paybackMonths),
    costPerUsage: Math.round(costPerUsage * 10000) / 10000,
    roiPercent: Math.round(roiPercent * 100) / 100,
    licenseCost: Math.round(licenseCost * 100) / 100,
    totalCredits: totalCreditsUsed,
  };
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
  const supabase = await createAdminClient();

  // Get all licenses for user
  const { data: licenses } = await supabase
    .from('raas_licenses')
    .select('nonce, tier, created_at, metadata')
    .eq('created_by', userId)
    .eq('is_revoked', false) as any;

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

  // Calculate ROI for each license and aggregate
  let totalProjectedAnnual = 0;
  let totalActualYTD = 0;
  let totalCost = 0;
  let totalCreditsUsed = 0;

  for (const license of licenses) {
    const metrics = await calculateRoiMetrics(license.nonce, valuePerCredit);
    totalProjectedAnnual += metrics.projectedAnnual;
    totalActualYTD += metrics.actualYTD;

    const metadata = license.metadata as { amount_usd?: { amount: number }; price?: number };
    totalCost += metadata?.amount_usd?.amount || metadata?.price || 0;
  }

  // Get total credits used across all licenses
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 86400);

  const { data: usageEvents } = await supabase
    .from('usage_events')
    .select('credits_used')
    .in(
      'license_nonce',
      licenses.map((l) => l.nonce)
    )
    .gte('created_at', thirtyDaysAgo);

  totalCreditsUsed = usageEvents?.reduce((sum, e) => sum + (e.credits_used || 0), 0) || 0;

  const costPerUsage = totalCreditsUsed > 0 ? totalCost / totalCreditsUsed : 0;
  const paybackMonths = totalProjectedAnnual > 0 ? Math.ceil(totalCost / (totalProjectedAnnual / 12)) : 0;
  const roiPercent = totalCost > 0 ? ((totalProjectedAnnual - totalCost) / totalCost) * 100 : 0;

  return {
    projectedAnnual: Math.round(totalProjectedAnnual * 100) / 100,
    actualYTD: Math.round(totalActualYTD * 100) / 100,
    paybackMonths: Math.max(1, paybackMonths),
    costPerUsage: Math.round(costPerUsage * 10000) / 10000,
    roiPercent: Math.round(roiPercent * 100) / 100,
    licenseCost: Math.round(totalCost * 100) / 100,
    totalCredits: totalCreditsUsed,
  };
}
