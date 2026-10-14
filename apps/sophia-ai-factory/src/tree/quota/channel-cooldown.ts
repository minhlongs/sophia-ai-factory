/**
 * channel-cooldown.ts — Per-channel cooldown + burst-protection enforcement.
 * @module tree/quota/channel-cooldown
 */

import type { ChannelProvider } from '@/seed/types/channel-provider';
import {
  CHANNEL_COOLDOWN_SECONDS,
  BURST_LIMIT_PER_HOUR,
  BURST_WINDOW_SECONDS,
} from '@/seed/config/channel-cooldown-rules';
import { logger } from '@/seed/utils/logger-utility';
import {
  tryGetRawDb,
  checkCooldownInMemory,
  recordPostInMemory,
  _resetMemStoreForTests,
  type CooldownViolationReason,
  type CooldownCheckResult,
} from './channel-cooldown-mem-store';

export {
  recordPostInMemory,
  _resetMemStoreForTests,
  type CooldownViolationReason,
  type CooldownCheckResult,
};

/**
 * Check if a new post to `channelId`/`provider` is allowed now.
 */
export async function checkCooldown(
  tenantId: string,
  channelId: string,
  provider: ChannelProvider,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<CooldownCheckResult> {
  const cooldownSecs = CHANNEL_COOLDOWN_SECONDS[provider];
  const burstWindow = nowSeconds - BURST_WINDOW_SECONDS;

  const db = await tryGetRawDb();

  if (db) {
    const row = await db
      .prepare(
        `SELECT
           MAX(finished_at) AS last_finished_at,
           SUM(CASE WHEN finished_at >= ? THEN 1 ELSE 0 END) AS burst_count
         FROM publishing_jobs
         WHERE tenant_id = ? AND channel_id = ? AND status = 'live'`,
      )
      .bind(burstWindow, tenantId, channelId)
      .first<{ last_finished_at: number | null; burst_count: number | null }>();

    const lastAt = row?.last_finished_at ?? null;
    const burstCount = row?.burst_count ?? 0;

    if (burstCount >= BURST_LIMIT_PER_HOUR) {
      const deferUntil = nowSeconds + Math.ceil(BURST_WINDOW_SECONDS / BURST_LIMIT_PER_HOUR);
      const deferSeconds = deferUntil - nowSeconds;
      logger.warn('[ChannelCooldown] Burst limit reached', {
        tenantId, channelId, provider, burstCount, deferUntil,
      });
      return { allowed: false, deferUntil, reason: 'burst', deferSeconds };
    }

    if (lastAt !== null && nowSeconds - lastAt < cooldownSecs) {
      const deferUntil = lastAt + cooldownSecs;
      const deferSeconds = deferUntil - nowSeconds;
      logger.warn('[ChannelCooldown] Cooldown not elapsed', {
        tenantId, channelId, provider, lastAt, cooldownSecs, deferUntil,
      });
      return { allowed: false, deferUntil, reason: 'cooldown', deferSeconds };
    }

    return { allowed: true };
  }

  return checkCooldownInMemory(tenantId, channelId, cooldownSecs, burstWindow, nowSeconds);
}
