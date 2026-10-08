/**
 * Forest Orchestrator: Social Token Refresh Scheduler
 * Inspects social publisher accounts and triggers OAuth renewals prior to expiration.
 * Layer: forest/growth | Max LOC: < 200 | Zero :any
 * @module forest/growth/token-refresh-scheduler
 */

import { FLYWHEEL_CONFIG } from '@/seed/config/growth/flywheel-weights';

export interface SocialAccountTokenStatus {
  accountId: string;
  platform: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
  expiresAtMs: number;
  isStale: boolean;
  needsProactiveRefresh: boolean;
}

/**
 * Determines whether a social token needs proactive renewal based on configured lead time.
 */
export function evaluateTokenRefreshUrgency(
  accountId: string,
  platform: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS',
  expiresAtMs: number,
  nowMs: number = Date.now(),
): SocialAccountTokenStatus {
  const timeRemainingMs = expiresAtMs - nowMs;
  const isStale = timeRemainingMs <= 0;
  const needsProactiveRefresh = isStale || timeRemainingMs <= FLYWHEEL_CONFIG.TOKEN_REFRESH_LEAD_TIME_MS;

  return {
    accountId,
    platform,
    expiresAtMs,
    isStale,
    needsProactiveRefresh,
  };
}

/**
 * Batch evaluates list of connected channels to find candidates for renewal.
 */
export function filterTokensRequiringRefresh(
  accounts: Array<{
    accountId: string;
    platform: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
    expiresAtMs: number;
  }>,
  nowMs: number = Date.now(),
): SocialAccountTokenStatus[] {
  return accounts
    .map((acc) => evaluateTokenRefreshUrgency(acc.accountId, acc.platform, acc.expiresAtMs, nowMs))
    .filter((status) => status.needsProactiveRefresh);
}
