/**
 * Database operations for creating, updating, and cancelling YouTube content calendar entries.
 * @module land/youtube/calendar/content-calendar-service
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { genId } from '../channel-config-types';
import {
  rowToEntry,
  INSERT_CALENDAR_ENTRY_SQL,
  buildCalendarUpdateParts,
  type CalendarEntry,
  type CreateCalendarEntryInput,
  type CalendarEntryPatch,
} from './types';

/** Create a calendar entry. */
export async function createCalendarEntry(
  input: CreateCalendarEntryInput,
): Promise<{ success: true; entry: CalendarEntry } | { success: false; error: string }> {
  const db = await getD1();
  if (!db) return { success: false, error: 'D1 database binding not available' };
  try {
    const id = genId();
    await db
      .prepare(INSERT_CALENDAR_ENTRY_SQL)
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
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(`SELECT * FROM youtube_content_calendar WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(entryId, userId)
    .first<Record<string, unknown>>();
  return row ? rowToEntry(row) : null;
}

/** Update a calendar entry's status and linked artifact ids. */
export async function updateCalendarEntry(
  entryId: string,
  userId: string,
  patch: CalendarEntryPatch,
): Promise<{ success: true; entry: CalendarEntry } | { success: false; error: string }> {
  const db = await getD1();
  if (!db) return { success: false, error: 'D1 database binding not available' };
  try {
    const { fields, values } = buildCalendarUpdateParts(patch);
    if (fields.length === 0) return { success: false, error: 'No fields to update' };
    fields.push("updated_at = datetime('now')");
    values.push(entryId, userId);
    await db
      .prepare(
        `UPDATE youtube_content_calendar SET ${fields.join(', ')} WHERE id = ?${values.length - 1} AND user_id = ?${values.length}`,
      )
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
