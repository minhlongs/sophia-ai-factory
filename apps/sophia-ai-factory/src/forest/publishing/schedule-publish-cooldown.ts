/**
 * Cooldown evaluation helper for schedulePublish.
 * @module forest/publishing/schedule-publish-cooldown
 */

import { checkCooldown } from '@/tree/quota/channel-cooldown';
import { logger } from '@/seed/utils/logger-utility';
import type { ChannelProvider } from '@/forest/publishing/publisher-interface';

const KNOWN_PROVIDERS: ChannelProvider[] = [
  'tiktok', 'youtube', 'instagram', 'pinterest', 'linkedin', 'zalo',
  'facebook', 'twitter', 'threads', 'reddit', 'bluesky', 'mastodon', 'telegram',
];

export interface CooldownEvalResult {
  scheduled: number;
  deferredUntil?: number;
  deferReason?: 'cooldown' | 'burst';
}

export async function resolvePublishCooldown(params: {
  tenantId: string;
  channelId: string;
  provider: string;
  requested: number;
  now: number;
}): Promise<CooldownEvalResult> {
  const { tenantId, channelId, provider, requested, now } = params;
  let scheduled = requested;
  let deferredUntil: number | undefined;
  let deferReason: 'cooldown' | 'burst' | undefined;

  const typedProvider = KNOWN_PROVIDERS.includes(provider as ChannelProvider)
    ? (provider as ChannelProvider)
    : null;

  if (typedProvider !== null) {
    try {
      const cooldown = await checkCooldown(tenantId, channelId, typedProvider, now);
      if (!cooldown.allowed && cooldown.deferUntil !== undefined) {
        scheduled = Math.max(requested, cooldown.deferUntil);
        deferredUntil = scheduled;
        deferReason = cooldown.reason;
        logger.info('[schedulePublish] Cooldown deferred', {
          channelId,
          provider,
          reason: cooldown.reason,
          requested,
          deferredUntil: scheduled,
          deferSeconds: cooldown.deferSeconds,
        });
      }
    } catch (cooldownErr) {
      // Cooldown check failure is non-fatal — proceed with original scheduledAt
      logger.warn('[schedulePublish] Cooldown check error (non-fatal)', {
        channelId,
        provider,
        err: cooldownErr instanceof Error ? cooldownErr.message : String(cooldownErr),
      });
    }
  }

  return { scheduled, deferredUntil, deferReason };
}
