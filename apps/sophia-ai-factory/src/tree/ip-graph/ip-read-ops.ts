/**
 * IP Graph Read & Traversal Operations — Sophia 2027 Creative Economy OS
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/ip-graph/ip-read-ops
 */

import { getD1 } from '@/seed/db/client';
import type { IP } from '@/seed/types/creative-domain';

export class IPGraphError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'IPGraphError';
    this.code = code;
  }
}

export function newIpId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ip_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface IPRow {
  id: string;
  workspace_id: string;
  type: string;
  name: string;
  description: string;
  metadata: string;
  parent_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export function rowToDomain(row: IPRow): IP {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    type: row.type as IP['type'],
    name: row.name,
    description: row.description,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    parentId: row.parent_id ?? undefined,
    status: row.status as IP['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getIP(id: string): Promise<IP | null> {
  const db = await getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db.prepare(`SELECT * FROM ip_entities WHERE id = ?1 LIMIT 1`).bind(id).first<IPRow>();
  return row ? rowToDomain(row) : null;
}

export async function listIP(workspaceId: string, type?: IP['type']): Promise<IP[]> {
  const db = await getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  let sql = `SELECT * FROM ip_entities WHERE workspace_id = ?1`;
  const params: unknown[] = [workspaceId];
  if (type) {
    sql += ` AND type = ?${params.length + 1}`;
    params.push(type);
  }
  sql += ` ORDER BY created_at DESC`;

  const result = await db.prepare(sql).bind(...params).all<IPRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function getIPChildren(parentId: string): Promise<IP[]> {
  const db = await getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db.prepare(`SELECT * FROM ip_entities WHERE parent_id = ?1 ORDER BY created_at ASC`).bind(parentId).all<IPRow>();
  return (result.results ?? []).map(rowToDomain);
}

/**
 * Full IP derivative tree: recursively collect every descendant of an
 * IP entity through parent_id references.
 */
export async function getIPDerivatives(ipId: string): Promise<IP[]> {
  const seen = new Set<string>();
  const queue: string[] = [ipId];
  const result: IP[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    const children = await getIPChildren(current);
    for (const child of children) {
      result.push(child);
      queue.push(child.id);
    }
  }

  return result;
}
