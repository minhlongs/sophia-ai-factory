/**
 * tree/help/progress-tracking/progress-service.ts
 * Mutation and state management services for help video progress.
 * Layer: tree
 */

import { getD1 } from '@/seed/db/client';

/**
 * Mark video as watched by user for the given locale.
 */
export async function markVideoWatched(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  await db
    .prepare(`
      INSERT OR IGNORE INTO help_video_progress (user_id, video_id, locale, watched_at)
      VALUES (?1, ?2, ?3, datetime('now'))
    `)
    .bind(userId, videoId, locale)
    .run();
}

/**
 * Unmark video as watched by user for the given locale.
 */
export async function unmarkVideoWatched(
  userId: string,
  videoId: string,
  locale: 'en' | 'vi' = 'en'
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  await db
    .prepare(`DELETE FROM help_video_progress WHERE user_id = ?1 AND video_id = ?2 AND locale = ?3`)
    .bind(userId, videoId, locale)
    .run();
}
