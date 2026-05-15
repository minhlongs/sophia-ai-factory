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

import { getD1Client } from '@/seed/db/client';
import { inngest } from '@/forest/inngest/client';
import { consumeQuota } from './per-channel-quota';
import { checkCooldown } from '@/forest/quota/channel-cooldown';
import { logger } from '@/seed/utils/logger-utility';
import type { PublishingChannel, ChannelProvider } from './publisher-interface';
import { randomUUID } from 'crypto';

export interface SchedulePublishInput {
  videoJobId: string;
  tenantId: string;
  userId: string;
  channelIds: string[];
  caption: string;
  hashtags: string[];
  productLink?: string;
  scheduledAt: number; // Unix seconds
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
 * Validate tenant owns the requested channels, check quota, insert jobs.
 */
export async function schedulePublish(input: SchedulePublishInput): Promise<SchedulePublishResult> {
  const db = await getD1Client();
  const { videoJobId, tenantId, userId, channelIds, caption, hashtags, productLink, scheduledAt } = input;

  // Fetch all requested channels — validate tenant ownership
  const { data: channels } = await db
    .from('publishing_channels')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .in('id', channelIds);

  const validChannels = (channels ?? []) as unknown as PublishingChannel[];
  const validIds = new Set(validChannels.map(c => c.id));

  const missingIds = channelIds.filter(id => !validIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`Channels not found or not owned by tenant: ${missingIds.join(', ')}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const jobIds: string[] = [];
  const quotaBlocked: SchedulePublishResult['quotaBlocked'] = [];
  const deferred: SchedulePublishResult['deferred'] = [];
  const hashtagsJson = JSON.stringify(hashtags);

  for (const channel of validChannels) {
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

    // Cooldown + burst check — defer instead of reject
    const provider = channel.provider as ChannelProvider;
    const cooldown = await checkCooldown(tenantId, channel.id, provider, now);

    // Effective scheduled time: honour requested scheduledAt, but push out if cooldown violated
    let effectiveScheduledAt = scheduledAt;
    if (!cooldown.allowed && cooldown.deferUntil !== undefined) {
      // Defer: use max(requested, deferUntil)
      effectiveScheduledAt = Math.max(scheduledAt, cooldown.deferUntil);
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
