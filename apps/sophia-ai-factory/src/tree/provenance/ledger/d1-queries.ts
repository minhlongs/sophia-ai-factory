import { getD1 } from '@/seed/db/client';
import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';
import type { ProvenanceQuery } from '@/seed/types/creative-economy';
import { ProvenanceError } from '../types';
import type { ProvenanceRow } from './types';
import { rowToProvenanceRecord } from './row-mapper';

export async function fetchProvenanceRecordById(id: string): Promise<ProvenanceRecord | null> {
  const db = await getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');
  const row = await db
    .prepare('SELECT * FROM provenance_records WHERE id = ?1')
    .bind(id)
    .first<ProvenanceRow>();
  if (!row) return null;
  return rowToProvenanceRecord(row);
}

export async function fetchProvenanceByQuery(query: ProvenanceQuery): Promise<ProvenanceRecord[]> {
  const db = await getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.workspaceId) {
    conditions.push(`workspace_id = ?${params.length + 1}`);
    params.push(query.workspaceId);
  }
  if (query.assetId) {
    conditions.push(`asset_id = ?${params.length + 1}`);
    params.push(query.assetId);
  }
  if (query.agentRunId) {
    conditions.push(`agent_run_id = ?${params.length + 1}`);
    params.push(query.agentRunId);
  }
  if (query.action) {
    conditions.push(`action = ?${params.length + 1}`);
    params.push(query.action);
  }
  if (query.actorType) {
    conditions.push(`actor_type = ?${params.length + 1}`);
    params.push(query.actorType);
  }
  if (query.from !== undefined) {
    conditions.push(`created_at >= ?${params.length + 1}`);
    params.push(query.from);
  }
  if (query.to !== undefined) {
    conditions.push(`created_at <= ?${params.length + 1}`);
    params.push(query.to);
  }

  let sql = 'SELECT * FROM provenance_records';
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ' ORDER BY created_at ASC, id ASC';
  if (query.limit) {
    sql += ` LIMIT ?${params.length + 1}`;
    params.push(query.limit);
  }

  const result = await db.prepare(sql).bind(...params).all<ProvenanceRow>();
  return (result.results ?? []).map(rowToProvenanceRecord);
}

export async function checkProvenanceActionExists(
  assetId: string,
  action: ProvenanceAction,
): Promise<boolean> {
  const db = await getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');
  const row = await db
    .prepare(
      `SELECT 1 FROM provenance_records
       WHERE asset_id = ?1 AND action = ?2 LIMIT 1`,
    )
    .bind(assetId, action)
    .first<unknown>();
  return row !== null;
}
