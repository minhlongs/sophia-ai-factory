/**
 * Slot, cooldown, and timing calculation for publishing scheduler
 * @module forest/publishing/scheduler-ops/slot-calculator
 */

import { randomUUID } from 'crypto';
import type { D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { ApacMarket } from '@/seed/types/apac-syndication';
import {
  calculateNextPeakPublishTime,
  detectMarketFromTimezone,
} from '@/tree/publishing/apac-peak-optimizer';
import { checkCooldown } from '@/forest/quota/channel-cooldown';
import type { PublishingChannel, ChannelProvider } from '../publisher-interface';
import type { DeferredChannel } from './types';

/**
 * Calculate the next optimal peak publishing time using the APAC Peak-Time Optimizer.
 * Optimizes for top APAC markets (Hà Nội, Tokyo, Bangkok, Seoul, Singapore).
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

/**
 * Database anti-collision loop — finds an available slot without conflicting scheduled jobs.
 */
export async function findAvailablePublishSlot(
  db: D1Client,
  tenantId: string,
  channelId: string,
  startScheduledAt: number,
): Promise<number> {
  const MAX_CONFLICT_ITERATIONS = 48;
  let effectiveScheduledAt = startScheduledAt;
  let conflictFound = true;
  let conflictIterations = 0;

  while (conflictFound) {
    const minTime = effectiveScheduledAt - 299;
    const maxTime = effectiveScheduledAt + 299;

    const { data: existingJobs } = await db
      .from('publishing_jobs')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('channel_id', channelId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', minTime)
      .lte('scheduled_at', maxTime);

    if (existingJobs && existingJobs.length > 0) {
      conflictIterations++;
      if (conflictIterations >= MAX_CONFLICT_ITERATIONS) {
        logger.warn('[Scheduler] Anti-collision cap reached — accepting conflicting slot', {
          channelId,
          effectiveScheduledAt,
          iterations: conflictIterations,
        });
        conflictFound = false;
      } else {
        effectiveScheduledAt += 300;
      }
    } else {
      conflictFound = false;
    }
  }

  return effectiveScheduledAt;
}

/**
 * Persists a new scheduled publishing job row in database.
 */
export async function insertPublishingJobRow(
  db: D1Client,
  params: {
    tenantId: string;
    videoJobId: string;
    channelId: string;
    caption: string;
    hashtagsJson: string;
    productLink?: string;
    scheduledAt: number;
    nowSec: number;
  },
): Promise<string> {
  const jobId = randomUUID();
  await db.from('publishing_jobs').insert({
    id: jobId,
    tenant_id: params.tenantId,
    video_id: params.videoJobId,
    channel_id: params.channelId,
    status: 'scheduled',
    caption: params.caption,
    hashtags_json: params.hashtagsJson,
    product_link: params.productLink ?? null,
    scheduled_at: params.scheduledAt,
    started_at: null,
    finished_at: null,
    retry_count: 0,
    error: null,
    created_at: params.nowSec,
  });
  return jobId;
}
