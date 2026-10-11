import { getD1 } from '@/seed/db/client';
import { z } from 'zod';
import {
  HelpVideoSchema,
  type HelpVideo,
  type HelpVideoCategory,
} from './types';

/** Fetch all videos ordered by order_index. Includes unpublished (for admin). */
export async function listAllHelpVideos(): Promise<HelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM help_videos ORDER BY order_index ASC`)
    .all<HelpVideo>();
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r));
}

/** Fetch published videos only (for public library page). */
export async function listPublishedHelpVideos(): Promise<HelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE published = 1 ORDER BY order_index ASC`)
    .all<HelpVideo>();
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r));
}

/** Fetch a single video by slug. Returns null if not found. */
export async function getHelpVideoBySlug(slug: string): Promise<HelpVideo | null> {
  const safe = z.string().min(1).max(100).safeParse(slug);
  if (!safe.success) return null;

  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE slug = ?1 LIMIT 1`)
    .bind(safe.data)
    .first<HelpVideo>();

  if (!row) return null;
  return HelpVideoSchema.parse(row);
}

/** Fetch a video by slug for a specific tooltip route (may be unpublished). */
export async function getHelpVideoForTooltip(slug: string): Promise<HelpVideo | null> {
  return getHelpVideoBySlug(slug);
}

/** Fetch all videos for a category. */
export async function listHelpVideosByCategory(
  category: HelpVideoCategory,
): Promise<HelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE category = ?1 ORDER BY order_index ASC`)
    .bind(category)
    .all<HelpVideo>();
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r));
}

/** Helper to fetch video by ID. */
export async function getHelpVideoById(id: string): Promise<HelpVideo | null> {
  const safe = z.string().min(1).max(100).safeParse(id);
  if (!safe.success) return null;

  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE id = ?1 LIMIT 1`)
    .bind(safe.data)
    .first<HelpVideo>();

  if (!row) return null;
  return HelpVideoSchema.parse(row);
}
