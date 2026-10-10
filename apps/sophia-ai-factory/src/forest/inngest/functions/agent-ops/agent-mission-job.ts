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
import { executeAgent, agentDefinitionRegistry } from '@/tree/agent-protocol';
import { buildProviders } from '@/forest/ai/provider-factory';
import { updateAgentRun } from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { getMission } from '@/tree/mission/repository';
import type { AgentContext } from '@/seed/types/creative-domain';
import {
  toAutonomyLevel,
  initAgentRun,
  loadWorkspaceIdentity,
  loadMissionMemories,
} from '../agent-context';
import {
  markRunFailed,
  createAgentLogger,
  handleMissionSuccess,
  handleMissionFailure,
} from './step-orchestrator';

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

    // Step 3: Resolve the agent definition from the canonical registry
    const definition = agentDefinitionRegistry.get(agentId);
    if (!definition) {
      logger.error('agentMissionExecutor: agent not found in registry', { runId, agentId });
      await markRunFailed(runId, `Agent ${agentId} not registered`, { code: 'AGENT_NOT_FOUND', agentId });
      throw new Error(`Agent ${agentId} not registered`);
    }

    // Step 4: Fetch mission for real budget + BYOK owner + brief
    const mission = await getMission(missionId);
    if (!mission) {
      logger.error('agentMissionExecutor: mission not found', { runId, missionId });
      await markRunFailed(runId, `Mission ${missionId} not found`, { code: 'MISSION_NOT_FOUND', missionId });
      throw new Error(`Mission ${missionId} not found`);
    }

    // Step 5: Compute real remaining budget — fail fast if exhausted
    const budgetDeltaCents = mission.budgetCents - mission.spentCents;
    const budgetRemainingCents = Math.max(0, budgetDeltaCents);
    if (budgetRemainingCents <= 0) {
      logger.error('agentMissionExecutor: budget exceeded', { runId, missionId, budgetRemainingCents, budgetDeltaCents });
      await markRunFailed(runId, 'Mission budget exhausted', { code: 'BUDGET_EXCEEDED', budgetRemainingCents: 0 });
      throw new Error('Mission budget exhausted');
    }

    // Step 6: Build per-run BYOK provider registry keyed to mission creator
    const providerResult = await buildProviders({
      userId: mission.creatorId,
      providers: [
        { id: 'openrouter', label: 'OpenRouter' },
        { id: 'anthropic', label: 'Anthropic' },
      ],
      autoRegister: true,
    });

    // Step 7: Build canonical AgentContext
    const creativeIdentity = await loadWorkspaceIdentity(workspaceId);
    const memory = await loadMissionMemories(mission);

    const context: AgentContext = {
      workspaceId,
      missionId,
      creativeIdentity,
      memory,
      autonomyLevel: toAutonomyLevel(autonomyLevel),
      budgetRemainingCents,
      correlationId: runId,
    };

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
