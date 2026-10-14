/**
 * Agent run + context builders for the mission executor.
 *
 * Layer: forest (reusable infrastructure orchestrators).
 * Imports seed + tree only (forward direction).
 * Every loader here is NON-FATAL except initAgentRun which fails loudly for Inngest retry.
 *
 * @module forest/inngest/functions/agent-context
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  createAgentRun,
  getAgentRun,
  type AgentRunRecord,
} from '@/tree/mission/agent-run-repo';
import type { AutonomyLevel } from '@/seed/types/creative-domain';

export * from './agent-context-memory';

/** Clamp an arbitrary number into the valid AutonomyLevel range 0..4. */
export function toAutonomyLevel(value: number | undefined): AutonomyLevel {
  if (value === undefined || value === null) return 0;
  const clamped = Math.min(4, Math.max(0, Math.round(value)));
  return clamped as AutonomyLevel;
}

/**
 * Initialize the D1 agent_run row, resume-aware: cron retries re-dispatch the
 * same runId and the row already exists with status='running', so detect first
 * and skip the INSERT on the resume path (PK-violation guard). Throws on
 * create failure so the Inngest function fails loudly.
 */
export async function initAgentRun(args: {
  runId: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  autonomyLevel: number | undefined;
  inputJson?: Record<string, unknown>;
}): Promise<AgentRunRecord> {
  const { runId, agentId, workspaceId, missionId, autonomyLevel, inputJson } = args;
  const existingResult = await getAgentRun(runId);
  const existing = existingResult.ok ? existingResult.value : undefined;
  if (existing && existing.status === 'running') {
    logger.info('agentMissionExecutor: resumed existing agent run (retry)', {
      runId,
      previousRetryCount: existing.retryCount,
    });
    return existing;
  }
  const created = await createAgentRun({
    id: runId,
    agentId,
    workspaceId,
    missionId,
    autonomyLevel: toAutonomyLevel(autonomyLevel),
    inputJson,
    metadata: { triggeredBy: 'inngest', missionId },
  });
  if (!created.ok) {
    logger.error('agentMissionExecutor: failed to create agent_run', { runId, error: created.error });
    throw new Error(`Failed to create agent_run: ${created.error?.message ?? 'unknown'}`);
  }
  return created.value;
}
