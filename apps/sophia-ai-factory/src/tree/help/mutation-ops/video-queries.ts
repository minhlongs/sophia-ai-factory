/**
 * Help Video Queries & Localization
 *
 * Layer: tree/help/mutation-ops
 *
 * @module tree/help/mutation-ops/video-queries
 */

import { getD1 } from '@/seed/db/client';
import {
  HelpVideo,
  HelpVideoCategory,
  LocalizedHelpVideo,
  HelpVideoSchema,
} from '../types';
import { resolveLocalized } from './types';

/**
 * Retrieves a localized help video by its unique ID.
 */
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

/**
 * Retrieves a localized help video by its slug.
 */
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

/**
 * Lists help videos filtered by category, ordered by order_index.
 */
export async function listHelpVideos(
  category?: HelpVideoCategory,
  locale: 'en' | 'vi' = 'en'
): Promise<LocalizedHelpVideo[]> {
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

/**
 * Lists all published help videos ordered by order_index.
 */
export async function listPublishedHelpVideos(locale: 'en' | 'vi' = 'en'): Promise<LocalizedHelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE published = 1 ORDER BY order_index ASC`)
    .all<HelpVideo>();

  return (rows.results ?? []).map((r) => resolveLocalized(HelpVideoSchema.parse(r), locale));
}
