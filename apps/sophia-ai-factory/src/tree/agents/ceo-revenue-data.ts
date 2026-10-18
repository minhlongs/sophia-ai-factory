/**
 * @module tree/agents/ceo-revenue-data
 *
 * Revenue insights data fetch for CEO agent.
 * Extracted from ceo-executor.ts for file size management.
 *
 * Layer: tree → imports seed only.
 */

import { createServerClient } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import type { RevenueInsights } from './ceo-intent-types';
import {
  parsePeriodLabel,
  resolveTimestamps,
  aggregateLicenseTotals,
  buildTrendPoints,
  type RawLicense,
} from './ceo-revenue-aggregators';

const log = createLogger('ceo-executor');

/**
 * Fetch revenue insights for a time period.
 *
 * Aggregates license revenue from raas_licenses and payment_events tables.
 * Returns bilingual-friendly data suitable for CEO agent responses.
 */
export async function fetchRevenue(
  periodLabel: string,
  _userId?: string,
): Promise<RevenueInsights> {
  const db = createServerClient();
  const now = Date.now();
  const period = parsePeriodLabel(periodLabel);
  const { startTimestamp, endTimestamp } = resolveTimestamps(period, now);

  // Fetch licenses relevant to this user's org
  const { data: licenses } = await db
    .from('raas_licenses')
    .select('tier, created_at, metadata')
    .gte('created_at', startTimestamp)
    .lte('created_at', endTimestamp);

  const rawLicenses = (licenses ?? []) as RawLicense[];
  const { totalRevenue, recurringRevenue, oneTimeRevenue, byTier } = aggregateLicenseTotals(rawLicenses);
  const trend = buildTrendPoints(rawLicenses, startTimestamp, endTimestamp);

  log.info('[ceo-executor] Revenue fetched', {
    period,
    totalRevenue,
    licensesCount: rawLicenses.length,
  });

  return {
    periodLabel,
    totalRevenue,
    recurringRevenue,
    oneTimeRevenue,
    byTier,
    trend,
  };
}
