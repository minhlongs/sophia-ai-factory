/**
 * Read and List Queries for SOP Graph Templates Repository.
 * @module seed/db/repositories/sop-template-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SOPGraph } from '@/seed/types/sop-dag';

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

export interface RawSopTemplateRow {
  id: string;
  name: string;
  description: string | null;
  graph_json: string;
  version: number;
  is_active: number;
  category: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export function mapSopTemplateRow(r: RawSopTemplateRow): SopTemplateRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    graph: JSON.parse(r.graph_json) as SOPGraph,
    version: r.version,
    isActive: r.is_active === 1,
    category: r.category,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Fetch template by ID. Parses graph_json. Returns null if not found or on error. */
export async function getTemplate(id: string): Promise<SopTemplateRow | null> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const raw = await db
      .prepare(
        `SELECT id, name, description, graph_json, version, is_active,
                category, created_by, created_at, updated_at
         FROM sop_graph_templates WHERE id = ?1`,
      )
      .bind(id)
      .first<RawSopTemplateRow>();
    return raw ? mapSopTemplateRow(raw) : null;
  } catch (err) {
    logger.error('[SopTemplateRepo] getTemplate failed', { id, error: getErrorMessage(err) });
    return null;
  }
}

/** List templates (without graph_json). Returns empty array on error. */
export async function listTemplates(
  opts: {
    createdBy?: string;
    category?: string;
    activeOnly?: boolean;
    limit?: number;
  } = {},
): Promise<SopTemplateSummary[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    const conditions: string[] = [];
    const bindings: unknown[] = [];
    let idx = 1;

    if (opts.activeOnly !== false) conditions.push(`is_active = 1`);
    if (opts.createdBy) {
      conditions.push(`created_by = ?${idx++}`);
      bindings.push(opts.createdBy);
    }
    if (opts.category) {
      conditions.push(`category = ?${idx++}`);
      bindings.push(opts.category);
    }
    bindings.push(opts.limit ?? 50);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db
      .prepare(
        `SELECT id, name, description, version, is_active, category, created_by, updated_at
         FROM sop_graph_templates ${where} ORDER BY updated_at DESC LIMIT ?${idx}`,
      )
      .bind(...bindings)
      .all<Omit<RawSopTemplateRow, 'graph_json' | 'created_at'>>();

    return (result.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      version: r.version,
      isActive: r.is_active === 1,
      category: r.category,
      createdBy: r.created_by,
      updatedAt: r.updated_at,
    }));
  } catch (err) {
    logger.error('[SopTemplateRepo] listTemplates failed', { opts, error: getErrorMessage(err) });
    return [];
  }
}
