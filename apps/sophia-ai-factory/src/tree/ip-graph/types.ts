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
import {
  IPGraphError,
  newIpId,
  rowToDomain,
  getIP,
  listIP,
  getIPChildren,
  getIPDerivatives,
  type IPRow,
} from './ip-read-ops';

export {
  IPGraphError,
  newIpId,
  getIP,
  listIP,
  getIPChildren,
  getIPDerivatives,
};

export async function createIP(entity: IP): Promise<IP> {
  const db = await getD1();
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

export async function updateIPStatus(id: string, status: ContentStatus): Promise<IP | null> {
  const db = await getD1();
  if (!db) throw new IPGraphError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  await db.prepare(`UPDATE ip_entities SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, id).run();

  const row = await db.prepare(`SELECT * FROM ip_entities WHERE id = ?1 LIMIT 1`).bind(id).first<IPRow>();
  return row ? rowToDomain(row) : null;
}
