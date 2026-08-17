/**
 * Provenance — append-only audit trail for all generated/derived content.
 * Layer: tree (domain-specific reusable)
 *
 * Every artifact gets a ProvenanceRecord tracking:
 * - who/what created it
 * - what model/tool was used
 * - what source it was derived from
 * - human edits and approvals
 *
 * @module tree/provenance
 */

import { getD1 } from '@/seed/db/client';
import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';

export class ProvenanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProvenanceError';
    this.code = code;
  }
}

export function newProvenanceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'prov_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

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

function rowToDomain(row: ProvenanceRow): ProvenanceRecord {
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

export async function recordProvenance(record: ProvenanceRecord): Promise<ProvenanceRecord> {
  const db = getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  record.id = record.id || newProvenanceId();
  record.createdAt = now;

  try {
    await db
      .prepare(
        `INSERT INTO provenance_records
           (id, workspace_id, asset_id, agent_run_id, action, actor_type, actor_id,
            model, model_version, prompt, source_asset_id, human_edits,
            approval_id, derivative_of, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        record.id,
        record.workspaceId,
        record.assetId,
        record.agentRunId ?? null,
        record.action,
        record.actorType,
        record.actorId,
        record.model ?? null,
        record.modelVersion ?? null,
        record.prompt ?? null,
        record.sourceAssetId ?? null,
        record.humanEdits ?? null,
        record.approvalId ?? null,
        record.derivativeOf ?? null,
        JSON.stringify(record.metadata ?? {}),
        now,
      )
      .run();
  } catch (err) {
    throw new ProvenanceError('INSERT_FAILED', err instanceof Error ? err.message : 'unknown');
  }

  return record;
}

export async function getProvenanceChain(assetId: string): Promise<ProvenanceRecord[]> {
  const db = getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM provenance_records WHERE asset_id = ?1 ORDER BY created_at ASC`)
    .bind(assetId)
    .all<ProvenanceRow>();

  return (result.results ?? []).map(rowToDomain);
}

export async function getDerivatives(assetId: string): Promise<ProvenanceRecord[]> {
  const db = getD1();
  if (!db) throw new ProvenanceError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(`SELECT * FROM provenance_records WHERE derivative_of = ?1 ORDER BY created_at ASC`)
    .bind(assetId)
    .all<ProvenanceRow>();

  return (result.results ?? []).map(rowToDomain);
}