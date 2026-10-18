/**
 * Agent Mission Executor — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Consumes `agent.mission.started`, runs the canonical tree/agent-protocol
 * executor, emits completion/failure via agent-mission-lifecycle.ts, and
 * hands successful missions to human review (never self-completes).
 * @module forest/inngest/functions/agent-ops/agent-mission-job
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { executeAgent } from '@/tree/agent-protocol';
import { updateAgentRun, type UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { initAgentRun } from '../agent-context';
import {
  createAgentLogger,
  handleMissionSuccess,
  handleMissionFailure,
} from './step-orchestrator';
import { prepareAgentMissionExecution } from './agent-mission-prep';

export const agentMissionExecutor = inngest.createFunction(
  {
    id: 'agent-mission-executor',
    retries: 0,
  },
  { event: 'agent.mission.started' },
  async ({ event, step }) => {
    const { runId, agentId, missionId, workspaceId, autonomyLevel, inputJson } = event.data;

    logger.info('agentMissionExecutor: started', { runId, agentId, missionId, workspaceId });

    // Step 1: Initialize AgentRun in D1 — resume-aware
    const run = await initAgentRun({ runId, agentId, workspaceId, missionId, autonomyLevel, inputJson });
    const log = createAgentLogger(runId, run.phase);

    // Step 2: Mark as running
    const startPatch: UpdateAgentRunInput = {
      status: 'running',
      phase: 'executing',
      startedAt: Math.floor(Date.now() / 1000),
    };
    const startResult = await updateAgentRun(runId, startPatch);
    if (!startResult.ok) {
      logger.error('agentMissionExecutor: failed to mark run started', {
        runId,
        error: startResult.error,
      });
    }
    log('info', 'Agent run started', { autonomyLevel });

    // Steps 3-7: Resolve definition, mission budget, BYOK providers, and AgentContext
    const { definition, mission, providerResult, context } = await prepareAgentMissionExecution({
      runId,
      agentId,
      missionId,
      workspaceId,
      autonomyLevel,
    });

    // Step 8: Execute through canonical tree/agent-protocol executor
    try {
      const execution = await step.run('execute-agent', async () =>
        executeAgent(definition, context, providerResult.registry)
      );

      if (execution.ok) {
        const result = execution.value;
        await handleMissionSuccess({
          runId,
          agentId,
          missionId,
          creatorId: mission.creatorId,
          workspaceId,
          costCents: result.costCents,
          totalTokens: result.totalTokens,
          output: result.output,
          confidence: result.decision?.confidence,
        });

        logger.info('agentMissionExecutor: completed', {
          runId,
          totalCostCents: result.costCents,
          totalTokens: result.totalTokens,
        });
        return { success: true, data: { runId, status: 'completed' } };
      }

      const executorError = execution.error;
      await handleMissionFailure(runId, agentId, missionId, executorError.code, executorError.message);
      logger.error('agentMissionExecutor: failed', {
        runId,
        errorCode: executorError.code,
        errorMessage: executorError.message,
      });
      return { success: false, error: { code: executorError.code, message: executorError.message } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('agentMissionExecutor: exception', { runId, error: message });
      await handleMissionFailure(runId, agentId, missionId, 'RUNTIME_ERROR', message);
      throw err;
    }
  }
);
