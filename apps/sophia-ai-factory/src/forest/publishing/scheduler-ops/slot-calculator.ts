/**
 * Slot, cooldown, and timing calculation for publishing scheduler
 * @module forest/publishing/scheduler-ops/slot-calculator
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ApacMarket } from '@/seed/types/apac-syndication';
import {
  calculateNextPeakPublishTime,
  detectMarketFromTimezone,
} from '@/tree/publishing/apac-peak-optimizer';
import { checkCooldown } from '@/tree/quota/channel-cooldown';
import type { PublishingChannel, ChannelProvider } from '../publisher-interface';
import type { DeferredChannel } from './types';
import {
  findAvailablePublishSlot,
  insertPublishingJobRow,
} from './slot-persistence';

export { findAvailablePublishSlot, insertPublishingJobRow };

/**
 * Calculate the next optimal peak publishing time using the APAC Peak-Time Optimizer.
 */
export function getOptimalPublishTime(
  scheduledAtSec: number,
  tz: string = 'Asia/Ho_Chi_Minh',
  market?: ApacMarket,
): number {
  const targetMarket: ApacMarket = market || detectMarketFromTimezone(tz);
  const peak = calculateNextPeakPublishTime(scheduledAtSec * 1000, targetMarket);
  return Math.floor(peak.scheduledAtMs / 1000);
}

/**
 * Validates channels belong to tenant and returns sorted channel array.
 */
export function validateAndSortChannels(
  channels: unknown[] | null,
  channelIds: string[],
): PublishingChannel[] {
  const validChannels = (channels ?? []) as unknown as PublishingChannel[];
  const validIds = new Set(validChannels.map((c) => c.id));

  const missingIds = channelIds.filter((id) => !validIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Channels not found or not owned by tenant: ${missingIds.join(', ')}`);
  }

  return [...validChannels].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Computes scheduled time accounting for peak optimizer, channel stagger, and cooldowns.
 */
export async function calculateChannelScheduledTime(params: {
  baseScheduledAt: number;
  idx: number;
  staggerMinutes: number;
  optimizeSchedule?: boolean;
  audienceTimezone?: string;
  market?: ApacMarket;
  tenantId: string;
  channelId: string;
  provider: ChannelProvider;
  nowSec: number;
}): Promise<{ effectiveScheduledAt: number; deferred?: DeferredChannel }> {
  let effectiveScheduledAt = params.baseScheduledAt;

  if (params.optimizeSchedule) {
    effectiveScheduledAt = getOptimalPublishTime(
      effectiveScheduledAt,
      params.audienceTimezone || 'Asia/Ho_Chi_Minh',
      params.market,
    );
  }

  effectiveScheduledAt += params.idx * (params.staggerMinutes * 60);

  const cooldown = await checkCooldown(
    params.tenantId,
    params.channelId,
    params.provider,
    params.nowSec,
  );

  let deferred: DeferredChannel | undefined;
  if (!cooldown.allowed && cooldown.deferUntil !== undefined) {
    effectiveScheduledAt = Math.max(effectiveScheduledAt, cooldown.deferUntil);
    deferred = {
      channelId: params.channelId,
      provider: params.provider,
      deferredUntil: effectiveScheduledAt,
      reason: cooldown.reason ?? 'cooldown',
    };
    logger.info('[Scheduler] Job deferred due to cooldown', {
      channelId: params.channelId,
      provider: params.provider,
      reason: cooldown.reason,
      originalScheduledAt: params.baseScheduledAt,
      effectiveScheduledAt,
      deferSeconds: cooldown.deferSeconds,
    });
  }

  return { effectiveScheduledAt, deferred };
}
