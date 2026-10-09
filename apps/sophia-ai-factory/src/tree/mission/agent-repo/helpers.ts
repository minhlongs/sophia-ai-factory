/**
 * Agent Run JSON Serialization Helpers & Model Mapping
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/helpers
 */

import type { AgentRunRecord } from './types';

export function toJson(v: Record<string, unknown> | undefined): string | undefined {
  if (!v) return undefined;
  try {
    return JSON.stringify(v);
  } catch {
    return undefined;
  }
}

export function parseJson(v: string | null | undefined): Record<string, unknown> | undefined {
  if (!v) return undefined;
  try {
    return JSON.parse(v) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function rowToRun(row: Record<string, unknown>): AgentRunRecord {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    workspaceId: row.workspace_id as string,
    missionId: row.mission_id as string | undefined,
    createdAt: row.created_at as number,
    startedAt: row.started_at as number | undefined,
    endedAt: row.ended_at as number | undefined,
    status: row.status as AgentRunRecord['status'],
    phase: row.phase as AgentRunRecord['phase'],
    inputJson: parseJson(row.input_json as string | null | undefined),
    outputJson: parseJson(row.output_json as string | null | undefined),
    errorJson: parseJson(row.error_json as string | null | undefined),
    errorMessage: row.error_message as string | undefined,
    autonomyLevel: row.autonomy_level as number,
    totalCostCents: row.total_cost_cents as number,
    totalTokens: row.total_tokens as number,
    retryCount: row.retry_count as number,
    parentRunId: row.parent_run_id as string | undefined,
    metadata: parseJson(row.metadata as string | null | undefined),
  };
}
