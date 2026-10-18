/**
 * Types and interfaces for YouTube content calendar management.
 * @module land/youtube/calendar/types
 */

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

export function rowToEntry(row: Record<string, unknown>): CalendarEntry {
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

export type CalendarEntryPatch = Partial<
  Pick<
    CalendarEntry,
    | 'status'
    | 'strategyId'
    | 'scriptId'
    | 'seoId'
    | 'productionId'
    | 'publishedVideoId'
    | 'notes'
    | 'scheduledAt'
  >
>;

export const INSERT_CALENDAR_ENTRY_SQL = `INSERT INTO youtube_content_calendar
  (id, user_id, channel_config_id, title, topic, content_type, status, scheduled_at,
   strategy_id, script_id, seo_id, production_id, notes)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`;

export function buildCalendarUpdateParts(patch: CalendarEntryPatch): {
  fields: string[];
  values: unknown[];
} {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Array<[keyof CalendarEntryPatch, string]> = [
    ['status', 'status = ?'],
    ['strategyId', 'strategy_id = ?'],
    ['scriptId', 'script_id = ?'],
    ['seoId', 'seo_id = ?'],
    ['productionId', 'production_id = ?'],
    ['publishedVideoId', 'published_video_id = ?'],
    ['notes', 'notes = ?'],
    ['scheduledAt', 'scheduled_at = ?'],
  ];
  for (const [key, clause] of map) {
    if (patch[key] !== undefined) {
      fields.push(clause);
      values.push(patch[key]);
    }
  }
  return { fields, values };
}
