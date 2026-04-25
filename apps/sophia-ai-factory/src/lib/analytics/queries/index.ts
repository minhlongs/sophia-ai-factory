/**
 * Analytics Queries - Barrel Re-export
 *
 * All analytics query functions consolidated for backward-compatible import.
 * Import from '@/lib/analytics/queries' or individual modules.
 */

export { fetchUsageMetrics } from './usage-queries';
export { fetchRevenueMetrics } from './revenue-queries';
export { fetchLicenseMetrics } from './campaign-queries';
export { fetchViolations, fetchViolationSummary } from './violation-queries';
export { fetchRevenueSnapshot } from './revenue-nowpayments';
