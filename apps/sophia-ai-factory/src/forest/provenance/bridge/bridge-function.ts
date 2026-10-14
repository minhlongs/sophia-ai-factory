import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getAgentRun } from '@/tree/mission/agent-run-repo';
import { recordProvenance } from '@/tree/provenance';
import { recordLearning } from '@/tree/creative-memory';
import type { ProvenanceBridgeEventData, ProvenanceBridgeResult } from './types';
import { extractArtifacts } from './artifact-extractor';
import { buildRunLevelRecord, buildArtifactRecord } from './record-builder';

export const provenanceBridge = inngest.createFunction(
  {
    id: 'provenance-bridge',
    retries: 2,
  },
  { event: 'agent.mission.completed' },
  async ({ event, step }): Promise<ProvenanceBridgeResult> => {
    const data = event.data as ProvenanceBridgeEventData;
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
        const record = buildRunLevelRecord(runId, workspaceId, data, now);
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
        const record = buildArtifactRecord(artifact, runId, workspaceId, data, now);
        if (!record) {
          logger.warn('provenanceBridge: artifact missing id, skipping', { runId });
          continue;
        }
        try {
          await recordProvenance(record);
          ids.push(record.id);
        } catch (err) {
          logger.error('provenanceBridge: artifact record failed', {
            runId,
            assetId: record.assetId,
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
