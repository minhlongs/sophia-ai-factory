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
  audienceTimezone?: string;
  optimizeSchedule?: boolean;
  staggerMinutes?: number;
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

function getAbsoluteTimestamp(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): number {
  const utcEstimate = Date.UTC(year, month - 1, day, hour, minute);
  let date = new Date(utcEstimate);
  for (let iter = 0; iter < 3; iter++) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const p: { [key: string]: string } = {};
    formatter.formatToParts(date).forEach((part) => {
      p[part.type] = part.value;
    });

    const dateYear = parseInt(p.year, 10);
    const dateMonth = parseInt(p.month, 10);
    const dateDay = parseInt(p.day, 10);
    const dateHour = parseInt(p.hour, 10);
    const dateMinute = parseInt(p.minute, 10);

    const diffMs =
      Date.UTC(year, month - 1, day, hour, minute) -
      Date.UTC(dateYear, dateMonth - 1, dateDay, dateHour, dateMinute);
    if (diffMs === 0) break;
    date = new Date(date.getTime() + diffMs);
  }
  return Math.floor(date.getTime() / 1000);
}

export function getOptimalPublishTime(scheduledAtSec: number, tz: string): number {
  const date = new Date(scheduledAtSec * 1000);
  const parts: { [key: string]: string } = {};
  let targetTz = tz;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    formatter.formatToParts(date).forEach((p) => {
      parts[p.type] = p.value;
    });
  } catch {
    targetTz = 'UTC';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    formatter.formatToParts(date).forEach((p) => {
      parts[p.type] = p.value;
    });
  }

  const year = parseInt(parts.year, 10);
  const month = parseInt(parts.month, 10);
  const day = parseInt(parts.day, 10);
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);

  const currentMinutes = hour * 60 + minute;
  const PEAK_SLOTS = [
    { hour: 8, minute: 0 },
    { hour: 12, minute: 30 },
    { hour: 18, minute: 30 },
    { hour: 21, minute: 0 },
  ];

  let selectedSlot = PEAK_SLOTS[0];
  let isNextDay = true;

  for (const slot of PEAK_SLOTS) {
    const slotMinutes = slot.hour * 60 + slot.minute;
    if (slotMinutes >= currentMinutes) {
      selectedSlot = slot;
      isNextDay = false;
      break;
    }
  }

  if (isNextDay) {
    const nextDayDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const partsNext: { [key: string]: string } = {};
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    formatter.formatToParts(nextDayDate).forEach((p) => {
      partsNext[p.type] = p.value;
    });

    const nYear = parseInt(partsNext.year, 10);
    const nMonth = parseInt(partsNext.month, 10);
    const nDay = parseInt(partsNext.day, 10);

    return getAbsoluteTimestamp(nYear, nMonth, nDay, selectedSlot.hour, selectedSlot.minute, targetTz);
  }

  return getAbsoluteTimestamp(year, month, day, selectedSlot.hour, selectedSlot.minute, targetTz);
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
      effectiveScheduledAt = getOptimalPublishTime(effectiveScheduledAt, audienceTimezone || 'UTC');
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
