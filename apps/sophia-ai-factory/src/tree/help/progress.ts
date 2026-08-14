/**
 * tree/help/progress.ts
 * User progress tracking for help videos
 * Layer: tree (domain-specific reusable logic)
 */

import { getD1 } from '@/seed/db/client';
import type {
  HelpVideoProgress,
  UserProgressSummary,
  HelpVideoCategory,
} from './types';
import {
  HelpVideoProgressSchema,
  UserProgressSummarySchema,
} from './types';

// ---------------------------------------------------------------------------
// Get user progress for a specific video and locale
// ---------------------------------------------------------------------------

export async function getVideoProgress(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<HelpVideoProgress | null> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const row = await db
    .prepare(`SELECT * FROM help_video_progress WHERE user_id = ?1 AND video_id = ?2 AND locale = ?3`)
    .bind(userId, videoId, locale)
    .first<HelpVideoProgress>();

  if (!row) return null;

  return HelpVideoProgressSchema.parse(row);
}

// ---------------------------------------------------------------------------
// Check if user has watched a video (boolean)
// ---------------------------------------------------------------------------

export async function hasWatchedVideo(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<boolean> {
  const progress = await getVideoProgress(userId, videoId, locale);
  return progress !== null;
}

// ---------------------------------------------------------------------------
// Get all watched video IDs for a user and locale
// ---------------------------------------------------------------------------

export async function getWatchedVideoIds(
  userId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<string[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const rows = await db
    .prepare(`SELECT video_id FROM help_video_progress WHERE user_id = ?1 AND locale = ?2`)
    .bind(userId, locale)
    .all<{ video_id: string }>();

  return (rows.results ?? []).map((r) => r.video_id);
}

// ---------------------------------------------------------------------------
// Mark video as watched
// ---------------------------------------------------------------------------

export async function markVideoWatched(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  await db
    .prepare(`
      INSERT OR IGNORE INTO help_video_progress (user_id, video_id, locale, watched_at)
      VALUES (?1, ?2, ?3, datetime('now'))
    `)
    .bind(userId, videoId, locale)
    .run();
}

// ---------------------------------------------------------------------------
// Unmark video as watched
// ---------------------------------------------------------------------------

export async function unmarkVideoWatched(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<void> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  await db
    .prepare(`DELETE FROM help_video_progress WHERE user_id = ?1 AND video_id = ?2 AND locale = ?3`)
    .bind(userId, videoId, locale)
    .run();
}

// ---------------------------------------------------------------------------
// Get user progress summary for a locale
// ---------------------------------------------------------------------------

export async function getUserProgress(
  userId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<UserProgressSummary> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  // Get total published videos
  const totalResult = await db
    .prepare(`SELECT COUNT(*) as count FROM help_videos WHERE published = 1`)
    .first<{ count: number }>();

  const totalVideos = totalResult?.count ?? 0;

  // Get watched count for this user and locale
  const watchedResult = await db
    .prepare(`SELECT COUNT(*) as count FROM help_video_progress WHERE user_id = ?1 AND locale = ?2`)
    .bind(userId, locale)
    .first<{ count: number }>();

  const watchedVideos = watchedResult?.count ?? 0;

  const completionPercentage = totalVideos > 0
    ? Math.round((watchedVideos / totalVideos) * 100)
    : 0;

  return UserProgressSummarySchema.parse({
    user_id: userId,
    locale,
    total_videos: totalVideos,
    watched_videos: watchedVideos,
    completion_percentage: completionPercentage,
  });
}

// ---------------------------------------------------------------------------
// Get progress for all videos in a category
// ---------------------------------------------------------------------------

export async function getCategoryProgress(
  userId: string,
  category: HelpVideoCategory,
  locale: 'en' | 'vi' = 'en'
): Promise<{
  category: HelpVideoCategory;
  total: number;
  watched: number;
  completion_percentage: number;
}> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  // Get total published videos in category
  const totalResult = await db
    .prepare(`SELECT COUNT(*) as count FROM help_videos WHERE category = ?1 AND published = 1`)
    .bind(category)
    .first<{ count: number }>();

  const total = totalResult?.count ?? 0;

  if (total === 0) {
    return {
      category,
      total: 0,
      watched: 0,
      completion_percentage: 0,
    };
  }

  // Get watched count for this user in this category
  const watchedResult = await db
    .prepare(
      `SELECT COUNT(*) as count
       FROM help_video_progress hp
       JOIN help_videos hv ON hp.video_id = hv.id
       WHERE hp.user_id = ?1 AND hp.locale = ?2 AND hv.category = ?3 AND hv.published = 1`
    )
    .bind(userId, locale, category)
    .first<{ count: number }>();

  const watched = watchedResult?.count ?? 0;

  return {
    category,
    total,
    watched,
    completion_percentage: Math.round((watched / total) * 100),
  };
}

// ---------------------------------------------------------------------------
// Get progress for all categories (dashboard overview)
// ---------------------------------------------------------------------------

export async function getAllCategoriesProgress(
  userId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<Array<{
  category: HelpVideoCategory;
  total: number;
  watched: number;
  completion_percentage: number;
}>> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  const categories: HelpVideoCategory[] = [
    'getting-started',
    'setup',
    'integrations',
    'content',
    'analytics',
    'compliance',
    'advanced',
    'support',
  ];

  const results = await Promise.all(
    categories.map((cat) => getCategoryProgress(userId, cat, locale))
  );

  return results.filter((r) => r.total > 0);
}

// ---------------------------------------------------------------------------
// Get recently watched videos
// ---------------------------------------------------------------------------

export async function getRecentlyWatched(
  userId: string,
  locale: 'en' | 'vi' = 'en',
  limit: number = 5
): Promise<Array<{
  video_id: string;
  watched_at: number;
}>> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

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

  return rows.results ?? [];
}

// ---------------------------------------------------------------------------
// Get watch history (all progress records for user)
// ---------------------------------------------------------------------------

export async function getWatchHistory(
  userId: string,
  locale?: 'en' | 'vi'
): Promise<HelpVideoProgress[]> {
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

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