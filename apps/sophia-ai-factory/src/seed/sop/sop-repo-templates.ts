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

/** Batch-fetch templates by IDs (avoids N+1 queries) */
export async function getTemplatesByIds(db: D1Database, ids: string[]): Promise<SopTemplateRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
  const { results } = await db
    .prepare(`SELECT * FROM sop_templates WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<SopTemplateRow>();
  return results;
}

/** List published community (non-official) templates */
export async function listMarketplaceTemplates(db: D1Database): Promise<SopTemplateRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM sop_templates WHERE is_official = 0 AND status = 'published' ORDER BY created_at DESC`)
    .all<SopTemplateRow>();
  return results;
}

/** List templates created by a specific user */
export async function listTemplatesByAuthor(db: D1Database, authorUserId: string): Promise<SopTemplateRow[]> {
  const { results } = await db
    .prepare(`SELECT * FROM sop_templates WHERE author_user_id = ?1 ORDER BY created_at DESC`)
    .bind(authorUserId)
    .all<SopTemplateRow>();
  return results;
}

/** Insert a new community SOP template (status = 'draft' until published) */
export async function createTemplate(db: D1Database, input: {
  slug: string; nameVi: string; nameEn: string; descriptionVi: string; descriptionEn: string;
  category: string; agentsYaml: string; playbookMd: string; outputSchema?: string;
  creditsPerRun?: number; configSchema?: string; configDefaults?: string;
  setupTimeMinutes?: number; authorUserId: string;
}): Promise<SopTemplateRow> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.prepare(`
    INSERT INTO sop_templates (id, slug, name_vi, name_en, description_vi, description_en, category,
      agents_yaml, playbook_md, output_schema, credits_per_run, version, is_official, author_user_id,
      status, config_schema, config_defaults, setup_time_minutes, is_featured, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, 0, ?12, 'draft', ?13, ?14, ?15, 0, ?16, ?16)
  `).bind(
    id, input.slug, input.nameVi, input.nameEn, input.descriptionVi, input.descriptionEn,
    input.category, input.agentsYaml, input.playbookMd, input.outputSchema ?? '{}',
    input.creditsPerRun ?? 10, input.authorUserId, input.configSchema ?? null,
    input.configDefaults ?? null, input.setupTimeMinutes ?? 30, now
  ).run();
  return (await db.prepare(`SELECT * FROM sop_templates WHERE id = ?1`).bind(id).first<SopTemplateRow>())!;
}
