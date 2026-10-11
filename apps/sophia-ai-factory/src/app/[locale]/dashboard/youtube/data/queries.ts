import { getD1 } from '@/seed/db/client';
import type { ChannelConfig } from '@/land/youtube/channel-config-types';
import { rowToConfig } from '@/land/youtube/channel-config-types';
import type {
  StrategyRow,
  ScriptRow,
  CalendarRow,
  SnapshotRow,
  RecommendationRow,
} from './types';
import {
  rowToStrategy,
  rowToScript,
  rowToCalendar,
  rowToSnapshot,
  rowToRecommendation,
} from './mappers';

export async function listChannelConfigsForUser(
  userId: string,
): Promise<readonly ChannelConfig[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_channel_configs WHERE user_id = ?1 AND is_active = 1 ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToConfig);
}

export async function listRecentCalendarEntries(
  userId: string,
  limit = 10,
): Promise<readonly CalendarRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_calendar WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToCalendar);
}

export async function listUpcomingCalendarEntries(
  userId: string,
): Promise<readonly CalendarRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_calendar
       WHERE user_id = ?1 AND status IN ('scheduled','generating','ready')
       ORDER BY scheduled_at ASC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToCalendar);
}

export async function listStrategies(
  userId: string,
  limit = 20,
): Promise<readonly StrategyRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_content_strategies WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToStrategy);
}

export async function listScripts(
  userId: string,
  limit = 20,
): Promise<readonly ScriptRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_scripts WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToScript);
}

export async function getScriptById(
  scriptId: string,
  userId: string,
): Promise<ScriptRow | null> {
  const db = await getD1();
  if (!db) return null;
  const row = await db
    .prepare(`SELECT * FROM youtube_scripts WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(scriptId, userId)
    .first<Record<string, unknown>>();
  return row ? rowToScript(row) : null;
}

export async function listSnapshots(
  userId: string,
  limit = 100,
): Promise<readonly SnapshotRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_learning_snapshots WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToSnapshot);
}

export async function listRecommendations(
  userId: string,
  limit = 50,
): Promise<readonly RecommendationRow[]> {
  const db = await getD1();
  if (!db) return [];
  const rows = await db
    .prepare(
      `SELECT * FROM youtube_learning_recommendations WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToRecommendation);
}
