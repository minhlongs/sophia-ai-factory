/**
 * Core publishing scheduler and cron processor
 * @module forest/publishing/scheduler-ops/publishing-scheduler-engine
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { consumeQuota } from '../per-channel-quota';
import type { ChannelProvider } from '../publisher-interface';
import type {
  SchedulePublishInput,
  SchedulePublishResult,
} from './types';
import {
  validateAndSortChannels,
  calculateChannelScheduledTime,
  findAvailablePublishSlot,
  insertPublishingJobRow,
} from './slot-calculator';

export { runSchedulerCron } from './scheduler-cron-runner';

/**
 * Validate tenant owns the requested channels, check quota, insert jobs.
 */
export async function schedulePublish(input: SchedulePublishInput): Promise<SchedulePublishResult> {
  const db = createServerClient();
  const {
    videoJobId,
    tenantId,
    userId,
    channelIds,
    caption,
    hashtags,
    productLink,
    scheduledAt,
    audienceTimezone,
    optimizeSchedule,
    staggerMinutes = 5,
  } = input;

  // Fetch all requested channels — validate tenant ownership
  const { data: channels } = await db
    .from('publishing_channels')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .in('id', channelIds);

  const sortedChannels = validateAndSortChannels(channels, channelIds);
  const now = Math.floor(Date.now() / 1000);
  const jobIds: string[] = [];
  const quotaBlocked: SchedulePublishResult['quotaBlocked'] = [];
  const deferred: SchedulePublishResult['deferred'] = [];
  const hashtagsJson = JSON.stringify(hashtags);

  for (let idx = 0; idx < sortedChannels.length; idx++) {
    const channel = sortedChannels[idx];
    const provider = channel.provider as ChannelProvider;

    // Check per-channel quota (daily limit)
    const quota = await consumeQuota(channel.id, provider);
    if (!quota.allowed) {
      quotaBlocked.push({
        channelId: channel.id,
        provider: channel.provider,
        retryAfter: quota.retryAfterSeconds,
      });
      continue;
    }

    const { effectiveScheduledAt: computedAt, deferred: deferInfo } =
      await calculateChannelScheduledTime({
        baseScheduledAt: scheduledAt,
        idx,
        staggerMinutes,
        optimizeSchedule,
        audienceTimezone,
        market: input.market,
        tenantId,
        channelId: channel.id,
        provider,
        nowSec: now,
      });

    if (deferInfo) deferred.push(deferInfo);

    const finalScheduledAt = await findAvailablePublishSlot(
      db,
      tenantId,
      channel.id,
      computedAt,
    );

    const jobId = await insertPublishingJobRow(db, {
      tenantId,
      videoJobId,
      channelId: channel.id,
      caption,
      hashtagsJson,
      productLink,
      scheduledAt: finalScheduledAt,
      nowSec: now,
    });

    jobIds.push(jobId);

    await inngest.send({
      name: 'publish.scheduled',
      data: { jobId, tenantId, userId },
    });

    logger.info('[Scheduler] Job created', {
      jobId,
      channelId: channel.id,
      provider: channel.provider,
      scheduledAt: finalScheduledAt,
      deferred: deferInfo !== undefined,
    });
  }

  return { jobIds, quotaBlocked, deferred };
}
