/**
 * Provenance Bridge — Inngest function
 * Layer: forest (infrastructure orchestration)
 *
 * Bridges agent_runs → provenance_records.
 *
 * When an agent mission completes, this function:
 * 1. Loads the AgentRunRecord from D1
 * 2. Emits a ProvenanceRecord for every artifact the run produced
 *    (falling back to a run-level record when no explicit artifacts exist)
 * 3. Records a creative-memory learning entry so the creative economy
 *    flywheel (VISION → CREATE → DISTRIBUTE → MEASURE → LEARN → COMPOUND)
 *    can compound across runs.
 *
 * @module forest/provenance
 */

import { inngest } from '@/tree/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getAgentRun } from '@/tree/mission/agent-run-repo';
import { recordProvenance, newProvenanceId } from '@/tree/provenance';
import { recordLearning } from '@/tree/creative-memory';
import type { ProvenanceRecord } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shape of the artifacts block an agent may attach to its output. */
interface AgentOutputArtifacts {
  assets: Array<{
    id?: string;
    assetId?: string;
    type?: string;
    action?: ProvenanceRecord['action'];
    model?: string;
    modelVersion?: string;
    prompt?: string;
    sourceAssetId?: string;
    derivativeOf?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Extract the artifacts array from an agent run's outputJson.
 * Returns an empty array when the run produced no structured artifacts.
 */
function extractArtifacts(outputJson?: Record<string, unknown> | null): AgentOutputArtifacts['assets'] {
  if (!outputJson || !Array.isArray(outputJson.assets)) {
    return [];
  }
  return outputJson.assets as AgentOutputArtifacts['assets'];
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const provenanceBridge = inngest.createFunction(
  {
    id: 'provenance-bridge',
    retries: 2,
  },
  { event: 'agent.mission.completed' },
  async ({ event, step }) => {
    const data = event.data as {
      runId: string;
      agentId: string;
      missionId: string;
      totalCostCents: number;
      totalTokens: number;
    };
    const { runId, agentId, missionId } = data;

    logger.info('provenanceBridge: started', { runId, agentId, missionId });

    // Step 1: Load the AgentRunRecord
    const run = await step.run('load-agent-run', async () => {
      const result = await getAgentRun(runId);
      if (!result.ok) {
        logger.warn('provenanceBridge: agent run not found', {
          runId,
          code: result.error.code,
          message: result.error.message,
        });
        return null;
      }
      return result.value;
    });

    if (!run) {
      return { skipped: true, reason: 'AGENT_RUN_NOT_FOUND', runId };
    }

    const workspaceId = run.workspaceId;
    const artifacts = extractArtifacts(run.outputJson) ?? [];
    const now = Math.floor(Date.now() / 1000);

    // Step 2: Emit provenance records for every artifact
    const recordedIds: string[] = await step.run('record-provenance', async () => {
      const ids: string[] = [];
      if (artifacts.length === 0) {
        // Fall back to a run-level provenance record so the chain is never empty.
        const record: ProvenanceRecord = {
          id: newProvenanceId(),
          workspaceId,
          assetId: runId,
          agentRunId: runId,
          action: 'generated',
          actorType: 'agent',
          actorId: agentId,
          metadata: {
            missionId,
            totalCostCents: data.totalCostCents,
            totalTokens: data.totalTokens,
            source: 'provenance-bridge',
          },
          createdAt: now,
        };
        try {
          await recordProvenance(record);
          ids.push(record.id);
        } catch (err) {
          logger.error('provenanceBridge: run-level record failed', {
            runId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        return ids;
      }

      for (const artifact of artifacts) {
        const assetId = artifact.assetId ?? artifact.id;
        if (!assetId) {
          logger.warn('provenanceBridge: artifact missing id, skipping', { runId });
          continue;
        }
        const record: ProvenanceRecord = {
          id: newProvenanceId(),
          workspaceId,
          assetId,
          agentRunId: runId,
          action: artifact.action ?? 'generated',
          actorType: 'agent',
          actorId: agentId,
          model: artifact.model,
          modelVersion: artifact.modelVersion,
          prompt: artifact.prompt,
          sourceAssetId: artifact.sourceAssetId,
          derivativeOf: artifact.derivativeOf,
          metadata: {
            missionId,
            artifactType: artifact.type,
            ...(artifact.metadata ?? {}),
            source: 'provenance-bridge',
          },
          createdAt: now,
        };
        try {
          await recordProvenance(record);
          ids.push(record.id);
        } catch (err) {
          logger.error('provenanceBridge: artifact record failed', {
            runId,
            assetId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return ids;
    });

    // Step 3: Creative-memory learning entry (flywheel: LEARN → COMPOUND)
    await step.run('record-learning', async () => {
      try {
        await recordLearning(
          workspaceId,
          'provenance',
          `agent-run:${runId}`,
          {
            agentId,
            missionId,
            artifactCount: recordedIds.length,
            provenanceRecordIds: recordedIds,
            totalCostCents: data.totalCostCents,
            totalTokens: data.totalTokens,
          },
          `agent.mission.completed provenance bridge recorded ${recordedIds.length} artifact(s)`,
        );
      } catch (err) {
        // Non-fatal: memory is a learning signal, not a correctness gate.
        logger.warn('provenanceBridge: learning record failed (non-fatal)', {
          runId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    logger.info('provenanceBridge: complete', {
      runId,
      recordedCount: recordedIds.length,
    });

    return {
      success: true,
      runId,
      workspaceId,
      recordedCount: recordedIds.length,
      provenanceRecordIds: recordedIds,
    };
  },
);