/**
 * Per-Channel Daily Quota Enforcement
 * TikTok: 30/day, YouTube: 50/day, Instagram: 25/day per channel.
 *
 * C6: Atomic D1 quota via raw SQL UPDATE WHERE used_today < limit.
 * Falls back to in-memory for dev/test when DB is unavailable.
 */

import type { ChannelProvider } from './publisher-interface';
import { logger } from '@/seed/utils/logger-utility';

export const DAILY_QUOTAS: Record<ChannelProvider, number> = {
  tiktok: 30,
  youtube: 50,
  instagram: 25,
  pinterest: 100,  // Pinterest API v5: generous quota for business accounts
  linkedin: 20,    // LinkedIn API: conservative daily limit
  twitter: 200,    // X/Twitter: high rate limit
  threads: 50,     // Threads API: moderate limit
  facebook: 100,   // Facebook: same as Instagram (shared app)
  zalo: 20,        // Zalo OA: conservative quota
  reddit: 10,      // Reddit API: conservative limit for link submissions
  bluesky: 100,    // AT Protocol: high limit, no hard published quota
  mastodon: 50,    // Mastodon: standard rate limit per instance
  telegram: 300,   // Telegram Bot API: 30 msg/sec, generous daily cap
  whatsapp: 100,   // WhatsApp Business: template-based, generous per WABA
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

const memStore = new Map<string, number>();

function memKey(channelId: string, day: string): string {
  return `${channelId}:${day}`;
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
}

async function tryGetRawDb(): Promise<D1Database | null> {
  try {
    const { getD1 } = await import('@/seed/db/client');
    return await getD1();
  } catch {
    return null;
  }
}

export async function checkQuota(
  channelId: string,
  provider: ChannelProvider,
): Promise<QuotaCheckResult> {
  const limit = DAILY_QUOTAS[provider];
  const day = todayUtc();
  const retryAfterSeconds = secondsUntilMidnightUtc();

  const db = await tryGetRawDb();
  if (db) {
    const row = await db
      .prepare('SELECT used_today FROM channel_quotas WHERE channel_id = ? AND day = ?')
      .bind(channelId, day)
      .first<{ used_today: number }>();
    const used = row?.used_today ?? 0;
    return { allowed: used < limit, used, limit, retryAfterSeconds };
  }

  const used = memStore.get(memKey(channelId, day)) ?? 0;
  return { allowed: used < limit, used, limit, retryAfterSeconds };
}

/**
 * Atomically increment quota if under limit (C6).
 * D1 raw SQL: no TOCTOU race.
 */
export async function consumeQuota(
  channelId: string,
  provider: ChannelProvider,
): Promise<QuotaCheckResult> {
  const limit = DAILY_QUOTAS[provider];
  const day = todayUtc();
  const retryAfterSeconds = secondsUntilMidnightUtc();

  const db = await tryGetRawDb();
  if (db) {
    await db
      .prepare(
        'INSERT INTO channel_quotas (channel_id, provider, day, daily_limit, used_today) VALUES (?, ?, ?, ?, 0) ON CONFLICT(channel_id, day) DO NOTHING',
      )
      .bind(channelId, provider, day, limit)
      .run();

    const result = await db
      .prepare(
        'UPDATE channel_quotas SET used_today = used_today + 1 WHERE channel_id = ? AND day = ? AND used_today < daily_limit',
      )
      .bind(channelId, day)
      .run();

    if ((result.meta?.changes ?? 0) === 0) {
      const row = await db
        .prepare('SELECT used_today FROM channel_quotas WHERE channel_id = ? AND day = ?')
        .bind(channelId, day)
        .first<{ used_today: number }>();
      const used = row?.used_today ?? limit;
      logger.warn('[PublishQuota] Quota exceeded (D1)', { channelId, provider, used, limit });
      return { allowed: false, used, limit, retryAfterSeconds };
    }

    const row = await db
      .prepare('SELECT used_today FROM channel_quotas WHERE channel_id = ? AND day = ?')
      .bind(channelId, day)
      .first<{ used_today: number }>();
    const used = row?.used_today ?? 1;
    return { allowed: true, used, limit, retryAfterSeconds };
  }

  // In-memory fallback
  const key = memKey(channelId, day);
  const current = memStore.get(key) ?? 0;
  if (current >= limit) {
    logger.warn('[PublishQuota] Quota exceeded (mem)', { channelId, provider, current, limit });
    return { allowed: false, used: current, limit, retryAfterSeconds };
  }
  const next = current + 1;
  memStore.set(key, next);
  return { allowed: true, used: next, limit, retryAfterSeconds };
}