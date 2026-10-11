/**
 * Executive BI Digest Metrics Aggregator
 *
 * Implements validation and preparation for executive BI digest metrics.
 *
 * Layer: forest
 *
 * @module forest/bi/digest/digest-aggregator
 */

import type { ExecutiveBIMetricsSummary, EmailDigestOptions } from './types';

export interface PreparedDigestMetrics {
  mrrFormatted: string;
  affiliateRevenueFormatted: string;
  marketingSpendFormatted: string;
  throughputCount: number;
  viralScore: number;
  roiRatio: number;
}

/**
 * Validates and formats raw metrics summary into presentation values.
 */
export function prepareDigestMetrics(metrics: ExecutiveBIMetricsSummary): PreparedDigestMetrics {
  return {
    mrrFormatted: (metrics.mrrCents / 100).toFixed(2),
    affiliateRevenueFormatted: (metrics.affiliateRevenueCents / 100).toFixed(2),
    marketingSpendFormatted: (metrics.marketingSpendCents / 100).toFixed(2),
    throughputCount: metrics.throughputCount,
    viralScore: metrics.viralScore,
    roiRatio: metrics.roiRatio,
  };
}

/**
 * Normalizes recipients list from EmailDigestOptions.
 */
export function extractRecipients(options: EmailDigestOptions): string[] {
  if (Array.isArray(options.to)) {
    return options.to.map((r) => r.trim()).filter(Boolean);
  }
  if (typeof options.to === 'string' && options.to.trim().length > 0) {
    return [options.to.trim()];
  }
  return [];
}
