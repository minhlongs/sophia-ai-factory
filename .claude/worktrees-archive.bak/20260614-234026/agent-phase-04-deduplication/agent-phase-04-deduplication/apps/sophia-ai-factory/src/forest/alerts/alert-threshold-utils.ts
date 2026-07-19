/**
 * Alert threshold and debounce utilities.
 *
 * Pure, stateless helper functions for threshold checking.
 * Debounce state is module-level (in-process only).
 *
 * Consumed by supabase-realtime-alert-service.ts.
 */

// -------------------------------------------------------------------------
// Threshold checking
// -------------------------------------------------------------------------

export interface ThresholdResult {
  breached: boolean;
  threshold: number;
  percentage: number;
}

/**
 * Check whether currentUsage crosses any of the given thresholds.
 * Evaluates thresholds highest-first and returns the first breached one.
 */
export function checkThresholds(
  currentUsage: number,
  limit: number,
  thresholds: number[]
): ThresholdResult {
  const percentage = (currentUsage / limit) * 100;
  for (const threshold of [...thresholds].sort((a, b) => b - a)) {
    if (percentage >= threshold) {
      return { breached: true, threshold, percentage };
    }
  }
  return { breached: false, threshold: 0, percentage };
}

// -------------------------------------------------------------------------
// Debounce state (in-process)
// -------------------------------------------------------------------------

const debounceState = new Map<string, number>();

function debounceKey(userId: string, licenseNonce: string, threshold: number): string {
  return `${userId}:${licenseNonce}:${threshold}`;
}

/**
 * Returns true if an alert for this user/license/threshold was recently sent
 * (within debounceMs milliseconds).
 */
export function isDebounced(
  userId: string,
  licenseNonce: string,
  threshold: number,
  debounceMs: number
): boolean {
  const lastTime = debounceState.get(debounceKey(userId, licenseNonce, threshold));
  if (!lastTime) return false;
  return Date.now() - lastTime < debounceMs;
}

/**
 * Record that an alert was sent for this user/license/threshold.
 */
export function markAlertSent(userId: string, licenseNonce: string, threshold: number): void {
  debounceState.set(debounceKey(userId, licenseNonce, threshold), Date.now());
}

// -------------------------------------------------------------------------
// Quota limits by tier
// -------------------------------------------------------------------------

export interface QuotaLimits {
  hourly: number;
  daily: number;
  monthly: number;
}

const TIER_QUOTA_LIMITS: Record<string, QuotaLimits> = {
  BASIC:      { hourly: 100,   daily: 1000,   monthly: 10000 },
  PREMIUM:    { hourly: 500,   daily: 5000,   monthly: 50000 },
  ENTERPRISE: { hourly: 2000,  daily: 20000,  monthly: 200000 },
  MASTER:     { hourly: 10000, daily: 100000, monthly: 1000000 },
};

/**
 * Return quota limits for the given tier (falls back to BASIC).
 */
export function getQuotaLimitForTier(tier: string): QuotaLimits {
  return TIER_QUOTA_LIMITS[tier.toUpperCase()] ?? TIER_QUOTA_LIMITS.BASIC;
}
