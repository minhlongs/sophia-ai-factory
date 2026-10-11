import { getD1 } from '@/seed/db/client';
import {
  CreateHelpVideoInputSchema,
  UpdateHelpVideoInputSchema,
  type HelpVideo,
  type CreateHelpVideoInput,
  type UpdateHelpVideoInput,
} from './types';
import { getHelpVideoBySlug, getHelpVideoById } from './video-query-builder';

/** Create a new help video. Returns the created video. */
export async function createHelpVideo(input: CreateHelpVideoInput): Promise<HelpVideo> {
  const validated = CreateHelpVideoInputSchema.parse(input);
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const id = `hv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO help_videos (id, slug, title_en, title_vi, description_en, description_vi, r2_key, duration_sec, category, order_index, published, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      id,
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
      now,
    )
    .run();

  const created = await getHelpVideoBySlug(validated.slug);
  if (!created) throw new Error('Failed to retrieve created help video');
  return created;
}

/** Update a help video by ID. Returns the updated video or null if not found. */
export async function updateHelpVideo(id: string, input: UpdateHelpVideoInput): Promise<HelpVideo | null> {
  const validated = UpdateHelpVideoInputSchema.parse(input);
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (validated.slug !== undefined) {
    fields.push('slug = ?');
    values.push(validated.slug);
  }
  if (validated.title_en !== undefined) {
    fields.push('title_en = ?');
    values.push(validated.title_en);
  }
  if (validated.title_vi !== undefined) {
    fields.push('title_vi = ?');
    values.push(validated.title_vi);
  }
  if (validated.description_en !== undefined) {
    fields.push('description_en = ?');
    values.push(validated.description_en);
  }
  if (validated.description_vi !== undefined) {
    fields.push('description_vi = ?');
    values.push(validated.description_vi);
  }
  if (validated.r2_key !== undefined) {
    fields.push('r2_key = ?');
    values.push(validated.r2_key);
  }
  if (validated.duration_sec !== undefined) {
    fields.push('duration_sec = ?');
    values.push(validated.duration_sec);
  }
  if (validated.category !== undefined) {
    fields.push('category = ?');
    values.push(validated.category);
  }
  if (validated.order_index !== undefined) {
    fields.push('order_index = ?');
    values.push(validated.order_index);
  }
  if (validated.published !== undefined) {
    fields.push('published = ?');
    values.push(validated.published);
  }

  if (fields.length === 0) {
    return getHelpVideoById(id);
  }

  values.push(id);

  await db
    .prepare(`UPDATE help_videos SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return getHelpVideoById(id);
}

/** Delete a help video by ID. Returns true if deleted, false if not found. */
export async function deleteHelpVideo(id: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const result = await db
    .prepare(`DELETE FROM help_videos WHERE id = ?1`)
    .bind(id)
    .run();

  const meta = result as unknown as { meta?: { changes?: number } };
  return (meta.meta?.changes ?? 0) > 0;
}
