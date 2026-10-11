/**
 * tree/help/progress-tracking/progress-calculator.ts
 * Calculation logic for user and category progress.
 * Layer: tree
 */

import { getD1 } from '@/seed/db/client';
import { UserProgressSummarySchema } from './types';
import type { UserProgressSummary, HelpVideoCategory, CategoryProgressResult } from './types';

export async function getUserProgress(
  userId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<UserProgressSummary> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const totalResult = await db
    .prepare(`SELECT COUNT(*) as count FROM help_videos WHERE published = 1`)
    .first<{ count: number }>();

  const totalVideos = totalResult?.count ?? 0;

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

export async function getCategoryProgress(
  userId: string,
  category: HelpVideoCategory,
  locale: 'en' | 'vi' = 'en'
): Promise<CategoryProgressResult> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

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

export async function getAllCategoriesProgress(
  userId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<CategoryProgressResult[]> {
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
