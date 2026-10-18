/**
 * Memory loading and learning persistence helpers for agent context.
 * @module forest/inngest/functions/agent-context-memory
 */

import { logger } from '@/seed/utils/logger-utility';
import { getActiveIdentity } from '@/tree/creative-identity';
import { creativeMemoryStore } from '@/tree/creative-memory';
import type {
  CreativeIdentity,
  CreativeMemory,
  Mission,
} from '@/seed/types/creative-domain';
import {
  mapConfidenceToMemoryConfidence,
  persistAgentLearning,
} from './agent-context-learning';

export { mapConfidenceToMemoryConfidence, persistAgentLearning };

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
