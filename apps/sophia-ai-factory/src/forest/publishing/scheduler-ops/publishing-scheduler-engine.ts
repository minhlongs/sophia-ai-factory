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
  SchedulerCronResult,
} from './types';
import {
  validateAndSortChannels,
  calculateChannelScheduledTime,
  findAvailablePublishSlot,
  insertPublishingJobRow,
} from './slot-calculator';

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

/**
 * Idempotent Scheduler Cron Processor.
 * Enforces atomic OCC CAS job claiming (atomicClaimJob) ensuring zero duplicate dispatches.
 */
export async function runSchedulerCron(options?: {
  nowSec?: number;
  limit?: number;
}): Promise<SchedulerCronResult> {
  const db = createServerClient();
  const now = options?.nowSec ?? Math.floor(Date.now() / 1000);
  const limit = options?.limit ?? 50;

  // Query jobs due for dispatch
  const { data: dueJobs } = await db
    .from('publishing_jobs')
    .select('id, tenant_id, channel_id, scheduled_at, status')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  const jobs = (dueJobs ?? []) as Array<{
    id: string;
    tenant_id: string;
    channel_id: string;
    scheduled_at: number;
    status: string;
  }>;

  if (jobs.length === 0) {
    return { processed: 0, dispatched: [], skipped: 0 };
  }

  const { atomicClaimJob } = await import('@/land/video/publishing/publish-claim');

  const dispatched: string[] = [];
  let skipped = 0;

  for (const job of jobs) {
    // Atomic OCC CAS claim: scheduled -> uploading
    const { claimed } = await atomicClaimJob(db, job.id);
    if (!claimed) {
      skipped++;
      logger.info('[SchedulerCron] Job already claimed concurrently — skipping', {
        jobId: job.id,
      });
      continue;
    }

    // Dispatched to Inngest with alreadyClaimed=true
    await inngest.send({
      id: `publish-${job.id}-due`,
      name: 'publish.scheduled',
      data: {
        jobId: job.id,
        tenantId: job.tenant_id,
        userId: job.tenant_id,
        alreadyClaimed: true,
      },
    });

    dispatched.push(job.id);
    logger.info('[SchedulerCron] Claimed and dispatched due job', {
      jobId: job.id,
      channelId: job.channel_id,
      scheduledAt: job.scheduled_at,
    });
  }

  return { processed: jobs.length, dispatched, skipped };
}
