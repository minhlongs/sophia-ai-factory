/**
 * tree/help/progress-tracking/video-progress-queries.ts
 * Query operations for video-specific progress tracking.
 * Layer: tree
 */

import { getD1 } from '@/seed/db/client';
import { HelpVideoProgressSchema } from './types';
import type { HelpVideoProgress, RecentlyWatchedRecord } from './types';

export async function getVideoProgress(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<HelpVideoProgress | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const row = await db
    .prepare(`SELECT * FROM help_video_progress WHERE user_id = ?1 AND video_id = ?2 AND locale = ?3`)
    .bind(userId, videoId, locale)
    .first<HelpVideoProgress>();

  if (!row) return null;
  return HelpVideoProgressSchema.parse(row);
}

export async function hasWatchedVideo(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<boolean> {
  const progress = await getVideoProgress(userId, videoId, locale);
  return progress !== null;
}

export async function getWatchedVideoIds(
  userId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<string[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const rows = await db
    .prepare(`SELECT video_id FROM help_video_progress WHERE user_id = ?1 AND locale = ?2`)
    .bind(userId, locale)
    .all<{ video_id: string }>();

  return (rows.results ?? []).map((r) => r.video_id);
}

export async function getRecentlyWatched(
  userId: string,
  locale: 'en' | 'vi' = 'en',
  limit: number = 5
): Promise<RecentlyWatchedRecord[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const rows = await db
    .prepare(
      `SELECT video_id, watched_at
       FROM help_video_progress
       WHERE user_id = ?1 AND locale = ?2
       ORDER BY watched_at DESC
       LIMIT ?3`
    )
    .bind(userId, locale, limit)
    .all<{ video_id: string; watched_at: number }>();

  return (rows.results ?? []).map(r => ({ video_id: r.video_id, watched_at: r.watched_at }));
}

export async function getWatchHistory(
  userId: string,
  locale?: 'en' | 'vi'
): Promise<HelpVideoProgress[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  let query = `SELECT * FROM help_video_progress WHERE user_id = ?1`;
  const bindings: (string | number)[] = [userId];

  if (locale) {
    query += ` AND locale = ?2`;
    bindings.push(locale);
  }
  query += ` ORDER BY watched_at DESC`;

  const rows = await db.prepare(query).bind(...bindings).all<HelpVideoProgress>();
  return (rows.results ?? []).map((r) => HelpVideoProgressSchema.parse(r));
}
