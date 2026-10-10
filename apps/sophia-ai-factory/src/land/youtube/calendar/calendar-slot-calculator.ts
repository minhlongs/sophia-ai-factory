/**
 * Query and frequency evaluation helpers for content calendar slots.
 * @module land/youtube/calendar/calendar-slot-calculator
 */

import { getD1 } from '@/seed/db/client';
import {
  shouldGenerateContentToday,
  type FrequencyCheckInput,
  type FrequencyCheckResult,
} from '../content-calendar-logic';
import { rowToEntry, type CalendarEntry } from './types';

/** List upcoming (scheduled/ready) entries for a channel config. */
export async function listUpcomingEntries(
  userId: string,
  channelConfigId: string,
  now: Date = new Date(),
): Promise<readonly CalendarEntry[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_calendar
       WHERE user_id = ?1 AND channel_config_id = ?2
         AND status IN ('scheduled','generating','ready')
         AND scheduled_at >= ?3
       ORDER BY scheduled_at ASC`,
    )
    .bind(userId, channelConfigId, now.toISOString())
    .all<Record<string, unknown>>();
  return rows.results.map(rowToEntry);
}

/** Count entries generated/published in the trailing 7 days for a channel. */
export async function countPostsLast7Days(
  userId: string,
  channelConfigId: string,
  now: Date = new Date(),
): Promise<number> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM youtube_content_calendar
       WHERE user_id = ?1 AND channel_config_id = ?2
         AND status IN ('ready','published')
         AND created_at >= ?3`,
    )
    .bind(userId, channelConfigId, since)
    .first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

/** Fetch the most recent generated/published entry timestamp for a channel. */
export async function getLastPostAt(
  userId: string,
  channelConfigId: string,
): Promise<string | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(
      `SELECT created_at FROM youtube_content_calendar
       WHERE user_id = ?1 AND channel_config_id = ?2
         AND status IN ('ready','published')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(userId, channelConfigId)
    .first<{ created_at: string }>();
  return row?.created_at ?? null;
}

/**
 * Evaluate whether new content should be generated for a channel, combining
 * buffer + cadence + weekly-cap gates against live calendar data.
 */
export async function evaluateFrequency(
  input: Omit<FrequencyCheckInput, 'upcomingCount' | 'postsLast7Days' | 'lastPostAt'>,
): Promise<FrequencyCheckResult> {
  const upcoming = await listUpcomingEntries(input.userId, input.channelConfigId, input.now);
  const postsLast7Days = await countPostsLast7Days(input.userId, input.channelConfigId, input.now);
  const lastPostAt = await getLastPostAt(input.userId, input.channelConfigId);
  return shouldGenerateContentToday({
    userId: input.userId,
    channelConfigId: input.channelConfigId,
    cadence: input.cadence,
    postsPerWeek: input.postsPerWeek,
    bufferDays: input.bufferDays,
    upcomingCount: upcoming.length,
    postsLast7Days,
    lastPostAt,
    now: input.now,
  });
}
