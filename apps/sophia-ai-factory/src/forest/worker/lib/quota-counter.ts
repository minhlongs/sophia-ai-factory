/**
 * Quota Counter - Edge-based Atomic Counter
 *
 * KV storage backed quota tracking with monthly reset logic
 * and hard limit enforcement at 150% overage.
 */

import {
  TIER_LIMITS,
  getMonthKey,
  getResetDate,
  type QuotaResponse,
  type UsageData,
} from './quota-counter-helpers';

export type { QuotaResponse, UsageData } from './quota-counter-helpers';

/** Atomic increment of usage counter */
export async function incrementUsage(
  apiKey: string,
  service: string,
  tokens: number,
  kv: KVNamespace,
): Promise<number> {
  const key = getMonthKey(apiKey, service);
  const currentValue = await kv.get(key);
  const current = currentValue ? parseInt(currentValue, 10) || 0 : 0;
  const newValue = current + tokens;

  await kv.put(key, newValue.toString(), { expirationTtl: 2592000 });
  return newValue;
}

/** Get current usage count */
export async function getCurrentUsage(
  apiKey: string,
  service: string,
  kv: KVNamespace,
): Promise<number> {
  const value = await kv.get(getMonthKey(apiKey, service));
  return value ? parseInt(value, 10) || 0 : 0;
}

/** Check quota and return enforcement decision (hard limit at 150% overage) */
export async function checkQuota(
  apiKey: string,
  service: string,
  kv: KVNamespace,
  hardLimitPercent: number = 150,
): Promise<QuotaResponse> {
  const key = getMonthKey(apiKey, service);
  const tier = (await kv.get(`tier:${apiKey}`)) || 'BASIC';
  const baseLimit = TIER_LIMITS[tier] || TIER_LIMITS.BASIC;
  const hardLimit = Math.floor(baseLimit * (hardLimitPercent / 100));

  const currentValue = await kv.get(key);
  const currentUsage = currentValue ? parseInt(currentValue, 10) || 0 : 0;
  const remaining = Math.max(0, baseLimit - currentUsage);
  const overage = Math.max(0, currentUsage - baseLimit);

  return {
    allowed: currentUsage < hardLimit,
    remaining,
    limit: baseLimit,
    resetDate: getResetDate(),
    overage: overage > 0 ? overage : undefined,
  };
}

/** Reset quota for testing/admin purposes */
export async function resetQuota(
  apiKey: string,
  service: string,
  kv: KVNamespace,
): Promise<boolean> {
  try {
    await kv.delete(getMonthKey(apiKey, service));
    return true;
  } catch {
    return false;
  }
}

/** Get quota usage summary */
export async function getQuotaSummary(
  apiKey: string,
  kv: KVNamespace,
): Promise<Record<string, UsageData>> {
  const summary: Record<string, UsageData> = {};
  const keys = await kv.list({ prefix: `quota:${apiKey}:` });

  for (const key of keys.keys) {
    const value = await kv.get(key.name);
    if (value) {
      const service = key.name.split(':')[2];
      const current = parseInt(value, 10) || 0;
      const tier = (await kv.get(`tier:${apiKey}`)) || 'BASIC';
      const limit = TIER_LIMITS[tier] || TIER_LIMITS.BASIC;

      summary[service] = {
        current,
        limit,
        resetDate: getResetDate(),
        lastUpdated:
          (key.metadata as { lastUpdated?: number } | undefined)?.lastUpdated || Date.now(),
      };
    }
  }

  return summary;
}
