/**
 * Per-Channel Daily Quota Enforcement
 * TikTok: 30/day, YouTube: 50/day, Instagram: 25/day per channel.
 * Counters stored in KV with daily reset at 00:00 UTC.
 * Falls back to in-memory map when KV is unavailable (test/dev).
 */

import type { ChannelProvider } from './publisher-interface';
import { logger } from '@/lib/utils/logger-utility';

export const DAILY_QUOTAS: Record<ChannelProvider, number> = {
  tiktok: 30,
  youtube: 50,
  instagram: 25,
};

/** Seconds until next midnight UTC */
function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

/** KV key for a channel's daily counter */
function kvKey(channelId: string, provider: ChannelProvider): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return `pub_quota:${day}:${provider}:${channelId}`;
}

function getKv(): KVNamespace | null {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  if (env?.PUBLISHING_QUOTA_KV) return env.PUBLISHING_QUOTA_KV as KVNamespace;
  return null;
}

// In-memory fallback for dev/test
const memStore = new Map<string, number>();

async function getCount(key: string): Promise<number> {
  const kv = getKv();
  if (kv) {
    const val = await kv.get(key);
    return val ? parseInt(val, 10) : 0;
  }
  return memStore.get(key) ?? 0;
}

async function incrementCount(key: string, ttl: number): Promise<number> {
  const kv = getKv();
  const current = await getCount(key);
  const next = current + 1;

  if (kv) {
    await kv.put(key, String(next), { expirationTtl: ttl });
  } else {
    memStore.set(key, next);
  }

  return next;
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Check quota WITHOUT incrementing counter.
 */
export async function checkQuota(
  channelId: string,
  provider: ChannelProvider,
): Promise<QuotaCheckResult> {
  const limit = DAILY_QUOTAS[provider];
  const key = kvKey(channelId, provider);
  const used = await getCount(key);
  const retryAfterSeconds = secondsUntilMidnightUtc();

  return { allowed: used < limit, used, limit, retryAfterSeconds };
}

/**
 * Check quota AND increment if allowed.
 * Returns QuotaCheckResult; allowed=false → caller should return 429.
 */
export async function consumeQuota(
  channelId: string,
  provider: ChannelProvider,
): Promise<QuotaCheckResult> {
  const limit = DAILY_QUOTAS[provider];
  const key = kvKey(channelId, provider);
  const current = await getCount(key);
  const retryAfterSeconds = secondsUntilMidnightUtc();

  if (current >= limit) {
    logger.warn('[PublishQuota] Quota exceeded', { channelId, provider, current, limit });
    return { allowed: false, used: current, limit, retryAfterSeconds };
  }

  const next = await incrementCount(key, retryAfterSeconds);
  return { allowed: true, used: next, limit, retryAfterSeconds };
}
