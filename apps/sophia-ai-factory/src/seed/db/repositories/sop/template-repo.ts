/**
 * SOP Template queries and insertions
 *
 * @module seed/db/repositories/sop/template-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SopTemplateDbRow } from '@/seed/db/types';
import { SOP_TEMPLATE_COLUMNS, insertSopTemplate } from './template-insert-helper';

export { insertSopTemplate };

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
      SELECT ${SOP_TEMPLATE_COLUMNS}
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
      .prepare(`SELECT ${SOP_TEMPLATE_COLUMNS} FROM sop_templates WHERE slug = ?1 LIMIT 1`)
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
      .prepare(`SELECT ${SOP_TEMPLATE_COLUMNS} FROM sop_templates WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<SopTemplateDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getSopTemplateById failed', { id, error: getErrorMessage(err) });
    return null;
  }
}
