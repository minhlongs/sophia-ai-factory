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
  UpdateHelpVideoInput,
  HelpVideoSchema,
  CreateHelpVideoInputSchema,
  UpdateHelpVideoInputSchema,
} from '../types';

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
 * Updates an existing help video with dynamic fields.
 */
export async function updateHelpVideo(id: string, input: UpdateHelpVideoInput): Promise<HelpVideo> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const validated = UpdateHelpVideoInputSchema.parse(input);

  const setParts: string[] = [];
  const bindings: (string | number | null)[] = [];

  if (validated.slug !== undefined) {
    setParts.push('slug = ?');
    bindings.push(validated.slug);
  }
  if (validated.title_en !== undefined) {
    setParts.push('title_en = ?');
    bindings.push(validated.title_en);
  }
  if (validated.title_vi !== undefined) {
    setParts.push('title_vi = ?');
    bindings.push(validated.title_vi);
  }
  if (validated.description_en !== undefined) {
    setParts.push('description_en = ?');
    bindings.push(validated.description_en);
  }
  if (validated.description_vi !== undefined) {
    setParts.push('description_vi = ?');
    bindings.push(validated.description_vi);
  }
  if (validated.r2_key !== undefined) {
    setParts.push('r2_key = ?');
    bindings.push(validated.r2_key);
  }
  if (validated.duration_sec !== undefined) {
    setParts.push('duration_sec = ?');
    bindings.push(validated.duration_sec);
  }
  if (validated.category !== undefined) {
    setParts.push('category = ?');
    bindings.push(validated.category);
  }
  if (validated.order_index !== undefined) {
    setParts.push('order_index = ?');
    bindings.push(validated.order_index);
  }
  if (validated.published !== undefined) {
    setParts.push('published = ?');
    bindings.push(validated.published);
  }

  if (setParts.length === 0) {
    throw new Error('No fields to update');
  }

  bindings.push(id);

  const result = await db
    .prepare(`UPDATE help_videos SET ${setParts.join(', ')} WHERE id = ?${bindings.length}`)
    .bind(...bindings)
    .run();

  if (!result.success) {
    throw new Error(`Failed to update help video: ${result.error}`);
  }

  if (result.meta.changes === 0) {
    throw new Error('Help video not found');
  }

  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE id = ?1`)
    .bind(id)
    .first<HelpVideo>();

  if (!row) {
    throw new Error('Updated help video not found');
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
