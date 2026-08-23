/**
 * ProvenanceLedger — adapter implementing IProvenanceLedger over the existing
 * tree/provenance repository functions. Layer: tree. Imports seed only.
 * Wraps, does not rewrite: persistence delegates to recordProvenance /
 * getProvenanceChain / getAgentRunProvenance. Where the contract needs a
 * capability the repo lacked (by-id get, filtered query, hasAction), the SQL
 * lives here as private methods at the D1 boundary. Append-only semantics
 * preserved — records are never mutated or deleted.
 *
 * @module tree/provenance/provenance-ledger
 */

import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';
import type {
  AgentRunId,
  IProvenanceLedger,
  ProvenanceQuery,
  ProvenanceRecordId,
} from '@/seed/types/creative-economy';
import { success, failure, type Result } from '@/seed/types/result';
import { createProvenanceRecordId } from '@/seed/types/creative-economy';
import { getD1 } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';
import {
  recordProvenance,
  getProvenanceChain,
  getAgentRunProvenance,
  ProvenanceError,
} from './types';

interface ProvenanceRow {
  id: string;
  workspace_id: string;
  asset_id: string;
  agent_run_id: string | null;
  action: string;
  actor_type: string;
  actor_id: string;
  model: string | null;
  model_version: string | null;
  prompt: string | null;
  source_asset_id: string | null;
  human_edits: string | null;
  approval_id: string | null;
  derivative_of: string | null;
  metadata: string;
  created_at: number;
}

export class ProvenanceLedger implements IProvenanceLedger {
  async append(
    record: Omit<ProvenanceRecord, 'id' | 'createdAt'>,
  ): Promise<Result<ProvenanceRecordId, Error>> {
    try {
      const saved = await recordProvenance({
        ...record,
        id: createProvenanceRecordId(),
        createdAt: Math.floor(Date.now() / 1000),
      });
      return success(createProvenanceRecordId(saved.id));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async get(id: ProvenanceRecordId): Promise<Result<ProvenanceRecord, Error>> {
    try {
      const record = await this.getProvenanceRecord(id);
      if (!record) {
        return failure(new ProvenanceError('NOT_FOUND', `Provenance record not found: ${id}`));
      }
      return success(record);
    } catch (err) {
      return failure(toError(err));
    }
  }

  async byAsset(assetId: string): Promise<Result<ProvenanceRecord[], Error>> {
    try {
      return success(await getProvenanceChain(assetId));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async byRun(agentRunId: AgentRunId): Promise<Result<ProvenanceRecord[], Error>> {
    try {
      return success(await getAgentRunProvenance(agentRunId as string));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async query(query: ProvenanceQuery): Promise<Result<ProvenanceRecord[], Error>> {
    try {
      return success(await this.queryProvenance(query));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async hasAction(
    assetId: string,
    action: ProvenanceAction,
  ): Promise<Result<boolean, Error>> {
    try {
      return success(await this.hasProvenanceAction(assetId, action));
    } catch (err) {
      return failure(toError(err));
    }
  }

  private async getProvenanceRecord(id: string): Promise<ProvenanceRecord | null> {
    const db = await getD1();
    if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');
    const row = await db
      .prepare(`SELECT * FROM provenance_records WHERE id = ?1`)
      .bind(id)
      .first<ProvenanceRow>();
    if (!row) return null;
    return this.rowToDomain(row);
  }

  private async queryProvenance(query: ProvenanceQuery): Promise<ProvenanceRecord[]> {
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

    let sql = `SELECT * FROM provenance_records`;
    if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
    sql += ` ORDER BY created_at ASC, id ASC`;
    if (query.limit) {
      sql += ` LIMIT ?${params.length + 1}`;
      params.push(query.limit);
    }

    const result = await db.prepare(sql).bind(...params).all<ProvenanceRow>();
    return (result.results ?? []).map(this.rowToDomain);
  }

  private async hasProvenanceAction(
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

  private rowToDomain(row: ProvenanceRow): ProvenanceRecord {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      assetId: row.asset_id,
      agentRunId: row.agent_run_id ?? undefined,
      action: row.action as ProvenanceAction,
      actorType: row.actor_type as ProvenanceRecord['actorType'],
      actorId: row.actor_id,
      model: row.model ?? undefined,
      modelVersion: row.model_version ?? undefined,
      prompt: row.prompt ?? undefined,
      sourceAssetId: row.source_asset_id ?? undefined,
      humanEdits: row.human_edits ?? undefined,
      approvalId: row.approval_id ?? undefined,
      derivativeOf: row.derivative_of ?? undefined,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  }
}

export const provenanceLedger = new ProvenanceLedger();