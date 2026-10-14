import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';
import type { ProvenanceRow } from './types';

export function rowToProvenanceRecord(row: ProvenanceRow): ProvenanceRecord {
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
