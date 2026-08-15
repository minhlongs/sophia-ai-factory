/**
 * Analytics Queries - Barrel Re-export (backward compatibility)
 *
 * This file re-exports from the modularized queries/ directory.
 * Import from here or directly from '@/land/analytics/queries/*'.
 */

export {
  fetchUsageMetrics,
  fetchRevenueMetrics,
  fetchLicenseMetrics,
  fetchRevenueSnapshot,
} from './queries/index';
