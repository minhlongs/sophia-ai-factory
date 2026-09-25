/**
 * Publishing Scheduler
 * Creates publishing_jobs rows and dispatches Inngest events.
 * Called by POST /api/publish/schedule.
 *
 * Cooldown enforcement (Phase 10):
 *   Before inserting each job, checkCooldown() is called.
 *   If violated, the job is inserted with a deferred scheduled_at instead of rejecting.
 *   This ensures account safety without losing the publish request.
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { consumeQuota } from './per-channel-quota';
import { checkCooldown } from '@/forest/quota/channel-cooldown';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel, ChannelProvider } from './publisher-interface';
import { randomUUID } from 'crypto';
import type { ApacMarket } from '@/seed/types/apac-syndication';
import {
  calculateNextPeakPublishTime,
  detectMarketFromTimezone,
} from '@/tree/publishing/apac-peak-optimizer';

export interface SchedulePublishInput {
  videoJobId: string;
  tenantId: string;
  userId: string;
  channelIds: string[];
  caption: string;
  hashtags: string[];
  productLink?: string;
  scheduledAt: number; // Unix seconds
  audienceTimezone?: string;
  optimizeSchedule?: boolean;
  staggerMinutes?: number;
  market?: ApacMarket;
}

export interface DeferredChannel {
  channelId: string;
  provider: string;
  deferredUntil: number;
  reason: 'cooldown' | 'burst';
}

export interface SchedulePublishResult {
  jobIds: string[];
  quotaBlocked: Array<{ channelId: string; provider: string; retryAfter: number }>;
  /** Jobs deferred due to cooldown/burst — still scheduled, but at a later time. */
  deferred: DeferredChannel[];
}

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

  const validChannels = (channels ?? []) as unknown as PublishingChannel[];
  const validIds = new Set(validChannels.map((c) => c.id));

  const missingIds = channelIds.filter((id) => !validIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Channels not found or not owned by tenant: ${missingIds.join(', ')}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const jobIds: string[] = [];
  const quotaBlocked: SchedulePublishResult['quotaBlocked'] = [];
  const deferred: SchedulePublishResult['deferred'] = [];
  const hashtagsJson = JSON.stringify(hashtags);

  // Consistent sorting of channels to apply stagger predictably
  const sortedChannels = [...validChannels].sort((a, b) => a.id.localeCompare(b.id));

  for (let idx = 0; idx < sortedChannels.length; idx++) {
    const channel = sortedChannels[idx];

    // Check per-channel quota (daily limit)
    const quota = await consumeQuota(channel.id, channel.provider as ChannelProvider);
    if (!quota.allowed) {
      quotaBlocked.push({
        channelId: channel.id,
        provider: channel.provider,
        retryAfter: quota.retryAfterSeconds,
      });
      continue;
    }

    let effectiveScheduledAt = scheduledAt;
    if (optimizeSchedule) {
      effectiveScheduledAt = getOptimalPublishTime(
        effectiveScheduledAt,
        audienceTimezone || 'Asia/Ho_Chi_Minh',
        input.market,
      );
    }

    // Stagger consecutive channels
    effectiveScheduledAt += idx * (staggerMinutes * 60);

    // Cooldown + burst check — defer instead of reject
    const provider = channel.provider as ChannelProvider;
    const cooldown = await checkCooldown(tenantId, channel.id, provider, now);

    if (!cooldown.allowed && cooldown.deferUntil !== undefined) {
      effectiveScheduledAt = Math.max(effectiveScheduledAt, cooldown.deferUntil);
      deferred.push({
        channelId: channel.id,
        provider: channel.provider,
        deferredUntil: effectiveScheduledAt,
        reason: cooldown.reason ?? 'cooldown',
      });
      logger.info('[Scheduler] Job deferred due to cooldown', {
        channelId: channel.id,
        provider: channel.provider,
        reason: cooldown.reason,
        originalScheduledAt: scheduledAt,
        effectiveScheduledAt,
        deferSeconds: cooldown.deferSeconds,
      });
    }

    // Database anti-collision loop — cap at 48 iterations (4 hours forward max)
    const MAX_CONFLICT_ITERATIONS = 48;
    let conflictFound = true;
    let conflictIterations = 0;
    while (conflictFound) {
      const minTime = effectiveScheduledAt - 299;
      const maxTime = effectiveScheduledAt + 299;

      const { data: existingJobs } = await db
        .from('publishing_jobs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel_id', channel.id)
        .eq('status', 'scheduled')
        .gte('scheduled_at', minTime)
        .lte('scheduled_at', maxTime);

      if (existingJobs && existingJobs.length > 0) {
        conflictIterations++;
        if (conflictIterations >= MAX_CONFLICT_ITERATIONS) {
          // Accept the slot to avoid unbounded loop; log warning for operator awareness
          logger.warn('[Scheduler] Anti-collision cap reached — accepting conflicting slot', {
            channelId: channel.id,
            effectiveScheduledAt,
            iterations: conflictIterations,
          });
          conflictFound = false;
        } else {
          effectiveScheduledAt += 300; // Move forward by 5 minutes
        }
      } else {
        conflictFound = false;
      }
    }

    const jobId = randomUUID();

    await db.from('publishing_jobs').insert({
      id: jobId,
      tenant_id: tenantId,
      video_id: videoJobId,
      channel_id: channel.id,
      status: 'scheduled',
      caption,
      hashtags_json: hashtagsJson,
      product_link: productLink ?? null,
      scheduled_at: effectiveScheduledAt,
      started_at: null,
      finished_at: null,
      retry_count: 0,
      error: null,
      created_at: now,
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
      scheduledAt: effectiveScheduledAt,
      deferred: !cooldown.allowed,
    });
  }

  return { jobIds, quotaBlocked, deferred };
}

export interface SchedulerCronResult {
  processed: number;
  dispatched: string[];
  skipped: number;
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
