/**
 * Help Video Admin Mutations (Create, Update, Delete)
 *
 * Layer: tree/help/mutation-ops
 *
 * @module tree/help/mutation-ops/video-mutations
 */

import { getD1 } from '@/seed/db/client';
import {
  HelpVideo,
  CreateHelpVideoInput,
  HelpVideoSchema,
  CreateHelpVideoInputSchema,
} from '../types';
import { updateHelpVideo } from './video-update-mutation';

export { updateHelpVideo };

/**
 * Inserts a new help video into the database.
 */
export async function createHelpVideo(input: CreateHelpVideoInput): Promise<HelpVideo> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const validated = CreateHelpVideoInputSchema.parse(input);
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .prepare(
      `INSERT INTO help_videos (
        id, slug, title_en, title_vi, description_en, description_vi,
        r2_key, duration_sec, category, order_index, published, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      validated.id,
      validated.slug,
      validated.title_en,
      validated.title_vi,
      validated.description_en,
      validated.description_vi,
      validated.r2_key ?? null,
      validated.duration_sec,
      validated.category,
      validated.order_index,
      validated.published,
      now
    )
    .run();

  if (!result.success) {
    throw new Error(`Failed to create help video: ${result.error}`);
  }

  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE id = ?1`)
    .bind(validated.id)
    .first<HelpVideo>();

  if (!row) {
    throw new Error('Created help video not found');
  }

  return HelpVideoSchema.parse(row);
}

/**
 * Deletes a help video and its associated progress records.
 */
export async function deleteHelpVideo(id: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  await db
    .prepare(`DELETE FROM help_video_progress WHERE video_id = ?1`)
    .bind(id)
    .run();

  const result = await db
    .prepare(`DELETE FROM help_videos WHERE id = ?1`)
    .bind(id)
    .run();

  if (!result.success) {
    throw new Error(`Failed to delete help video: ${result.error}`);
  }

  if (result.meta.changes === 0) {
    throw new Error('Help video not found');
  }
}
