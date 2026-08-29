/**
 * Agent run + context builders for the mission executor.
 *
 * Layer: forest (reusable infrastructure orchestrators).
 * Imports seed + tree only (forward direction). Extracted from
 * agent-mission-executor.ts to keep it near the 200-line budget.
 * Every loader here is NON-FATAL: a failure degrades the run (identity or
 * memory omitted) but never aborts it. `initAgentRun` is the exception — a
 * failed D1 write there must fail loudly so Inngest retries.
 *
 * @module forest/inngest/functions/agent-context
 */

import { logger } from '@/seed/utils/logger-utility';
import { getActiveIdentity } from '@/tree/creative-identity';
import { creativeMemoryStore } from '@/tree/creative-memory';
import { emitMemoryUsed } from '@/tree/performance/loop-emitters-cost';
import {
  createAgentRun,
  getAgentRun,
  type AgentRunRecord,
} from '@/tree/mission/agent-run-repo';
import type {
  AutonomyLevel,
  CreativeIdentity,
  CreativeMemory,
  MemoryConfidence,
  Mission,
} from '@/seed/types/creative-domain';

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
    id: runId, agentId, workspaceId, missionId,
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

/** Build a CreativeMemory entry from the mission brief. */
export function buildMissionMemory(mission: Mission): CreativeMemory {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `mission-brief-${mission.id}`,
    workspaceId: mission.workspaceId,
    category: 'creative',
    key: 'mission_brief',
    value: { objective: mission.objective, audience: mission.audience, constraints: mission.constraints },
    confidence: 'high',
    source: 'human_edit',
    evidence: JSON.stringify([mission.id]),
    scope: 'campaign',
    scopeId: mission.id,
    version: 1,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Load the workspace's active CreativeIdentity. getActiveIdentity THROWS
 * CreativeIdentityError('D1_UNAVAILABLE') when D1 is absent — it does not
 * return a Result — so wrap it: failure degrades the run instead of aborting.
 */
export async function loadWorkspaceIdentity(
  workspaceId: string,
): Promise<CreativeIdentity | undefined> {
  try {
    const identity = await getActiveIdentity(workspaceId);
    return identity ?? undefined;
  } catch (err) {
    logger.warn('[agent-context] failed to load creative identity (non-fatal)', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

/**
 * Load recent stored memories for the workspace and merge them with the
 * mission brief (brief always leads). Non-fatal: on any failure the caller
 * still receives `[buildMissionMemory(mission)]`.
 */
export async function loadMissionMemories(mission: Mission, limit = 5): Promise<CreativeMemory[]> {
  const brief = buildMissionMemory(mission);
  try {
    const result = await creativeMemoryStore.query({ workspaceId: mission.workspaceId, limit });
    if (!result.ok) {
      logger.warn('[agent-context] memory query failed (non-fatal)', {
        workspaceId: mission.workspaceId,
        error: result.error?.message ?? 'unknown',
      });
      return [brief];
    }
    const filtered = (result.value.entries ?? []).filter((e) => e.key !== 'mission_brief');
    return [brief, ...filtered];
  } catch (err) {
    logger.warn('[agent-context] memory query threw (non-fatal)', {
      workspaceId: mission.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [brief];
  }
}

/** Map numeric decision confidence (0..1) onto the memory confidence enum. */
export function mapConfidenceToMemoryConfidence(confidence: number | undefined): MemoryConfidence {
  if (confidence === undefined || confidence === null) return 'medium';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

type MemoryPutInput = Parameters<typeof creativeMemoryStore.put>[0];

/**
 * Persist one CreativeMemory entry capturing what the agent produced — an
 * insight summary of the OUTPUT, never the raw prompt. Non-fatal: called after
 * the run already completed successfully.
 */
export async function persistAgentLearning(args: {
  workspaceId: string;
  missionId: string;
  agentId: string;
  runId: string;
  confidence: number | undefined;
  output: unknown;
}): Promise<void> {
  const { workspaceId, missionId, agentId, runId, confidence, output } = args;
  const summary =
    typeof output === 'string'
      ? output.slice(0, 500)
      : JSON.stringify(output ?? {}).slice(0, 500);
  const entry: MemoryPutInput = {
    workspaceId,
    category: 'creative',
    key: `agent_learning_${agentId}`,
    value: { agentId, runId, insight: summary },
    confidence: mapConfidenceToMemoryConfidence(confidence),
    source: 'agent',
    evidence: JSON.stringify([runId, missionId]),
    scope: 'campaign',
    scopeId: missionId,
    isDeleted: false,
  };
  try {
    const result = await creativeMemoryStore.put(entry);
    if (!result.ok) {
      logger.warn('[agent-context] failed to persist agent learning (non-fatal)', {
        workspaceId, runId, error: result.error?.message ?? 'unknown',
      });
      return;
    }
    // ── SIDE-CHANNEL: memory.used (Q5) — non-fatal, scope stays campaign/missionId.
    await emitMemoryUsed({
      workspaceId,
      missionId,
      agentId,
      runId,
      confidence: mapConfidenceToMemoryConfidence(confidence),
      memoryCount: 1,
      recordedAt: Date.now(),
    });
  } catch (err) {
    logger.warn('[agent-context] agent learning write threw (non-fatal)', {
      workspaceId, runId, error: err instanceof Error ? err.message : String(err),
    });
  }
}
