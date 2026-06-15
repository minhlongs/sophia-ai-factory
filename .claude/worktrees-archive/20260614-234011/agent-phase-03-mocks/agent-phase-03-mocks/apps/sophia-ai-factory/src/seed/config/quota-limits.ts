/**
 * Quota Limits — seed layer constant.
 *
 * Canonical per-tier quota limit values sourced from UNIFIED_TIERS.
 * Moved here from forest/usage-metering/usage-rollup-engine.ts so that
 * land-layer billing code can import without crossing the land→forest barrier.
 *
 * Forest re-exports this for back-compat via forest/usage-metering/aggregator.ts.
 *
 * @module seed/config/quota-limits
 */

import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { QuotaLimit } from '@/seed/types/quota-limit';

/**
 * Quota limits by tier — monthly credits sourced from config/tiers.
 * Daily/hourly sub-limits derived proportionally.
 */
export const QUOTA_LIMITS: Record<string, QuotaLimit> = {
  BASIC: {
    tier: 'BASIC',
    dailyCredits: Math.ceil(UNIFIED_TIERS.BASIC.mcuMonthly / 30),
    hourlyCredits: Math.ceil(UNIFIED_TIERS.BASIC.mcuMonthly / 30 / 5),
    dailyRequests: 500,
    monthlyCredits: UNIFIED_TIERS.BASIC.mcuMonthly,
  },
  PREMIUM: {
    tier: 'PREMIUM',
    dailyCredits: Math.ceil(UNIFIED_TIERS.PREMIUM.mcuMonthly / 30),
    hourlyCredits: Math.ceil(UNIFIED_TIERS.PREMIUM.mcuMonthly / 30 / 5),
    dailyRequests: 2500,
    monthlyCredits: UNIFIED_TIERS.PREMIUM.mcuMonthly,
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    dailyCredits: Math.ceil(UNIFIED_TIERS.ENTERPRISE.mcuMonthly / 30),
    hourlyCredits: Math.ceil(UNIFIED_TIERS.ENTERPRISE.mcuMonthly / 30 / 5),
    dailyRequests: 10000,
    monthlyCredits: UNIFIED_TIERS.ENTERPRISE.mcuMonthly,
  },
  MASTER: {
    tier: 'MASTER',
    dailyCredits: Math.ceil(UNIFIED_TIERS.MASTER.mcuMonthly / 30),
    hourlyCredits: Math.ceil(UNIFIED_TIERS.MASTER.mcuMonthly / 30 / 5),
    dailyRequests: 50000,
    monthlyCredits: UNIFIED_TIERS.MASTER.mcuMonthly,
  },
};
