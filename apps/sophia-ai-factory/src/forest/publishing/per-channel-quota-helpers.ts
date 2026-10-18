/**
 * Per-Channel Daily Quota Constants & Storage Helpers
 */

import type { ChannelProvider } from './publisher-interface';

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

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  retryAfterSeconds: number;
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function secondsUntilMidnightUtc(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

export const memStore = new Map<string, number>();

export function memKey(channelId: string, day: string): string {
  return `${channelId}:${day}`;
}

export async function tryGetRawDb(): Promise<D1Database | null> {
  try {
    const { getD1 } = await import('@/seed/db/client');
    return await getD1();
  } catch {
    return null;
  }
}
