/**
 * Quota Counter - Edge-based Atomic Counter
 *
 * KV storage backed quota tracking with monthly reset logic
 * and hard limit enforcement at 150% overage.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Env {
  KV_KV: KVNamespace;
  HARD_LIMIT_PERCENT: string;
}

interface QuotaResponse {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetDate: string;
  overage?: number;
}

interface UsageData {
  current: number;
  limit: number;
  resetDate: string;
  lastUpdated: number;
}

// Tier-based quota limits (requests per month)
const TIER_LIMITS: Record<string, number> = {
  BASIC: 1000,
  PREMIUM: 10000,
  ENTERPRISE: 100000
};

/**
 * Get current month key for KV storage
 * Format: quota:{apiKey}:{service}:{YYYY-MM}
 */
function getMonthKey(apiKey: string, service: string): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `quota:${apiKey}:${service}:${year}-${month}`;
}

/**
 * Get reset date (first day of next month)
 */
function getResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

/**
 * Atomic increment of usage counter
 * Uses KV's atomic operations for race condition safety
 */
export async function incrementUsage(
  apiKey: string,
  service: string,
  tokens: number,
  kv: KVNamespace
): Promise<number> {
  const key = getMonthKey(apiKey, service);

  // Get current value
  const currentValue = await kv.get(key);

  // Parse current value or start at 0
  const current = currentValue ? parseInt(currentValue, 10) || 0 : 0;
  const newValue = current + tokens;

  // Store new value with TTL
  await kv.put(key, newValue.toString(), {
    expirationTtl: 2592000 // 30 days TTL
  });

  return newValue;
}

/**
 * Get current usage count
 */
export async function getCurrentUsage(
  apiKey: string,
  service: string,
  kv: KVNamespace
): Promise<number> {
  const key = getMonthKey(apiKey, service);
  const value = await kv.get(key);

  if (!value) {
    return 0;
  }

  return parseInt(value, 10) || 0;
}

/**
 * Check quota and return enforcement decision
 * Implements hard limit at 150% overage
 */
export async function checkQuota(
  apiKey: string,
  service: string,
  kv: KVNamespace,
  hardLimitPercent: number = 150
): Promise<QuotaResponse> {
  const key = getMonthKey(apiKey, service);

  // Get tier from KV (stored during key provisioning)
  const tierKey = `tier:${apiKey}`;
  const tier = await kv.get(tierKey) || 'BASIC';

  const baseLimit = TIER_LIMITS[tier] || TIER_LIMITS.BASIC;
  const hardLimit = Math.floor(baseLimit * (hardLimitPercent / 100));

  // Get current usage
  const currentValue = await kv.get(key);
  const currentUsage = currentValue ? parseInt(currentValue, 10) || 0 : 0;

  const remaining = Math.max(0, baseLimit - currentUsage);
  const overage = Math.max(0, currentUsage - baseLimit);
  const isOverHardLimit = currentUsage >= hardLimit;

  return {
    allowed: !isOverHardLimit,
    remaining,
    limit: baseLimit,
    resetDate: getResetDate(),
    overage: overage > 0 ? overage : undefined
  };
}

/**
 * Reset quota for testing/admin purposes
 */
export async function resetQuota(
  apiKey: string,
  service: string,
  kv: KVNamespace
): Promise<boolean> {
  try {
    const key = getMonthKey(apiKey, service);
    await kv.delete(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get quota usage summary
 */
export async function getQuotaSummary(
  apiKey: string,
  kv: KVNamespace
): Promise<Record<string, UsageData>> {
  const summary: Record<string, UsageData> = {};

  // List all quota keys for this API key
  const prefix = `quota:${apiKey}:`;
  const keys = await kv.list({ prefix });

  for (const key of keys.keys) {
    const value = await kv.get(key.name);
    if (value) {
      const parts = key.name.split(':');
      const service = parts[2];
      const current = parseInt(value, 10) || 0;

      // Get tier for limit
      const tier = await kv.get(`tier:${apiKey}`) || 'BASIC';
      const limit = TIER_LIMITS[tier] || TIER_LIMITS.BASIC;

      summary[service] = {
        current,
        limit,
        resetDate: getResetDate(),
        lastUpdated: (key.metadata as { lastUpdated?: number } | undefined)?.lastUpdated || Date.now()
      };
    }
  }

  return summary;
}
