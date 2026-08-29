/**
 * Production Graph Runner — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Consumes `production.graph.started`, executes the graph node-by-node in
 * topological order via the canonical tree/agent-protocol executor, and
 * emits `production.graph.completed` / `production.graph.failed` / `production.graph.cancelled`.
 *
 * Resume: completed nodes are skipped from the persisted node_states_json
 * checkpoint. Publish nodes whose effective policy requires approval pause
 * on the approval gate before executing.
 *
 * Deterministic mode: when `deterministic=true` in event data, uses injectable
 * time source (fixed timestamp) and fixed random seed for reproducible execution.
 *
 * Cancellation: checks for cancellation status at each node boundary and
 * emits `production.graph.cancelled` when cancelled via API.
 *
 * Follows the agent-mission-executor pattern: provider building and agent
 * execution run directly (non-serializable objects never cross step.run);
 * step.run wraps only serializable DB flips, step.sendEvent emits events.
 *
 * Registration is owned by the wiring layer (functions/index.ts) — this
 * module only exports the function.
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type { Result } from '@/seed/types/result';
import type { AgentContext } from '@/seed/types/creative-domain';
import type {
  ProductionGraphRunError,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
  ProductionGraphCancelledEvent,
} from '@/seed/types/production-factory';
import { executeAgent, agentDefinitionRegistry } from '@/tree/agent-protocol';
import { PUBLISH_CONTENT_TOOL } from '@/tree/agent-protocol/graph-agents';
import { buildProviders } from '@/forest/ai/provider-factory';
import { getMission, recordSpend } from '@/tree/mission/repository';
import { newPerformanceEventId, recordPerformanceEvent } from '@/tree/performance';
import { resolveEffectiveAutonomy } from '@/tree/autonomy/effective-autonomy';
import {
  getGraphById,
  getRun,
  updateRunStatus,
  setNodeStates,
  completeRun,
  failRun,
} from '@/tree/production-graph/repo';
import { validateGraphDefinition } from '@/tree/production-graph/validate';
import {
  hydrateNodeStates,
  serializeNodeStates,
  type GraphNodeRuntimeState,
} from '@/tree/production-graph/types';
import {
  toAutonomyLevel,
  initAgentRun,
  loadWorkspaceIdentity,
  loadMissionMemories,
} from './agent-context';
import { advanceMissionToReview } from './agent-mission-lifecycle';
import { requestApprovalAndAwait } from './agent-approval-gate';
import type { ApprovalDecision, ApprovalGateStep } from './agent-approval-gate';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h human review window
const EXECUTING_PHASE: ProductionGraphRunPhase = 'executing';
const PUBLISHING_PHASE: ProductionGraphRunPhase = 'publishing';

/** Deterministic mode fixed timestamp (epoch ms). */
const DETERMINISTIC_TIMESTAMP = 1_700_000_000_000; // 2023-11-14 fixed time

/** Failure codes emitted on production.graph.failed. */
export type GraphRunnerErrorCode =
  | 'RUN_NOT_FOUND'
  | 'GRAPH_NOT_FOUND'
  | 'INVALID_GRAPH'
  | 'MISSION_NOT_FOUND'
  | 'BUDGET_EXCEEDED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_TIMEOUT'
  | 'NODE_FAILED'
  | 'DB_ERROR'
  | 'CANCELLED';

/** Minimal structural step surface the helpers need (Inngest step satisfies it). */
interface EmitStep {
  sendEvent(
    id: string,
    payload:
      | {
          name: 'production.graph.failed';
          data: {
            graphRunId: string;
            graphId: string;
            missionId: string;
            workspaceId: string;
            errorCode: string;
            errorMessage: string;
            retryCount: number;
          };
        }
      | {
          name: 'production.graph.cancelled';
          data: {
            graphRunId: string;
            graphId: string;
            missionId: string;
            workspaceId: string;
            cancelledAt: number;
            reason?: string;
          };
        },
  ): Promise<unknown>;
}

/** Context passed through the execution loop for deterministic mode. */
interface RunnerContext {
  deterministic: boolean;
  nowMs: () => number;
  getRun: (runId: string) => Promise<
    Result<import('@/seed/types/production-factory').ProductionGraphRun | null, import('@/tree/production-graph/repo').GraphRepoError>
  >;
  graphRunId: string;
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export const productionGraphRunner = inngest.createFunction(
  { id: 'production-graph-runner', retries: 1 },
  { event: 'production.graph.started' },
  async ({ event, step }) => {
    const {
      graphRunId,
      graphId,
      missionId,
      workspaceId,
      missionType,
      retryCount,
      deterministic = false,
    } = event.data;
    const logCtx = { graphRunId, graphId, missionId, workspaceId };

    // Deterministic mode: inject fixed time source
    const nowMs = deterministic ? () => DETERMINISTIC_TIMESTAMP : Date.now;

    // Step 1: Load run + graph + mission.
    const run = await getRun(graphRunId);
    if (!run.ok || !run.value) {
      await emitFailed(step, logCtx, { code: 'RUN_NOT_FOUND', message: `Run ${graphRunId} not found` }, retryCount);
      return { ok: false as const, code: 'RUN_NOT_FOUND' };
    }

    const graph = await getGraphById(graphId);
    if (!graph.ok || !graph.value) {
      const error: ProductionGraphRunError = { code: 'GRAPH_NOT_FOUND', message: `Graph ${graphId} not found` };
      await failTerminal(graphRunId, run.value.status, error);
      await emitFailed(step, logCtx, error, retryCount);
      return { ok: false as const, code: 'GRAPH_NOT_FOUND' };
    }

    const mission = await getMission(missionId);
    if (!mission) {
      const error: ProductionGraphRunError = { code: 'MISSION_NOT_FOUND', message: `Mission ${missionId} not found` };
      await failTerminal(graphRunId, run.value.status, error);
      await emitFailed(step, logCtx, error, retryCount);
      return { ok: false as const, code: 'MISSION_NOT_FOUND' };
    }

    // Step 2: Validate the definition against registered agent slugs.
    const knownSlugs = new Set(agentDefinitionRegistry.list().map((d) => d.id));
    const validated = validateGraphDefinition(graph.value.definition, knownSlugs);
    if (!validated.ok) {
      const error: ProductionGraphRunError = {
        code: 'INVALID_GRAPH',
        message: validated.error.message,
        details: { validationCode: validated.error.code },
      };
      await failTerminal(graphRunId, run.value.status, error);
      await emitFailed(step, logCtx, error, retryCount);
      return { ok: false as const, code: 'INVALID_GRAPH' };
    }

    // Step 3: queued → running (guarded; a stale retry may have moved on).
    if (run.value.status === 'queued') {
      await step.run('flip-to-running', () =>
        updateRunStatus(graphRunId, 'queued', 'running', EXECUTING_PHASE),
      );
    }

    // Step 4: Resolve the effective autonomy policy (fail-closed default).
    const policy = await resolveEffectiveAutonomy({
      workspaceId,
      missionType,
      missionAutonomyLevel: mission.autonomyLevel,
    });

    // Step 5: Build per-run BYOK provider registry keyed to mission creator.
    // Direct call (not step.run) — the registry holds live provider objects
    // that must not cross Inngest's serialization boundary.
    const providerResult = await buildProviders({
      userId: mission.creatorId,
      providers: [
        { id: 'openrouter', label: 'OpenRouter' },
        { id: 'anthropic', label: 'Anthropic' },
      ],
      autoRegister: true,
    });
    const providerRegistry = providerResult.registry;

    // Step 6: Hydrate node states (resume-skip completed nodes).
    const states = hydrateNodeStates(validated.value.definition.nodes, run.value.nodeStates);
    let totalCostCents = run.value.totalCostCents;
    let totalTokens = run.value.totalTokens;

    // Runner context for cancellation checks
    const runnerContext: RunnerContext = {
      deterministic,
      nowMs,
      getRun,
      graphRunId,
    };

    // Step 7: Execute nodes in topological order.
    for (const nodeId of validated.value.topologicalOrder) {
      // Cancellation check at node boundary (before starting each node)
      const cancelCheck = await checkCancellation(runnerContext);
      if (cancelCheck.cancelled) {
        await handleCancellation(
          step,
          logCtx,
          cancelCheck.reason ?? 'Cancelled by user',
          retryCount,
          totalCostCents,
          totalTokens,
        );
        return { ok: false as const, code: 'CANCELLED' };
      }

      const state = states.get(nodeId);
      if (!state) continue;
      if (state.status === 'completed' || state.status === 'skipped') {
        logger.info('productionGraphRunner: node already done, skipping', {
          graphRunId,
          nodeId,
          status: state.status,
        });
        continue;
      }

      const definition = agentDefinitionRegistry.get(state.node.agentSlug);
      if (!definition) {
        const error: ProductionGraphRunError = {
          code: 'NODE_FAILED',
          message: `Agent ${state.node.agentSlug} not registered`,
          details: { nodeId },
        };
        markNodeFailed(states, nodeId, error.message ?? 'unknown', runnerContext.nowMs);
        await checkpoint(graphRunId, states);
        await failTerminal(graphRunId, 'running', error, { totalCostCents, totalTokens });
        await emitFailed(step, logCtx, error, retryCount);
        return { ok: false as const, code: 'NODE_FAILED' };
      }

      const isPublishNode = state.node.isPublishNode === true;
      const needsApproval = isPublishNode && policy.requiresApproval(PUBLISH_CONTENT_TOOL);

      // Approval gate before executing a gated publish node. Publish nodes
      // always carry the publish token in approvedActionIds — the executor
      // hard-fails requiresApproval permissions without it. The policy only
      // decides whether a human must approve first: full-auto tiers grant
      // the token directly, gated tiers grant it after approval.
      let approvedActionIds: string[] | undefined;
      if (needsApproval) {
        await step.run(`set-awaiting-${nodeId}`, () =>
          updateRunStatus(graphRunId, 'running', 'awaiting_approval', PUBLISHING_PHASE),
        );
        const decision = await requestApprovalAndAwait(
          {
            runId: graphRunId,
            missionId,
            actionId: PUBLISH_CONTENT_TOOL,
            actionType: PUBLISH_CONTENT_TOOL,
            actionSummary: `Publish node "${state.node.name ?? nodeId}" via agent ${state.node.agentSlug}`,
            timeoutMs: APPROVAL_TIMEOUT_MS,
          },
          { step: toApprovalGateStep(step) },
        );
        const gateOutcome = handleApprovalDecision(decision, graphRunId);
        if (gateOutcome !== 'approved') {
          const code: GraphRunnerErrorCode =
            gateOutcome === 'rejected' ? 'APPROVAL_REJECTED' : 'APPROVAL_TIMEOUT';
          const error: ProductionGraphRunError = {
            code,
            message: `Publish node ${nodeId} ${gateOutcome}`,
            details: { nodeId },
          };
          markNodeFailed(states, nodeId, error.message ?? gateOutcome, runnerContext.nowMs);
          await checkpoint(graphRunId, states);
          await failTerminal(graphRunId, 'awaiting_approval', error, { totalCostCents, totalTokens });
          await emitFailed(step, logCtx, error, retryCount);
          return { ok: false as const, code };
        }
        approvedActionIds = [PUBLISH_CONTENT_TOOL];
        await step.run(`resume-running-${nodeId}`, () =>
          updateRunStatus(graphRunId, 'awaiting_approval', 'running', PUBLISHING_PHASE),
        );
      } else if (isPublishNode) {
        approvedActionIds = [PUBLISH_CONTENT_TOOL];
      }

      // Budget guard before each node.
      const budgetRemainingCents = Math.max(0, mission.budgetCents - mission.spentCents - totalCostCents);
      if (budgetRemainingCents <= 0) {
        const error: ProductionGraphRunError = {
          code: 'BUDGET_EXCEEDED',
          message: 'Mission budget exhausted before node execution',
          details: { nodeId, totalCostCents },
        };
        await failTerminal(graphRunId, 'running', error, { totalCostCents, totalTokens });
        await emitFailed(step, logCtx, error, retryCount);
        return { ok: false as const, code: 'BUDGET_EXCEEDED' };
      }

      // Execute the node. Direct call — executeAgent returns Result with an
      // Error-class failure branch that must not cross step.run serialization.
      const agentRunId = `${graphRunId}:${nodeId}:${retryCount}`;
      state.status = 'running';
      state.agentRunId = agentRunId;
      state.startedAt = runnerContext.nowMs();

      await initAgentRun({
        runId: agentRunId,
        agentId: state.node.agentSlug,
        workspaceId,
        missionId,
        autonomyLevel: policy.storedLevel,
        inputJson: state.node.inputJson,
      });

      const creativeIdentity = await loadWorkspaceIdentity(workspaceId);
      const memory = await loadMissionMemories(mission);
      const context: AgentContext = {
        workspaceId,
        missionId,
        creativeIdentity,
        memory,
        autonomyLevel: toAutonomyLevel(policy.storedLevel),
        budgetRemainingCents,
        correlationId: agentRunId,
        approvedActionIds,
        effectivePolicy: policy,
      };

      const execution = await executeAgent(definition, context, providerRegistry);
      const endedAt = runnerContext.nowMs();

      if (!execution.ok || !execution.value.success) {
        const message = execution.ok
          ? (execution.value.error?.message ?? 'Agent returned success=false')
          : `${execution.error.code}: ${execution.error.message}`;
        const error: ProductionGraphRunError = {
          code: 'NODE_FAILED',
          message: `Node ${nodeId} failed: ${message}`,
          details: { nodeId, agentSlug: state.node.agentSlug },
        };
        state.status = 'failed';
        state.errorMessage = message;
        state.endedAt = endedAt;
        if (execution.ok) {
          totalCostCents += execution.value.costCents;
          totalTokens += execution.value.totalTokens;
        }
        await checkpoint(graphRunId, states);
        await failTerminal(graphRunId, 'running', error, { totalCostCents, totalTokens });
        await emitFailed(step, logCtx, error, retryCount);
        return { ok: false as const, code: 'NODE_FAILED' };
      }

      // Node succeeded — record spend, checkpoint, performance event.
      state.status = 'completed';
      state.outputJson = JSON.stringify(execution.value.output ?? null);
      state.endedAt = endedAt;
      totalCostCents += execution.value.costCents;
      totalTokens += execution.value.totalTokens;

      if (execution.value.costCents > 0) {
        await recordSpendSafe(missionId, execution.value.costCents);
      }
      await checkpoint(graphRunId, states);
      await recordNodePerformance({
        workspaceId,
        missionId,
        graphRunId,
        nodeId,
        agentSlug: state.node.agentSlug,
        costCents: execution.value.costCents,
        totalTokens: execution.value.totalTokens,
        durationMs: execution.value.durationMs,
        recordedAt: runnerContext.nowMs(),
      });
    }

    // Final cancellation check after all nodes complete (before marking complete)
    const finalCancelCheck = await checkCancellation(runnerContext);
    if (finalCancelCheck.cancelled) {
      await handleCancellation(
        step,
        logCtx,
        finalCancelCheck.reason ?? 'Cancelled by user',
        retryCount,
        totalCostCents,
        totalTokens,
      );
      return { ok: false as const, code: 'CANCELLED' };
    }

    // Step 8: Terminal success — complete run, emit, advance mission.
    const sinkId = validated.value.sinkIds[0];
    const sinkState = sinkId ? states.get(sinkId) : undefined;
    const outputJson = sinkState?.outputJson ?? null;

    await step.run('complete-run', () =>
      completeRun(graphRunId, 'running', { outputJson, totalCostCents, totalTokens }),
    );

    await step.sendEvent('emit-completed', {
      name: 'production.graph.completed',
      data: {
        graphRunId,
        graphId,
        missionId,
        workspaceId,
        totalCostCents,
        totalTokens,
      },
    });

    await advanceMissionToReview(missionId);

    logger.info('productionGraphRunner: graph run completed', {
      graphRunId,
      graphId,
      missionId,
      totalCostCents,
      totalTokens,
    });

    return { ok: true as const, totalCostCents, totalTokens };
  },
);

// ---------------------------------------------------------------------------
// Cancellation Helpers
// ---------------------------------------------------------------------------

/**
 * Check if the run has been cancelled by reading the current status from DB.
 * Returns { cancelled: true, reason } if cancelled, { cancelled: false } otherwise.
 */
async function checkCancellation(ctx: RunnerContext): Promise<{ cancelled: boolean; reason?: string }> {
  try {
    const runResult = await ctx.getRun(ctx.graphRunId);
    if (!runResult.ok || !runResult.value) {
      // Run not found — treat as not cancelled (will be handled as error elsewhere)
      return { cancelled: false };
    }
    if (runResult.value.status === 'cancelled') {
      const errorJson = runResult.value.errorJson;
      let reason = 'Cancelled by user';
      if (errorJson) {
        try {
          const parsed = JSON.parse(errorJson) as { message?: string; details?: { reason?: string } };
          reason = parsed.message ?? parsed.details?.reason ?? reason;
        } catch {
          // Ignore parse errors, use default reason
        }
      }
      return { cancelled: true, reason };
    }
    return { cancelled: false };
  } catch {
    // On DB error, assume not cancelled to avoid false positives
    return { cancelled: false };
  }
}

/**
 * Handle cancellation: mark run as cancelled, emit cancelled event, log.
 */
async function handleCancellation(
  step: EmitStep,
  logCtx: { graphRunId: string; graphId: string; missionId: string; workspaceId: string },
  reason: string,
  retryCount: number,
  totalCostCents: number,
  totalTokens: number,
): Promise<void> {
  logger.info('productionGraphRunner: graph run cancelled', {
    ...logCtx,
    reason,
    totalCostCents,
    totalTokens,
  });

  const cancelledAt = Date.now();

  // Emit production.graph.cancelled event
  await step.sendEvent('emit-cancelled', {
    name: 'production.graph.cancelled',
    data: {
      graphRunId: logCtx.graphRunId,
      graphId: logCtx.graphId,
      missionId: logCtx.missionId,
      workspaceId: logCtx.workspaceId,
      cancelledAt,
      reason,
    } as ProductionGraphCancelledEvent['data'],
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Adapt the Inngest step to the approval gate's step contract. The gate
 * only sends and awaits JSON-serializable event payloads, so Inngest's
 * Jsonify wrapper is structurally a no-op for every value that crosses
 * this boundary; the cast is confined to this single adapter.
 */
function toApprovalGateStep(step: unknown): ApprovalGateStep {
  return step as ApprovalGateStep;
}

/**
 * Map an approval decision to a gate outcome. 'skipped' is treated as
 * approved — the gate decided no approval was needed for this action.
 */
function handleApprovalDecision(
  decision: ApprovalDecision,
  graphRunId: string,
): 'approved' | 'rejected' | 'timeout' {
  switch (decision.outcome) {
    case 'approved':
      return 'approved';
    case 'skipped':
      logger.info('productionGraphRunner: approval gate skipped', { graphRunId, reason: decision.reason });
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'timeout':
      return 'timeout';
  }
}

/**
 * Persist the current node states as the resume checkpoint. Direct call —
 * the write is an idempotent full overwrite of node_states_json, so step
 * memoization adds nothing and its Jsonify return type would not satisfy
 * the serializable-result contract anyway.
 */
async function checkpoint(
  graphRunId: string,
  states: ReadonlyMap<string, GraphNodeRuntimeState>,
): Promise<void> {
  const result = await setNodeStates(graphRunId, serializeNodeStates(states));
  if (!result.ok) {
    logger.warn('productionGraphRunner: checkpoint write failed (non-fatal)', {
      graphRunId,
      error: result.error.message,
    });
  }
}

/** Mark a node failed in the in-memory state map. */
function markNodeFailed(
  states: Map<string, GraphNodeRuntimeState>,
  nodeId: string,
  errorMessage: string,
  nowMs: () => number,
): void {
  const state = states.get(nodeId);
  if (!state) return;
  state.status = 'failed';
  state.errorMessage = errorMessage;
  state.endedAt = nowMs();
}

/** Best-effort terminal failure write — never throws into the handler. */
async function failTerminal(
  graphRunId: string,
  expectedStatus: ProductionGraphRunStatus,
  error: ProductionGraphRunError,
  totals?: { totalCostCents: number; totalTokens: number },
): Promise<void> {
  try {
    await failRun(graphRunId, expectedStatus, error, totals ?? { totalCostCents: 0, totalTokens: 0 });
  } catch (err) {
    logger.error('productionGraphRunner: failTerminal write failed', {
      graphRunId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Non-fatal spend recording — a ledger write failure must not lose the run. */
async function recordSpendSafe(missionId: string, amountCents: number): Promise<void> {
  try {
    await recordSpend(missionId, amountCents);
  } catch (err) {
    logger.warn('productionGraphRunner: recordSpend failed (non-fatal)', {
      missionId,
      amountCents,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Non-fatal per-node performance event. */
async function recordNodePerformance(args: {
  workspaceId: string;
  missionId: string;
  graphRunId: string;
  nodeId: string;
  agentSlug: string;
  costCents: number;
  totalTokens: number;
  durationMs: number;
  recordedAt: number;
}): Promise<void> {
  try {
    await recordPerformanceEvent({
      id: newPerformanceEventId(),
      workspaceId: args.workspaceId,
      assetId: '',
      projectId: '',
      entityType: 'mission',
      entityId: args.missionId,
      channel: 'agent',
      eventType: 'graph_node_completed',
      count: 1,
      valueCents: args.costCents,
      rawData: {
        graphRunId: args.graphRunId,
        nodeId: args.nodeId,
        agentSlug: args.agentSlug,
        totalTokens: args.totalTokens,
        durationMs: args.durationMs,
      },
      recordedAt: args.recordedAt,
    });
  } catch (err) {
    logger.warn('productionGraphRunner: performance event failed (non-fatal)', {
      graphRunId: args.graphRunId,
      nodeId: args.nodeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Emit production.graph.failed with the structured error code. */
async function emitFailed(
  step: EmitStep,
  logCtx: { graphRunId: string; graphId: string; missionId: string; workspaceId: string },
  error: ProductionGraphRunError,
  retryCount: number,
): Promise<void> {
  logger.error('productionGraphRunner: graph run failed', {
    ...logCtx,
    code: error.code,
    message: error.message ?? error.code,
  });
  await step.sendEvent('emit-failed', {
    name: 'production.graph.failed',
    data: {
      graphRunId: logCtx.graphRunId,
      graphId: logCtx.graphId,
      missionId: logCtx.missionId,
      workspaceId: logCtx.workspaceId,
      errorCode: error.code,
      errorMessage: error.message ?? error.code,
      retryCount,
    },
  });
}