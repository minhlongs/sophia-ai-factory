/**
 * Agent Mission Executor — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions
 */

import { inngest } from '@/tree/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { AgentRunner } from '@/forest/agent-protocol/types';
import { agentRegistry } from '@/forest/agent-protocol/registry';
import {
  createAgentRun,
  updateAgentRun,
  appendAgentLog,
} from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { success, failure } from '@/seed/types/result';

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
    const { runId, agentId, missionId, workspaceId, autonomyLevel = 0, inputJson } = data;

    logger.info('agentMissionExecutor: started', { runId, agentId, missionId, workspaceId });

    // Step 1: Initialize AgentRun in D1
    const created = await createAgentRun({
      id: runId,
      agentId,
      workspaceId,
      missionId,
      autonomyLevel,
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

    // Step 3: Build context and runner
    const agentProto = agentRegistry.get(agentId);
    if (!agentProto) {
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

    const context = {
      agentId: agentProto.definition.id,
      workspaceId,
      missionId,
      autonomyLevel,
      userId: '',
      timestamp: Math.floor(Date.now() / 1000),
      credentials: {} as Record<string, unknown>,
      environment: {} as Record<string, unknown>,
      memory: {
        shortTerm: [] as unknown[],
        longTerm: [] as unknown[],
      },
    };

    const runner = new AgentRunner(
      agentProto as never,
      context as never,
      {
        autonomyLevel: autonomyLevel as 0 | 1 | 2 | 3 | 4,
        maxRetries: 1,
        timeoutMs: 1000 * 60 * 30,
        costLimitCents: 50000,
      }
    );

    // Attach getters expected by downstream consumers
    (runner as unknown as { getContext: () => typeof context }).getContext = () => context;
    (runner as unknown as { getRunId: () => string }).getRunId = () => runId;

    // Step 4: Execute
    try {
      // runner.execute returns AgentRun; cast through unknown to map to AgentRunRecord
      // because the two types are defined in separate layers with different field shapes.
      const executedRun = await (runner.execute({}) as unknown as Promise<{
        status: string;
        result?: { success: boolean; output?: unknown; error?: { code: string; message: string } };
        error?: { code: string; message: string };
        totalCostCents: number;
        totalTokens: number;
      }>);

      if (executedRun.status === 'completed') {
        const patch: UpdateAgentRunInput = {
          status: 'completed',
          phase: 'completed',
          outputJson: executedRun.result?.output as Record<string, unknown> | undefined,
          totalCostCents: executedRun.totalCostCents,
          totalTokens: executedRun.totalTokens,
          endedAt: Math.floor(Date.now() / 1000),
        };
        await updateAgentRun(runId, patch);

        logger.info('agentMissionExecutor: completed', { runId, totalCostCents: executedRun.totalCostCents, totalTokens: executedRun.totalTokens });
        return { success: true, data: { runId, status: 'completed' } };
      }

      const errorCode = executedRun.error?.code ?? executedRun.result?.error?.code ?? 'UNKNOWN';
      const errorMessage = executedRun.error?.message ?? executedRun.result?.error?.message ?? 'Agent run failed';

      const failPatch: UpdateAgentRunInput = {
        status: 'failed',
        phase: 'failed',
        errorMessage,
        errorJson: (executedRun.error ?? executedRun.result?.error) as Record<string, unknown> | undefined,
        endedAt: Math.floor(Date.now() / 1000),
      };
      await updateAgentRun(runId, failPatch);

      logger.error('agentMissionExecutor: failed', { runId, errorCode, errorMessage });
      return { success: false, error: { code: errorCode, message: errorMessage } };
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