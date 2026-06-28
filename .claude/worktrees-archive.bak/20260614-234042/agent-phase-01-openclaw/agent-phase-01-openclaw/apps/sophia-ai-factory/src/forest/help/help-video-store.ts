/**
 * forest/help/help-video-store.ts
 * D1 CRUD for the help_videos catalog table (migration 0112).
 * Layer: forest (read-only; no user mutations needed).
 */

import { getD1Raw } from '@/seed/db/client'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const HelpVideoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title_en: z.string(),
  title_vi: z.string(),
  description_en: z.string(),
  description_vi: z.string(),
  r2_key: z.string().nullable(),
  duration_sec: z.number().int().min(0),
  category: z.string(),
  order_index: z.number().int().min(0),
  published: z.union([z.literal(0), z.literal(1)]),
  created_at: z.number().int(),
})

export type HelpVideo = z.infer<typeof HelpVideoSchema>

export const HelpVideoCategorySchema = z.enum([
  'getting-started',
  'integrations',
  'setup',
  'content',
  'analytics',
  'compliance',
  'advanced',
  'support',
  'general',
])
export type HelpVideoCategory = z.infer<typeof HelpVideoCategorySchema>

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all videos ordered by order_index. Includes unpublished (for admin). */
export async function listAllHelpVideos(): Promise<HelpVideo[]> {
  const db = await getD1Raw()
  const rows = await db
    .prepare(`SELECT * FROM help_videos ORDER BY order_index ASC`)
    .all<HelpVideo>()
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r))
}

/** Fetch published videos only (for public library page). */
export async function listPublishedHelpVideos(): Promise<HelpVideo[]> {
  const db = await getD1Raw()
  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE published = 1 ORDER BY order_index ASC`)
    .all<HelpVideo>()
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r))
}

/** Fetch a single video by slug. Returns null if not found. */
export async function getHelpVideoBySlug(slug: string): Promise<HelpVideo | null> {
  const safe = z.string().min(1).max(100).safeParse(slug)
  if (!safe.success) return null

  const db = await getD1Raw()
  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE slug = ?1 LIMIT 1`)
    .bind(safe.data)
    .first<HelpVideo>()

  if (!row) return null
  return HelpVideoSchema.parse(row)
}

/** Fetch a video by slug for a specific tooltip route (may be unpublished). */
export async function getHelpVideoForTooltip(slug: string): Promise<HelpVideo | null> {
  return getHelpVideoBySlug(slug)
}

/** Fetch all videos for a category. */
export async function listHelpVideosByCategory(
  category: HelpVideoCategory,
): Promise<HelpVideo[]> {
  const db = await getD1Raw()
  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE category = ?1 ORDER BY order_index ASC`)
    .bind(category)
    .all<HelpVideo>()
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r))
}
