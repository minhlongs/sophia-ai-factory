/**
 * Publishing Scheduler
 * Creates publishing_jobs rows and dispatches Inngest events.
 * Called by POST /api/publish/schedule.
 */

import { getD1Client } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';
import { consumeQuota } from './per-channel-quota';
import { logger } from '@/lib/utils/logger-utility';
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

export interface SchedulePublishResult {
  jobIds: string[];
  quotaBlocked: Array<{ channelId: string; provider: string; retryAfter: number }>;
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
  const hashtagsJson = JSON.stringify(hashtags);

  for (const channel of validChannels) {
    // Check per-channel quota
    const quota = await consumeQuota(channel.id, channel.provider as ChannelProvider);
    if (!quota.allowed) {
      quotaBlocked.push({
        channelId: channel.id,
        provider: channel.provider,
        retryAfter: quota.retryAfterSeconds,
      });
      continue;
    }

    const jobId = randomUUID();

    await db.from('publishing_jobs').insert({
      id: jobId,
      tenant_id: tenantId,
      video_job_id: videoJobId,
      channel_id: channel.id,
      status: 'scheduled',
      caption,
      hashtags_json: hashtagsJson,
      product_link: productLink ?? null,
      scheduled_at: scheduledAt,
      started_at: null,
      finished_at: null,
      retry_count: 0,
      error: null,
      created_at: now,
    });

    jobIds.push(jobId);

    // C8: idempotency id prevents double-fire on browser retries / network glitches
    await inngest.send({
      id: `publish-${jobId}-attempt-0`,
      name: 'publish.scheduled',
      data: { jobId, tenantId, userId },
    });

    logger.info('[Scheduler] Job created', { jobId, channelId: channel.id, provider: channel.provider });
  }

  return { jobIds, quotaBlocked };
}
