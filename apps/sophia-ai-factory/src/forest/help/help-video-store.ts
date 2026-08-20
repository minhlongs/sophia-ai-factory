/**
 * forest/help/help-video-store.ts
 * D1 CRUD for the help_videos catalog table (migration 0112).
 * Layer: forest (read-only; no user mutations needed).
 */

import { getD1 } from '@/seed/db/client'
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

export { MarkWatchedInputSchema, UnmarkWatchedInputSchema } from '@/tree/help/types'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all videos ordered by order_index. Includes unpublished (for admin). */
export async function listAllHelpVideos(): Promise<HelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM help_videos ORDER BY order_index ASC`)
    .all<HelpVideo>()
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r))
}

/** Fetch published videos only (for public library page). */
export async function listPublishedHelpVideos(): Promise<HelpVideo[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE published = 1 ORDER BY order_index ASC`)
    .all<HelpVideo>()
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r))
}

/** Fetch a single video by slug. Returns null if not found. */
export async function getHelpVideoBySlug(slug: string): Promise<HelpVideo | null> {
  const safe = z.string().min(1).max(100).safeParse(slug)
  if (!safe.success) return null

  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
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
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM help_videos WHERE category = ?1 ORDER BY order_index ASC`)
    .bind(category)
    .all<HelpVideo>()
  return (rows.results ?? []).map((r) => HelpVideoSchema.parse(r))
}

// ---------------------------------------------------------------------------
// Admin Mutations (for admin API routes)
// ---------------------------------------------------------------------------

/** Input schema for creating a help video. */
export const CreateHelpVideoInputSchema = z.object({
  slug: z.string().min(1).max(100),
  title_en: z.string().min(1).max(200),
  title_vi: z.string().min(1).max(200),
  description_en: z.string().min(1).max(1000),
  description_vi: z.string().min(1).max(1000),
  r2_key: z.string().max(200).nullable().optional(),
  duration_sec: z.number().int().min(0).default(0),
  category: HelpVideoCategorySchema.default('general'),
  order_index: z.number().int().min(0).default(0),
  published: z.union([z.literal(0), z.literal(1)]).default(0),
})

export type CreateHelpVideoInput = z.infer<typeof CreateHelpVideoInputSchema>

/** Input schema for updating a help video. */
export const UpdateHelpVideoInputSchema = z.object({
  slug: z.string().min(1).max(100).optional(),
  title_en: z.string().min(1).max(200).optional(),
  title_vi: z.string().min(1).max(200).optional(),
  description_en: z.string().min(1).max(1000).optional(),
  description_vi: z.string().min(1).max(1000).optional(),
  r2_key: z.string().max(200).nullable().optional(),
  duration_sec: z.number().int().min(0).optional(),
  category: HelpVideoCategorySchema.optional(),
  order_index: z.number().int().min(0).optional(),
  published: z.union([z.literal(0), z.literal(1)]).optional(),
})

export type UpdateHelpVideoInput = z.infer<typeof UpdateHelpVideoInputSchema>

/** Create a new help video. Returns the created video. */
export async function createHelpVideo(input: CreateHelpVideoInput): Promise<HelpVideo> {
  const validated = CreateHelpVideoInputSchema.parse(input)
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const id = `hv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Math.floor(Date.now() / 1000)

  await db
    .prepare(
      `INSERT INTO help_videos (id, slug, title_en, title_vi, description_en, description_vi, r2_key, duration_sec, category, order_index, published, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
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
    .run()

  const created = await getHelpVideoBySlug(validated.slug)
  if (!created) throw new Error('Failed to retrieve created help video')
  return created
}

/** Update a help video by ID. Returns the updated video or null if not found. */
export async function updateHelpVideo(id: string, input: UpdateHelpVideoInput): Promise<HelpVideo | null> {
  const validated = UpdateHelpVideoInputSchema.parse(input)
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  // Build dynamic update query
  const fields: string[] = []
  const values: (string | number | null)[] = []

  if (validated.slug !== undefined) {
    fields.push('slug = ?')
    values.push(validated.slug)
  }
  if (validated.title_en !== undefined) {
    fields.push('title_en = ?')
    values.push(validated.title_en)
  }
  if (validated.title_vi !== undefined) {
    fields.push('title_vi = ?')
    values.push(validated.title_vi)
  }
  if (validated.description_en !== undefined) {
    fields.push('description_en = ?')
    values.push(validated.description_en)
  }
  if (validated.description_vi !== undefined) {
    fields.push('description_vi = ?')
    values.push(validated.description_vi)
  }
  if (validated.r2_key !== undefined) {
    fields.push('r2_key = ?')
    values.push(validated.r2_key)
  }
  if (validated.duration_sec !== undefined) {
    fields.push('duration_sec = ?')
    values.push(validated.duration_sec)
  }
  if (validated.category !== undefined) {
    fields.push('category = ?')
    values.push(validated.category)
  }
  if (validated.order_index !== undefined) {
    fields.push('order_index = ?')
    values.push(validated.order_index)
  }
  if (validated.published !== undefined) {
    fields.push('published = ?')
    values.push(validated.published)
  }

  if (fields.length === 0) {
    return getHelpVideoById(id)
  }

  values.push(id)

  await db
    .prepare(`UPDATE help_videos SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  return getHelpVideoById(id)
}

/** Delete a help video by ID. Returns true if deleted, false if not found. */
export async function deleteHelpVideo(id: string): Promise<boolean> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;

  const result = await db
    .prepare(`DELETE FROM help_videos WHERE id = ?1`)
    .bind(id)
    .run()

  // D1 returns meta with changes count - cast to access meta
  const meta = result as unknown as { meta?: { changes?: number } };
  return (meta.meta?.changes ?? 0) > 0
}

/** Helper to fetch video by ID. */
export async function getHelpVideoById(id: string): Promise<HelpVideo | null> {
  const safe = z.string().min(1).max(100).safeParse(id)
  if (!safe.success) return null

  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM help_videos WHERE id = ?1 LIMIT 1`)
    .bind(safe.data)
    .first<HelpVideo>()

  if (!row) return null
  return HelpVideoSchema.parse(row)
}
