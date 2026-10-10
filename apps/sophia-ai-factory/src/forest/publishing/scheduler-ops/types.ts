/**
 * Types for Publishing Scheduler
 * @module forest/publishing/scheduler-ops/types
 */

import type { ApacMarket } from '@/seed/types/apac-syndication';

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

export interface SchedulerCronResult {
  processed: number;
  dispatched: string[];
  skipped: number;
}
