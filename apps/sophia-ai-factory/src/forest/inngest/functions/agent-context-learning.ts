/**
 * Learning persistence helpers for agent context.
 * @module forest/inngest/functions/agent-context-learning
 */

import { logger } from '@/seed/utils/logger-utility';
import { creativeMemoryStore } from '@/tree/creative-memory';
import { emitMemoryUsed } from '@/tree/performance/loop-emitters-cost';
import type { MemoryConfidence } from '@/seed/types/creative-domain';

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
