/**
 * SOP Template repository — typed CRUD for the `sop_graph_templates` table.
 * Serializes/deserializes SOPGraph to/from graph_json TEXT column.
 * @module seed/db/repositories/sop-template-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { SOPGraph } from '@/seed/types/sop-dag';

export {
  getTemplate,
  listTemplates,
  type SopTemplateRow,
  type SopTemplateSummary,
} from './sop-template-queries';

// ── Create ────────────────────────────────────────────────────────────────────

/** Insert a new SOP template. Returns generated ID. Throws on D1 error. */
export async function createTemplate(params: {
  name: string; description?: string; graphJson: SOPGraph;
  category?: string; createdBy: string;
}): Promise<string> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO sop_graph_templates
         (id, name, description, graph_json, version, is_active,
          category, created_by, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 1, 1, ?5, ?6, ?7, ?7)`,
    )
    .bind(
      id, params.name, params.description ?? null,
      JSON.stringify(params.graphJson),
      params.category ?? null, params.createdBy, now,
    )
    .run();

  logger.info('[SopTemplateRepo] Template created', { id, name: params.name, createdBy: params.createdBy });
  return id;
}

// ── Update ────────────────────────────────────────────────────────────────────

/** Partial update. Only provided fields are changed. Throws on D1 error. */
export async function updateTemplate(
  id: string,
  updates: { name?: string; description?: string; graphJson?: SOPGraph; category?: string; isActive?: boolean },
): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);
  const sets: string[] = ['updated_at = ?1'];
  const bindings: unknown[] = [now];
  let idx = 2;

  if (updates.name        !== undefined) { sets.push(`name = ?${idx++}`);        bindings.push(updates.name); }
  if (updates.description !== undefined) { sets.push(`description = ?${idx++}`); bindings.push(updates.description); }
  if (updates.graphJson   !== undefined) { sets.push(`graph_json = ?${idx++}`);  bindings.push(JSON.stringify(updates.graphJson)); }
  if (updates.category    !== undefined) { sets.push(`category = ?${idx++}`);    bindings.push(updates.category); }
  if (updates.isActive    !== undefined) { sets.push(`is_active = ?${idx++}`);   bindings.push(updates.isActive ? 1 : 0); }

  bindings.push(id);
  await db
    .prepare(`UPDATE sop_graph_templates SET ${sets.join(', ')} WHERE id = ?${idx}`)
    .bind(...bindings)
    .run();

  logger.info('[SopTemplateRepo] Template updated', { id, fields: Object.keys(updates) });
}

// ── Deactivate ────────────────────────────────────────────────────────────────

/** Archive a template (is_active = 0). Preserves history. Throws on D1 error. */
export async function deactivateTemplate(id: string): Promise<void> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`UPDATE sop_graph_templates SET is_active = 0, updated_at = ?2 WHERE id = ?1`)
    .bind(id, now)
    .run();

  logger.info('[SopTemplateRepo] Template deactivated', { id });
}
