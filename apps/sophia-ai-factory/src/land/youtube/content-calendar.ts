/**
 * YouTube content calendar CRUD (D1).
 * Scheduled content slots, buffer management, frequency control.
 * @module land/youtube/content-calendar
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { genId } from './channel-config-types';
import {
  shouldGenerateContentToday,
  type FrequencyCheckInput,
  type FrequencyCheckResult,
} from './content-calendar-logic';

export type CalendarStatus =
  | 'scheduled'
  | 'generating'
  | 'ready'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface CalendarEntry {
  readonly id: string;
  readonly userId: string;
  readonly channelConfigId: string | null;
  readonly title: string;
  readonly topic: string | null;
  readonly contentType: string | null;
  readonly status: CalendarStatus;
  readonly scheduledAt: string;
  readonly strategyId: string | null;
  readonly scriptId: string | null;
  readonly seoId: string | null;
  readonly productionId: string | null;
  readonly publishedVideoId: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCalendarEntryInput {
  readonly userId: string;
  readonly channelConfigId?: string;
  readonly title: string;
  readonly topic?: string;
  readonly contentType?: string;
  readonly status?: CalendarStatus;
  readonly scheduledAt: string;
  readonly strategyId?: string;
  readonly scriptId?: string;
  readonly seoId?: string;
  readonly productionId?: string;
  readonly notes?: string;
}

function rowToEntry(row: Record<string, unknown>): CalendarEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    channelConfigId: row.channel_config_id == null ? null : String(row.channel_config_id),
    title: String(row.title),
    topic: row.topic == null ? null : String(row.topic),
    contentType: row.content_type == null ? null : String(row.content_type),
    status: String(row.status) as CalendarStatus,
    scheduledAt: String(row.scheduled_at),
    strategyId: row.strategy_id == null ? null : String(row.strategy_id),
    scriptId: row.script_id == null ? null : String(row.script_id),
    seoId: row.seo_id == null ? null : String(row.seo_id),
    productionId: row.production_id == null ? null : String(row.production_id),
    publishedVideoId: row.published_video_id == null ? null : String(row.published_video_id),
    notes: row.notes == null ? null : String(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Create a calendar entry. */
export async function createCalendarEntry(
  input: CreateCalendarEntryInput,
): Promise<{ success: true; entry: CalendarEntry } | { success: false; error: string }> {
  const _db = await getD1();
  if (!_db) return { success: false, error: 'D1 database binding not available' };
  const db = _db;
  try {
    const id = genId();
    await db
      .prepare(
        `INSERT INTO youtube_content_calendar
         (id, user_id, channel_config_id, title, topic, content_type, status, scheduled_at,
          strategy_id, script_id, seo_id, production_id, notes)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
      )
      .bind(
        id,
        input.userId,
        input.channelConfigId ?? null,
        input.title,
        input.topic ?? null,
        input.contentType ?? null,
        input.status ?? 'scheduled',
        input.scheduledAt,
        input.strategyId ?? null,
        input.scriptId ?? null,
        input.seoId ?? null,
        input.productionId ?? null,
        input.notes ?? null,
      )
      .run();
    const row = await db
      .prepare(`SELECT * FROM youtube_content_calendar WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) return { success: false, error: 'Failed to read back created entry' };
    return { success: true, entry: rowToEntry(row) };
  } catch (err) {
    logger.error('createCalendarEntry failed', toError(err), { userId: input.userId });
    return { success: false, error: toError(err).message };
  }
}

/** Fetch a calendar entry by id (ownership-checked). */
export async function getCalendarEntry(
  entryId: string,
  userId: string,
): Promise<CalendarEntry | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM youtube_content_calendar WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(entryId, userId)
    .first<Record<string, unknown>>();
  return row ? rowToEntry(row) : null;
}

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

/** Update a calendar entry's status and linked artifact ids. */
export async function updateCalendarEntry(
  entryId: string,
  userId: string,
  patch: Partial<Pick<CalendarEntry, 'status' | 'strategyId' | 'scriptId' | 'seoId' | 'productionId' | 'publishedVideoId' | 'notes' | 'scheduledAt'>>,
): Promise<{ success: true; entry: CalendarEntry } | { success: false; error: string }> {
  const _db = await getD1();
  if (!_db) return { success: false, error: 'D1 database binding not available' };
  const db = _db;
  try {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.status !== undefined) {
      fields.push('status = ?');
      values.push(patch.status);
    }
    if (patch.strategyId !== undefined) {
      fields.push('strategy_id = ?');
      values.push(patch.strategyId);
    }
    if (patch.scriptId !== undefined) {
      fields.push('script_id = ?');
      values.push(patch.scriptId);
    }
    if (patch.seoId !== undefined) {
      fields.push('seo_id = ?');
      values.push(patch.seoId);
    }
    if (patch.productionId !== undefined) {
      fields.push('production_id = ?');
      values.push(patch.productionId);
    }
    if (patch.publishedVideoId !== undefined) {
      fields.push('published_video_id = ?');
      values.push(patch.publishedVideoId);
    }
    if (patch.notes !== undefined) {
      fields.push('notes = ?');
      values.push(patch.notes);
    }
    if (patch.scheduledAt !== undefined) {
      fields.push('scheduled_at = ?');
      values.push(patch.scheduledAt);
    }
    if (fields.length === 0) return { success: false, error: 'No fields to update' };
    fields.push('updated_at = datetime(\'now\')');
    values.push(entryId, userId);
    await db
      .prepare(`UPDATE youtube_content_calendar SET ${fields.join(', ')} WHERE id = ?${values.length - 1} AND user_id = ?${values.length}`)
      .bind(...values)
      .run();
    const row = await db
      .prepare(`SELECT * FROM youtube_content_calendar WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
      .bind(entryId, userId)
      .first<Record<string, unknown>>();
    if (!row) return { success: false, error: 'Calendar entry not found or access denied' };
    return { success: true, entry: rowToEntry(row) };
  } catch (err) {
    logger.error('updateCalendarEntry failed', toError(err), { entryId, userId });
    return { success: false, error: toError(err).message };
  }
}

/** Cancel a calendar entry. */
export async function cancelCalendarEntry(
  entryId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  return updateCalendarEntry(entryId, userId, { status: 'cancelled' }).then((res) =>
    res.success ? { success: true } : { success: false, error: res.error },
  );
}