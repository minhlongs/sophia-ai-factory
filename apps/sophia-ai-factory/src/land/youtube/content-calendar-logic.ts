/**
 * Pure frequency-control and content-buffer logic for the YouTube pipeline.
 * No DB access — fully unit-testable. Mirrors Lumen's shouldGenerateContentToday.
 * @module land/youtube/content-calendar-logic
 */

import type { Cadence } from './channel-config-types';

export interface FrequencyCheckInput {
  readonly userId: string;
  readonly channelConfigId: string;
  readonly cadence: Cadence;
  readonly postsPerWeek: number;
  readonly bufferDays: number;
  /** Count of scheduled (not yet published) entries within the buffer horizon. */
  readonly upcomingCount: number;
  /** Count of entries generated/published in the trailing 7 days. */
  readonly postsLast7Days: number;
  /** ISO timestamp of the most recent generated/published entry, or null. */
  readonly lastPostAt: string | null;
  readonly now?: Date;
}

export interface FrequencyCheckResult {
  readonly shouldGenerate: boolean;
  readonly reason: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Minimum gap in days between posts for gap-based cadences. */
const CADENCE_GAP_DAYS: Partial<Record<Cadence, number>> = {
  'every-2-days': 2,
};

/** Weekly post cap implied by cadence when postsPerWeek is not set. */
const CADENCE_WEEKLY_CAP: Record<Cadence, number> = {
  daily: 7,
  'every-2-days': 3,
  '3-per-week': 3,
  weekly: 1,
};

/**
 * Decide whether new content should be generated today for a channel.
 *
 * Order of checks (first failing gate wins):
 * 1. Content buffer — enough scheduled content already queued → skip.
 * 2. Cadence gap — for gap-based cadences, last post too recent → skip.
 * 3. Weekly cap — posts in trailing 7 days reached the cap → skip.
 */
export function shouldGenerateContentToday(input: FrequencyCheckInput): FrequencyCheckResult {
  const now = input.now ?? new Date();

  if (input.bufferDays > 0 && input.upcomingCount >= input.bufferDays) {
    return {
      shouldGenerate: false,
      reason: `Content buffer sufficient: ${input.upcomingCount} scheduled >= ${input.bufferDays} buffer days`,
    };
  }

  const gapDays = CADENCE_GAP_DAYS[input.cadence];
  if (gapDays != null && input.lastPostAt) {
    const last = new Date(input.lastPostAt);
    if (!Number.isNaN(last.getTime())) {
      const elapsedDays = (now.getTime() - last.getTime()) / MS_PER_DAY;
      if (elapsedDays < gapDays) {
        return {
          shouldGenerate: false,
          reason: `Cadence ${input.cadence}: last post ${elapsedDays.toFixed(1)}d ago < ${gapDays}d gap`,
        };
      }
    }
  }

  const weeklyCap = Math.max(1, input.postsPerWeek || CADENCE_WEEKLY_CAP[input.cadence]);
  if (input.postsLast7Days >= weeklyCap) {
    return {
      shouldGenerate: false,
      reason: `Weekly cap reached: ${input.postsLast7Days} posts in last 7 days >= cap ${weeklyCap}`,
    };
  }

  return { shouldGenerate: true, reason: 'All frequency gates passed' };
}

/**
 * Compute the next scheduled publish time for a new entry, spaced evenly
 * across the week according to posts-per-week, starting from `now`.
 */
export function nextScheduledAt(postsPerWeek: number, now: Date = new Date()): string {
  const perWeek = Math.max(1, Math.floor(postsPerWeek));
  const gapMs = (7 * MS_PER_DAY) / perWeek;
  return new Date(now.getTime() + gapMs).toISOString();
}

/**
 * Determine whether a calendar entry date falls inside the buffer horizon.
 */
export function isWithinBufferHorizon(
  scheduledAt: string,
  bufferDays: number,
  now: Date = new Date(),
): boolean {
  const scheduled = new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return false;
  const horizonEnd = now.getTime() + bufferDays * MS_PER_DAY;
  return scheduled.getTime() >= now.getTime() && scheduled.getTime() <= horizonEnd;
}