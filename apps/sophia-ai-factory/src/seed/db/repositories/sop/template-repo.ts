/**
 * SOP Template queries and insertions
 *
 * @module seed/db/repositories/sop/template-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SopTemplateDbRow } from '@/seed/db/types';

/**
 * Fetch SOP templates with optional category / status filters.
 * Returns published templates by default when no status filter is provided.
 */
export async function getSopTemplates(
  filters?: { category?: string; status?: string },
): Promise<SopTemplateDbRow[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');

    const conditions: string[] = [];
    const bindings: unknown[] = [];
    let paramIdx = 1;

    if (filters?.category) {
      conditions.push(`category = ?${paramIdx++}`);
      bindings.push(filters.category);
    }

    const statusFilter = filters?.status ?? 'published';
    conditions.push(`status = ?${paramIdx++}`);
    bindings.push(statusFilter);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, slug, name_vi, name_en, description_vi, description_en,
             category, difficulty, estimated_revenue_min, estimated_revenue_max,
             setup_time_minutes, credits_per_run, version, steps_json,
             input_schema, output_schema, is_featured, is_official, status,
             author_user_id, created_at, updated_at
      FROM sop_templates
      ${where}
      ORDER BY is_featured DESC, created_at DESC
    `;

    const stmt = db.prepare(sql);
    const result = bindings.length > 0
      ? await stmt.bind(...bindings).all<SopTemplateDbRow>()
      : await stmt.all<SopTemplateDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopRepo] getSopTemplates failed', { filters, error: getErrorMessage(err) });
    return [];
  }
}

/**
 * Fetch a single SOP template by its slug.
 * Returns null when not found or on error.
 */
export async function getSopTemplateBySlug(slug: string): Promise<SopTemplateDbRow | null> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const row = await db
      .prepare(
        `SELECT id, slug, name_vi, name_en, description_vi, description_en,
                category, difficulty, estimated_revenue_min, estimated_revenue_max,
                setup_time_minutes, credits_per_run, version, steps_json,
                input_schema, output_schema, is_featured, is_official, status,
                author_user_id, created_at, updated_at
         FROM sop_templates
         WHERE slug = ?1
         LIMIT 1`,
      )
      .bind(slug)
      .first<SopTemplateDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getSopTemplateBySlug failed', { slug, error: getErrorMessage(err) });
    return null;
  }
}

/**
 * Fetch a single SOP template by ID.
 * Returns null when not found or on error.
 */
export async function getSopTemplateById(id: string): Promise<SopTemplateDbRow | null> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const row = await db
      .prepare(
        `SELECT id, slug, name_vi, name_en, description_vi, description_en,
                category, difficulty, estimated_revenue_min, estimated_revenue_max,
                setup_time_minutes, credits_per_run, version, steps_json,
                input_schema, output_schema, is_featured, is_official, status,
                author_user_id, created_at, updated_at
         FROM sop_templates
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(id)
      .first<SopTemplateDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getSopTemplateById failed', { id, error: getErrorMessage(err) });
    return null;
  }
}

/**
 * Insert a new SOP template row.
 * created_at and updated_at are set automatically to Date.now().
 * Throws on D1 constraint violation (e.g. duplicate slug).
 */
export async function insertSopTemplate(
  template: Omit<SopTemplateDbRow, 'created_at' | 'updated_at'>,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO sop_templates
         (id, slug, name_vi, name_en, description_vi, description_en,
          category, difficulty, estimated_revenue_min, estimated_revenue_max,
          setup_time_minutes, credits_per_run, version, steps_json,
          input_schema, output_schema, is_featured, is_official, status,
          author_user_id, created_at, updated_at)
       VALUES
         (?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10,
          ?11, ?12, ?13, ?14,
          ?15, ?16, ?17, ?18, ?19,
          ?20, ?21, ?21)`,
    )
    .bind(
      template.id,
      template.slug,
      template.name_vi,
      template.name_en,
      template.description_vi ?? null,
      template.description_en ?? null,
      template.category,
      template.difficulty,
      template.estimated_revenue_min ?? null,
      template.estimated_revenue_max ?? null,
      template.setup_time_minutes,
      template.credits_per_run,
      template.version,
      template.steps_json,
      template.input_schema,
      template.output_schema,
      template.is_featured,
      template.is_official,
      template.status,
      template.author_user_id ?? null,
      now,
    )
    .run();
}
