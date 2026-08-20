/**
 * tree/help/mutations.ts
 * Admin CRUD mutations for help videos
 * Layer: tree (domain-specific reusable logic)
 */

import { getD1 } from '@/seed/db/client';
import {
  HelpVideo,
  HelpVideoCategory,
  LocalizedHelpVideo,
  CreateHelpVideoInput,
  UpdateHelpVideoInput,
  MarkWatchedInput,
  UnmarkWatchedInput,
  HelpVideoProgress,
  HelpVideoSchema,
  HelpVideoProgressSchema,
  CreateHelpVideoInputSchema,
  UpdateHelpVideoInputSchema,
  MarkWatchedInputSchema,
  UnmarkWatchedInputSchema,
} from './types';

// ---------------------------------------------------------------------------
// Helper: Resolve localized fields
// ---------------------------------------------------------------------------

function resolveLocalized(video: HelpVideo, locale: 'en' | 'vi'): LocalizedHelpVideo {
  return {
    ...video,
    title: locale === 'en' ? video.title_en : video.title_vi,
    description: locale === 'en' ? video.description_en : video.description_vi,
    locale,
  };
}

// ---------------------------------------------------------------------------
// Create Help Video
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Update Help Video
// ---------------------------------------------------------------------------

export async function updateHelpVideo(id: string, input: UpdateHelpVideoInput): Promise<HelpVideo> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const validated = UpdateHelpVideoInputSchema.parse(input);

  // Build dynamic SET clause
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

// ---------------------------------------------------------------------------
// Delete Help Video
// ---------------------------------------------------------------------------

export async function deleteHelpVideo(id: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  // First delete progress records for this video
  await db
    .prepare(`DELETE FROM help_video_progress WHERE video_id = ?1`)
    .bind(id)
    .run();

  // Then delete the video
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

// ---------------------------------------------------------------------------
// Mark Video as Watched (per locale)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Unmark Video as Watched (per locale)
// ---------------------------------------------------------------------------

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
  // No error if not found - idempotent
}

// ---------------------------------------------------------------------------
// Helpers: Get localized video
// ---------------------------------------------------------------------------

export async function getHelpVideoById(id: string, locale: 'en' | 'vi'): Promise<LocalizedHelpVideo | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE id = ?1`)
    .bind(id)
    .first<HelpVideo>();

  if (!row) return null;

  const validated = HelpVideoSchema.parse(row);
  return resolveLocalized(validated, locale);
}

export async function getHelpVideoBySlug(slug: string, locale: 'en' | 'vi'): Promise<LocalizedHelpVideo | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE slug = ?1`)
    .bind(slug)
    .first<HelpVideo>();

  if (!row) return null;

  const validated = HelpVideoSchema.parse(row);
  return resolveLocalized(validated, locale);
}

export async function listHelpVideos(category?: HelpVideoCategory, locale: 'en' | 'vi' = 'en'): Promise<LocalizedHelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  let query = `SELECT * FROM help_videos`;
  const bindings: (string | number)[] = [];

  if (category) {
    query += ` WHERE category = ?1`;
    bindings.push(category);
  }

  query += ` ORDER BY order_index ASC`;

  const rows = await db.prepare(query).bind(...bindings).all<HelpVideo>();

  return (rows.results ?? []).map((r) => resolveLocalized(HelpVideoSchema.parse(r), locale));
}

export async function listPublishedHelpVideos(locale: 'en' | 'vi' = 'en'): Promise<LocalizedHelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE published = 1 ORDER BY order_index ASC`)
    .all<HelpVideo>();

  return (rows.results ?? []).map((r) => resolveLocalized(HelpVideoSchema.parse(r), locale));
}