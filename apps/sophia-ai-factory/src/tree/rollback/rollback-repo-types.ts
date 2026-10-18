/**
 * Rollback Repository Types & Row Mapping Helpers
 *
 * Layer: tree (domain-specific reusable).
 *
 * @module tree/rollback/rollback-repo-types
 */

export interface RollbackRecord {
  id: string;
  workspaceId: string;
  missionId: string | null;
  agentRunId: string | null;
  reason: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: string;
  rolledBackAt: number;
}

export interface RollbackInput {
  workspaceId: string;
  missionId?: string;
  agentRunId?: string;
  reason: string;
  fromStatus: string;
  toStatus: string;
  triggeredBy: string;
}

export type RollbackRepoError =
  | { code: 'DB_UNAVAILABLE'; message: string }
  | { code: 'DB_ERROR'; message: string };

export interface RollbackRow {
  id: string;
  workspace_id: string;
  mission_id: string | null;
  agent_run_id: string | null;
  reason: string;
  from_status: string;
  to_status: string;
  triggered_by: string;
  rolled_back_at: number;
}

export function toErrorCode(err: unknown): RollbackRepoError {
  const message = err instanceof Error ? err.message : String(err);
  return { code: 'DB_ERROR', message };
}

export function generateRollbackId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `rb_${timestamp}_${randomPart}`;
}

export function mapRollbackRow(row: RollbackRow): RollbackRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionId: row.mission_id,
    agentRunId: row.agent_run_id,
    reason: row.reason,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    triggeredBy: row.triggered_by,
    rolledBackAt: row.rolled_back_at,
  };
}
