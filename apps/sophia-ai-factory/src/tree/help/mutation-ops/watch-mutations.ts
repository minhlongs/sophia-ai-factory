/**
 * Help Video Watch Progress Tracking Mutations
 *
 * Layer: tree/help/mutation-ops
 *
 * @module tree/help/mutation-ops/watch-mutations
 */

import { getD1 } from '@/seed/db/client';
import {
  MarkWatchedInput,
  UnmarkWatchedInput,
  HelpVideoProgress,
  HelpVideoProgressSchema,
  MarkWatchedInputSchema,
  UnmarkWatchedInputSchema,
} from '../types';

/**
 * Mark a video as watched (per locale).
 */
export async function markWatched(input: MarkWatchedInput): Promise<HelpVideoProgress> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const validated = MarkWatchedInputSchema.parse(input);
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `INSERT OR REPLACE INTO help_video_progress (user_id, video_id, locale, watched_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(validated.user_id, validated.video_id, validated.locale, now)
    .run();

  if (!result.success) {
    throw new Error(`Failed to mark video as watched: ${result.error}`);
  }

  const row = await db
    .prepare(`SELECT * FROM help_video_progress WHERE user_id = ?1 AND video_id = ?2 AND locale = ?3`)
    .bind(validated.user_id, validated.video_id, validated.locale)
    .first<HelpVideoProgress>();

  if (!row) {
    throw new Error('Progress record not found after insert');
  }

  return HelpVideoProgressSchema.parse(row);
}

/**
 * Unmark a video as watched (per locale).
 */
export async function unmarkWatched(input: UnmarkWatchedInput): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const validated = UnmarkWatchedInputSchema.parse(input);

  const result = await db
    .prepare(`DELETE FROM help_video_progress WHERE user_id = ?1 AND video_id = ?2 AND locale = ?3`)
    .bind(validated.user_id, validated.video_id, validated.locale)
    .run();

  if (!result.success) {
    throw new Error(`Failed to unmark video as watched: ${result.error}`);
  }
}
