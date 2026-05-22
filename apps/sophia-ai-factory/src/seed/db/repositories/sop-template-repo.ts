/**
 * SOP Template repository — typed CRUD for the `sop_templates` table.
 * Serializes/deserializes SOPGraph to/from graph_json TEXT column.
 * @module seed/db/repositories/sop-template-repo
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SOPGraph } from '@/seed/types/sop-dag';

// ── Row types ─────────────────────────────────────────────────────────────────

export interface SopTemplateRow {
  id: string;
  name: string;
  description: string | null;
  graph: SOPGraph;
  version: number;
  isActive: boolean;
  category: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface SopTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  category: string | null;
  createdBy: string;
  updatedAt: number;
}

interface RawRow {
  id: string; name: string; description: string | null;
  graph_json: string; version: number; is_active: number;
  category: string | null; created_by: string;
  created_at: number; updated_at: number;
}

function mapRow(r: RawRow): SopTemplateRow {
  return {
    id: r.id, name: r.name, description: r.description,
    graph: JSON.parse(r.graph_json) as SOPGraph,
    version: r.version, isActive: r.is_active === 1,
    category: r.category, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ── Create ────────────────────────────────────────────────────────────────────

/** Insert a new SOP template. Returns generated ID. Throws on D1 error. */
export async function createTemplate(params: {
  name: string; description?: string; graphJson: SOPGraph;
  category?: string; createdBy: string;
}): Promise<string> {
  const db = await getD1Raw();
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO sop_templates
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

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch template by ID. Parses graph_json. Returns null if not found or on error. */
export async function getTemplate(id: string): Promise<SopTemplateRow | null> {
  try {
    const db = await getD1Raw();
    const raw = await db
      .prepare(
        `SELECT id, name, description, graph_json, version, is_active,
                category, created_by, created_at, updated_at
         FROM sop_templates WHERE id = ?1`,
      )
      .bind(id)
      .first<RawRow>();
    return raw ? mapRow(raw) : null;
  } catch (err) {
    logger.error('[SopTemplateRepo] getTemplate failed', { id, error: getErrorMessage(err) });
    return null;
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

/** List templates (without graph_json). Returns empty array on error. */
export async function listTemplates(opts: {
  createdBy?: string; category?: string;
  activeOnly?: boolean; limit?: number;
} = {}): Promise<SopTemplateSummary[]> {
  try {
    const db = await getD1Raw();
    const conditions: string[] = [];
    const bindings: unknown[] = [];
    let idx = 1;

    if (opts.activeOnly !== false) conditions.push(`is_active = 1`);
    if (opts.createdBy) { conditions.push(`created_by = ?${idx++}`); bindings.push(opts.createdBy); }
    if (opts.category)  { conditions.push(`category = ?${idx++}`);    bindings.push(opts.category); }
    bindings.push(opts.limit ?? 50);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db
      .prepare(
        `SELECT id, name, description, version, is_active, category, created_by, updated_at
         FROM sop_templates ${where} ORDER BY updated_at DESC LIMIT ?${idx}`,
      )
      .bind(...bindings)
      .all<Omit<RawRow, 'graph_json' | 'created_at'>>();

    return (result.results ?? []).map((r) => ({
      id: r.id, name: r.name, description: r.description,
      version: r.version, isActive: r.is_active === 1,
      category: r.category, createdBy: r.created_by, updatedAt: r.updated_at,
    }));
  } catch (err) {
    logger.error('[SopTemplateRepo] listTemplates failed', { opts, error: getErrorMessage(err) });
    return [];
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

/** Partial update. Only provided fields are changed. Throws on D1 error. */
export async function updateTemplate(
  id: string,
  updates: { name?: string; description?: string; graphJson?: SOPGraph; category?: string; isActive?: boolean },
): Promise<void> {
  const db = await getD1Raw();
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
    .prepare(`UPDATE sop_templates SET ${sets.join(', ')} WHERE id = ?${idx}`)
    .bind(...bindings)
    .run();

  logger.info('[SopTemplateRepo] Template updated', { id, fields: Object.keys(updates) });
}

// ── Deactivate ────────────────────────────────────────────────────────────────

/** Archive a template (is_active = 0). Preserves history. Throws on D1 error. */
export async function deactivateTemplate(id: string): Promise<void> {
  const db = await getD1Raw();
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(`UPDATE sop_templates SET is_active = 0, updated_at = ?2 WHERE id = ?1`)
    .bind(id, now)
    .run();

  logger.info('[SopTemplateRepo] Template deactivated', { id });
}
