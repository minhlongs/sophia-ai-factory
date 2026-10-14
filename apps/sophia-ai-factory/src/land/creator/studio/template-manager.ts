/**
 * Template management (creation, listing, archiving) for Creator Studio
 *
 * @module land/creator/studio/template-manager
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  CreatorTemplate,
  CreateTemplateInput,
  TemplateStatus,
} from '@/seed/types/creator-marketplace';
import { CreateTemplateInputSchema } from '@/seed/types/creator-marketplace';
import type { TemplateDbRow } from './types';
import { mapTemplateRow } from './types';
import { insertCreatorTemplateRecord } from './template-manager-helpers';

/**
 * List templates for a creator with pagination and filtering.
 */
export async function listCreatorTemplates(
  db: D1Database,
  creatorId: string,
  options?: { status?: TemplateStatus; limit?: number; offset?: number },
): Promise<{ items: CreatorTemplate[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let countSql = `SELECT COUNT(*) as cnt FROM creator_templates WHERE creator_id = ?`;
  let selectSql = `SELECT * FROM creator_templates WHERE creator_id = ?`;
  const binds: unknown[] = [creatorId];

  if (options?.status) {
    countSql += ` AND status = ?`;
    selectSql += ` AND status = ?`;
    binds.push(options.status);
  } else {
    countSql += ` AND status != 'archived'`;
    selectSql += ` AND status != 'archived'`;
  }

  selectSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;

  let total = 0;
  try {
    const countRow = await db.prepare(countSql).bind(...binds).first<{ cnt?: number }>();
    total = countRow?.cnt ?? 0;
  } catch (err) {
    logger.warn('Failed to count creator templates', { creatorId, error: String(err) });
  }

  const selectBinds = [...binds, limit, offset];
  try {
    const rows = await db.prepare(selectSql).bind(...selectBinds).all<TemplateDbRow>();
    const items = (rows.results ?? []).map(mapTemplateRow);
    return { items, total };
  } catch (err) {
    logger.error('Failed to list creator templates', { creatorId, error: String(err) });
    return { items: [], total: 0 };
  }
}

/**
 * Create a new creator template.
 */
export async function createCreatorTemplate(
  db: D1Database,
  creatorId: string,
  tenantId: string,
  rawInput: CreateTemplateInput,
  nowMs = Date.now(),
): Promise<{ success: boolean; template?: CreatorTemplate; error?: string }> {
  const parseResult = CreateTemplateInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join('; '),
    };
  }

  const input = parseResult.data;
  const id = `tmpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const royaltyPct = 70.0;
  const status: TemplateStatus = 'pending';

  try {
    const created = await insertCreatorTemplateRecord({
      db,
      id,
      creatorId,
      tenantId,
      input,
      royaltyPct,
      status,
      nowMs,
    });

    logger.info('Creator template created successfully', { templateId: id, creatorId });
    return { success: true, template: created };
  } catch (err) {
    logger.error('Failed to create creator template', { creatorId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'INSERT_FAILED' };
  }
}

/**
 * Archive / delete a creator template.
 */
export async function archiveCreatorTemplate(
  db: D1Database,
  templateId: string,
  creatorId: string,
  nowMs = Date.now(),
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await db
      .prepare(
        `UPDATE creator_templates
         SET status = 'archived', updated_at = ?
         WHERE id = ? AND creator_id = ?`,
      )
      .bind(nowMs, templateId, creatorId)
      .run();

    if (res.meta && res.meta.changes === 0) {
      return { success: false, error: 'TEMPLATE_NOT_FOUND_OR_UNAUTHORIZED' };
    }

    return { success: true };
  } catch (err) {
    logger.error('Failed to archive creator template', { templateId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'ARCHIVE_FAILED' };
  }
}
