/**
 * Usage Rollup Engine Constants & Helpers
 *
 * Layer: tree/usage-metering
 */

export { QUOTA_LIMITS } from '@/seed/config/quota-limits';

/** Maximum date range for queries (90 days) — prevents expensive full-table scans */
export const MAX_DATE_RANGE_DAYS = 90;

export function currentYearMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
