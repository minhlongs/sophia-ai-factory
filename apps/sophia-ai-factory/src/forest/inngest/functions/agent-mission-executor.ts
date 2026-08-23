/**
 * Agent Mission Executor — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Consumes `agent.mission.started` and runs the agent through the canonical
 * tree/agent-protocol executor. Bookkeeping (agent_runs rows + agent logs)
 * is written to D1 via tree/mission/agent-run-repo.
 *
 * @module forest/inngest/functions
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  executeAgent,
  agentDefinitionRegistry,
} from '@/tree/agent-protocol';
import { getSharedRegistry } from '@/forest/ai/provider-factory';
import {
  createAgentRun,
  updateAgentRun,
  appendAgentLog,
} from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import type { AgentContext, AutonomyLevel } from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

interface AgentMissionStartedData {
  runId: string;
  agentId: string;
  missionId: string;
  workspaceId: string;
  autonomyLevel?: number;
  inputJson?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp an arbitrary number into the valid AutonomyLevel range 0..4. */
function toAutonomyLevel(value: number | undefined): AutonomyLevel {
  if (value === undefined || value === null) return 0;
  const clamped = Math.min(4, Math.max(0, Math.round(value)));
  return clamped as AutonomyLevel;
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const agentMissionExecutor = inngest.createFunction(
  {
    id: 'agent-mission-executor',
    retries: 0,
  },
  { event: 'agent.mission.started' },
  async ({ event, step }) => {
    const data = event.data as AgentMissionStartedData;
    const { runId, agentId, missionId, workspaceId, autonomyLevel, inputJson } = data;

    logger.info('agentMissionExecutor: started', { runId, agentId, missionId, workspaceId });

    // Step 1: Initialize AgentRun in D1
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
      logger.error('agentMissionExecutor: failed to create agent_run', {
        runId,
        error: created.error,
      });
      throw new Error(
        `Failed to create agent_run: ${created.error?.message ?? 'unknown'}`
      );
    }

    const run = created.value;

    const log = (level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>) => {
      appendAgentLog({
        id: `${runId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        runId,
        phase: run.phase,
        level,
        message,
        metadata,
        timestamp: Math.floor(Date.now() / 1000),
      });
    };

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
      const failPatch: UpdateAgentRunInput = {
        status: 'failed',
        phase: 'failed',
        errorMessage: `Agent ${agentId} not registered`,
        errorJson: { code: 'AGENT_NOT_FOUND', agentId },
        endedAt: Math.floor(Date.now() / 1000),
      };
      await updateAgentRun(runId, failPatch);
      throw new Error(`Agent ${agentId} not registered`);
    }

    // Step 4: Build the canonical AgentContext
    const context: AgentContext = {
      workspaceId,
      missionId,
      memory: [],
      autonomyLevel: toAutonomyLevel(autonomyLevel),
      budgetRemainingCents: 50000,
      correlationId: runId,
    };

    // Step 5: Execute through the canonical tree/agent-protocol executor
    try {
      const providerRegistry = getSharedRegistry();
      const execution = await executeAgent(definition, context, providerRegistry);

      if (execution.ok) {
        const result = execution.value;
        const patch: UpdateAgentRunInput = {
          status: 'completed',
          phase: 'completed',
          outputJson: result.output as Record<string, unknown> | undefined,
          totalCostCents: result.costCents,
          totalTokens: result.totalTokens,
          endedAt: Math.floor(Date.now() / 1000),
        };
        await updateAgentRun(runId, patch);

        logger.info('agentMissionExecutor: completed', {
          runId,
          totalCostCents: result.costCents,
          totalTokens: result.totalTokens,
        });
        return { success: true, data: { runId, status: 'completed' } };
      }

      const executorError = execution.error;
      const failPatch: UpdateAgentRunInput = {
        status: 'failed',
        phase: 'failed',
        errorMessage: executorError.message,
        errorJson: { code: executorError.code, message: executorError.message },
        endedAt: Math.floor(Date.now() / 1000),
      };
      await updateAgentRun(runId, failPatch);

      logger.error('agentMissionExecutor: failed', {
        runId,
        errorCode: executorError.code,
        errorMessage: executorError.message,
      });
      return { success: false, error: { code: executorError.code, message: executorError.message } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('agentMissionExecutor: exception', { runId, error: message });
      await updateAgentRun(runId, {
        status: 'failed',
        phase: 'failed',
        errorMessage: message,
        errorJson: { code: 'RUNTIME_ERROR', message },
        endedAt: Math.floor(Date.now() / 1000),
      });
      throw err;
    }
  }
);
