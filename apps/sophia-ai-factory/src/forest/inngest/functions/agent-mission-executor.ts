/**
 * Agent Mission Executor — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Consumes `agent.mission.started`, runs the canonical tree/agent-protocol
 * executor, emits completion/failure via agent-mission-lifecycle.ts, and
 * hands successful missions to human review (never self-completes).
 */
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { executeAgent, agentDefinitionRegistry } from '@/tree/agent-protocol';
import { buildProviders } from '@/forest/ai/provider-factory';
import { updateAgentRun, appendAgentLog } from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { getMission, recordSpend } from '@/tree/mission/repository';
import { newPerformanceEventId, recordPerformanceEvent } from '@/tree/performance';
import type { AgentContext } from '@/seed/types/creative-domain';
import { emitMissionCompleted, emitMissionFailed, advanceMissionToReview } from './agent-mission-lifecycle';
import {
  toAutonomyLevel,
  initAgentRun,
  loadWorkspaceIdentity,
  loadMissionMemories,
  persistAgentLearning,
} from './agent-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Persist the failed terminal state for an agent run (best-effort). */
async function markRunFailed(
  runId: string,
  errorMessage: string,
  errorJson: Record<string, unknown>,
): Promise<void> {
  await updateAgentRun(runId, {
    status: 'failed',
    phase: 'failed',
    errorMessage,
    errorJson,
    endedAt: Math.floor(Date.now() / 1000),
  });
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
    // Typed by the merged seed schema (EventSchemas.fromRecord<Events>) —
    // payload keys compile-checked against AgentMissionStartedData.
    const { runId, agentId, missionId, workspaceId, autonomyLevel, inputJson } = event.data;

    logger.info('agentMissionExecutor: started', { runId, agentId, missionId, workspaceId });

    // Step 1: Initialize AgentRun in D1 — resume-aware. Throws on create
    // failure so Inngest retries; resumes an existing 'running' row instead of
    // PK-violating on cron re-dispatch.
    const run = await initAgentRun({ runId, agentId, workspaceId, missionId, autonomyLevel, inputJson });

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
    const providerRegistry = providerResult.registry;

    // Step 7: Build the canonical AgentContext with real budget, workspace
    // creative identity, and merged memory (mission brief + stored entries).
    // Both loaders are non-fatal: failures degrade the run, never abort it.
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

    // Step 8: Execute through the canonical tree/agent-protocol executor
    try {
      const execution = await executeAgent(definition, context, providerRegistry);

      if (execution.ok) {
        const result = execution.value;

        // Mark the run completed FIRST — the durable record of success. A
        // later spend-recording failure must not flip a completed run to
        // failed; budget staleness is reconciled by the rollback cron.
        const patch: UpdateAgentRunInput = {
          status: 'completed',
          phase: 'completed',
          outputJson: result.output as Record<string, unknown> | undefined,
          totalCostCents: result.costCents,
          totalTokens: result.totalTokens,
          endedAt: Math.floor(Date.now() / 1000),
        };
        await updateAgentRun(runId, patch);

        // Record spend so subsequent runs see reduced budget
        try {
          await recordSpend(missionId, result.costCents);
        } catch (spendErr) {
          const spendMessage = spendErr instanceof Error ? spendErr.message : String(spendErr);
          logger.error('agentMissionExecutor: failed to record spend (budget stale, cron will reconcile)', {
            runId,
            missionId,
            costCents: result.costCents,
            error: spendMessage,
          });
        }

        // Persist the agent's learning as a CreativeMemory entry (non-fatal).
        // Confidence comes from the executor's decision; value is an insight
        // summary, never the raw prompt.
        await persistAgentLearning({
          workspaceId,
          missionId,
          agentId,
          runId,
          confidence: result.decision?.confidence,
          output: result.output,
        });

        try {
          await recordPerformanceEvent({
            id: newPerformanceEventId(),
            workspaceId,
            assetId: '',
            projectId: '',
            entityType: 'mission',
            entityId: missionId,
            channel: 'agent',
            eventType: 'mission_completed',
            count: 1,
            valueCents: result.costCents,
            rawData: { agentId, totalTokens: result.totalTokens, runId },
            recordedAt: Date.now(),
          });
        } catch (performanceErr) {
          const performanceMessage = performanceErr instanceof Error ? performanceErr.message : String(performanceErr);
          logger.error('agentMissionExecutor: failed to record performance event', {
            runId,
            missionId,
            error: performanceMessage,
          });
        }

        await emitMissionCompleted(inngest, {
          runId,
          agentId,
          missionId,
          totalCostCents: result.costCents,
          totalTokens: result.totalTokens,
        });
        // Machine hands artifacts to human review; never self-completes.
        await advanceMissionToReview(missionId);

        logger.info('agentMissionExecutor: completed', {
          runId,
          totalCostCents: result.costCents,
          totalTokens: result.totalTokens,
        });
        return { success: true, data: { runId, status: 'completed' } };
      }

      const executorError = execution.error;
      await markRunFailed(runId, executorError.message, {
        code: executorError.code,
        message: executorError.message,
      });
      // Mission status deliberately untouched on failure — rollback cron retries.
      await emitMissionFailed(inngest, {
        runId,
        agentId,
        missionId,
        errorCode: executorError.code,
        errorMessage: executorError.message,
      });

      logger.error('agentMissionExecutor: failed', {
        runId,
        errorCode: executorError.code,
        errorMessage: executorError.message,
      });
      return { success: false, error: { code: executorError.code, message: executorError.message } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('agentMissionExecutor: exception', { runId, error: message });
      await markRunFailed(runId, message, { code: 'RUNTIME_ERROR', message });
      await emitMissionFailed(inngest, {
        runId,
        agentId,
        missionId,
        errorCode: 'RUNTIME_ERROR',
        errorMessage: message,
      });
      throw err;
    }
  }
);