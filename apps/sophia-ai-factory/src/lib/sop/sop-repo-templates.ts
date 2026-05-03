/**
 * SOP Template Repository
 * Read-only queries against sop_templates catalog.
 */

import type { SopTemplateRow } from './sop-types';

/** List all published official templates */
export async function listOfficialTemplates(db: D1Database): Promise<SopTemplateRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM sop_templates WHERE is_official = 1 AND status = 'published' ORDER BY created_at ASC`)
    .all<SopTemplateRow>();
  return results;
}

/** Look up a template by URL slug */
export async function getTemplateBySlug(db: D1Database, slug: string): Promise<SopTemplateRow | null> {
  const row = await db
    .prepare(`SELECT * FROM sop_templates WHERE slug = ?1 AND status = 'published' LIMIT 1`)
    .bind(slug)
    .first<SopTemplateRow>();
  return row ?? null;
}

/** Look up a template by ID */
export async function getTemplateById(db: D1Database, id: string): Promise<SopTemplateRow | null> {
  const row = await db
    .prepare(`SELECT * FROM sop_templates WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<SopTemplateRow>();
  return row ?? null;
}
