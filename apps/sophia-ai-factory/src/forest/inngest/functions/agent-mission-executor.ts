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
import { createAgentRun, getAgentRun, updateAgentRun, appendAgentLog } from '@/tree/mission/agent-run-repo';
import type { UpdateAgentRunInput } from '@/tree/mission/agent-run-repo';
import { getMission, recordSpend } from '@/tree/mission/repository';
import type { Mission } from '@/seed/types/creative-domain';
import type { AgentContext, AutonomyLevel, CreativeMemory } from '@/seed/types/creative-domain';
import { emitMissionCompleted, emitMissionFailed, advanceMissionToReview } from './agent-mission-lifecycle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp an arbitrary number into the valid AutonomyLevel range 0..4. */
function toAutonomyLevel(value: number | undefined): AutonomyLevel {
  if (value === undefined || value === null) return 0;
  const clamped = Math.min(4, Math.max(0, Math.round(value)));
  return clamped as AutonomyLevel;
}

/** Build a CreativeMemory entry from the mission brief. */
function buildMissionMemory(mission: Mission): CreativeMemory {
  const { objective, audience, constraints } = mission;
  return {
    id: `mission-brief-${mission.id}`,
    workspaceId: mission.workspaceId,
    category: 'creative',
    key: 'mission_brief',
    value: {
      objective,
      audience,
      constraints,
    },
    confidence: 'high',
    source: 'human_edit',
    evidence: JSON.stringify([mission.id]),
    scope: 'campaign',
    scopeId: mission.id,
    version: 1,
    isDeleted: false,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  };
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

    // Step 1: Initialize AgentRun in D1 — resume-aware
    // Cron retries re-dispatch the same runId; the row already exists with
    // status='running'|'retrying'. Creating a new row would PK-violate, so we
    // detect the existing row first and skip the INSERT on the resume path.
    const existingRun = await getAgentRun(runId);
    let run: { id: string; phase: string };

    if (existingRun.ok && existingRun.value) {
      const existing = existingRun.value;
      if (existing.status === 'running') {
        run = existing;
        logger.info('agentMissionExecutor: resumed existing agent run (retry)', {
          runId,
          previousRetryCount: existing.retryCount,
        });
      } else {
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
        run = created.value;
      }
    } else {
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
      run = created.value;
    }

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

    // Step 4: Fetch mission for real budget + BYOK owner + brief
    const mission = await getMission(missionId);
    if (!mission) {
      logger.error('agentMissionExecutor: mission not found', { runId, missionId });
      const failPatch: UpdateAgentRunInput = {
        status: 'failed',
        phase: 'failed',
        errorMessage: `Mission ${missionId} not found`,
        errorJson: { code: 'MISSION_NOT_FOUND', missionId },
        endedAt: Math.floor(Date.now() / 1000),
      };
      await updateAgentRun(runId, failPatch);
      throw new Error(`Mission ${missionId} not found`);
    }

    // Step 5: Compute real remaining budget — fail fast if exhausted
    const budgetDeltaCents = mission.budgetCents - mission.spentCents;
    const budgetRemainingCents = Math.max(0, budgetDeltaCents);
    if (budgetRemainingCents <= 0) {
      logger.error('agentMissionExecutor: budget exceeded', { runId, missionId, budgetRemainingCents, budgetDeltaCents });
      const failPatch: UpdateAgentRunInput = {
        status: 'failed',
        phase: 'failed',
        errorMessage: 'Mission budget exhausted',
        errorJson: { code: 'BUDGET_EXCEEDED', budgetRemainingCents: 0 },
        endedAt: Math.floor(Date.now() / 1000),
      };
      await updateAgentRun(runId, failPatch);
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

    // Step 7: Build the canonical AgentContext with real budget + mission brief
    const context: AgentContext = {
      workspaceId,
      missionId,
      memory: [buildMissionMemory(mission)],
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
      const failPatch: UpdateAgentRunInput = {
        status: 'failed',
        phase: 'failed',
        errorMessage: executorError.message,
        errorJson: { code: executorError.code, message: executorError.message },
        endedAt: Math.floor(Date.now() / 1000),
      };
      await updateAgentRun(runId, failPatch);
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
      await updateAgentRun(runId, {
        status: 'failed',
        phase: 'failed',
        errorMessage: message,
        errorJson: { code: 'RUNTIME_ERROR', message },
        endedAt: Math.floor(Date.now() / 1000),
      });
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