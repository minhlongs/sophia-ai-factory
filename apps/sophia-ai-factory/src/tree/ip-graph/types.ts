/**
 * IP Graph — Sophia 2027 Creative Economy OS
 * Layer: tree (domain-specific reusable)
 *
 * Tracks intellectual property entities: universes, series, characters,
 * themes, brands. Forms a graph via parentId references.
 *
 * @module tree/ip-graph
 */

import { getD1 } from '@/seed/db/client';
import type { IP, ContentStatus } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class IPGraphError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'IPGraphError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function newIpId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ip_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

interface IPRow {
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

function rowToDomain(row: IPRow): IP {
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

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createIP(entity: IP): Promise<IP> {
  const db = getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const record: IP = {
    ...entity,
    id: entity.id || newIpId(),
    status: entity.status || 'draft',
    createdAt: entity.createdAt || now,
    updatedAt: now,
  };

  try {
    await db
      .prepare(
        `INSERT INTO ip_entities
           (id, workspace_id, type, name, description, metadata, parent_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.workspaceId,
        record.type,
        record.name,
        record.description,
        JSON.stringify(record.metadata ?? {}),
        record.parentId ?? null,
        record.status,
        now,
        now,
      )
      .run();
  } catch (err) {
    throw new IPGraphError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return record;
}

export async function getIP(id: string): Promise<IP | null> {
  const db = getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db.prepare(`SELECT * FROM ip_entities WHERE id = ?1 LIMIT 1`).bind(id).first<IPRow>();
  return row ? rowToDomain(row) : null;
}

export async function listIP(workspaceId: string, type?: IP['type']): Promise<IP[]> {
  const db = getD1();
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
  const db = getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db.prepare(`SELECT * FROM ip_entities WHERE parent_id = ?1 ORDER BY created_at ASC`).bind(parentId).all<IPRow>();
  return (result.results ?? []).map(rowToDomain);
}

export async function updateIPStatus(id: string, status: ContentStatus): Promise<IP | null> {
  const db = getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE ip_entities SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run();

  const row = await db.prepare(`SELECT * FROM ip_entities WHERE id = ?1 LIMIT 1`).bind(id).first<IPRow>();
  return row ? rowToDomain(row) : null;
}