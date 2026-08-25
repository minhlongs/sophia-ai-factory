/**
 * AgentExecutor — runs an AgentDefinition against an AgentContext and
 * produces an AgentResult, wired through the existing provider abstraction
 * and autonomy/approval gates.
 *
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/agent-protocol
 */

import { ProviderRegistry } from '@/seed/ai/provider-registry';
import type { ChatMessage } from '@/seed/ai/provider-interface';
import type {
  AgentDefinition,
  AgentContext,
  AgentDecision,
  AgentAction,
  AgentResult,
  CreativeIdentity,
} from '@/seed/types/creative-domain';
import { isActionAllowed } from '@/tree/autonomy/autonomy-repo';
import { recordProvenance } from '@/tree/provenance/index';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { resolveModelForCapability } from '@/tree/agent-protocol';
import { getModelPricing, estimateCost } from '@/seed/ai/cost-estimator';

// ─── Executor types ─────────────────────────────────────────────────────────

export type ExecutorErrorCode =
  | 'NO_PROVIDER'
  | 'NO_PROVIDER_HEALTHY'
  | 'AUTONOMY_DENIED'
  | 'PROVIDER_ERROR'
  | 'BUDGET_EXCEEDED'
  | 'EXECUTION_FAILED';

export class ExecutorError extends Error {
  code: ExecutorErrorCode;
  constructor(code: ExecutorErrorCode, message: string) {
    super(message);
    this.name = 'ExecutorError';
    this.code = code;
  }
}

/**
 * Execution result enriched with token accounting for D1 agent_runs
 * bookkeeping. Extends the canonical AgentResult with totalTokens and the
 * decision the executor committed to (consumed downstream for memory
 * persistence confidence).
 */
export interface AgentExecutionResult extends AgentResult {
  /** Total tokens consumed (input + output) across the provider call. */
  totalTokens: number;
  /** Decision built during execution — carries confidence for memory write-back. */
  decision?: AgentDecision;
}

/**
 * Render a compact identity block for the system prompt (Constitution §6:
 * every agent must respect workspace creative identity). Deliberately
 * truncated — voice/tone/beliefs/constraints only, no raw dumps.
 */
export function buildIdentityBlock(identity: CreativeIdentity): string {
  const lines: string[] = [
    'CREATIVE IDENTITY (must be respected in all output):',
    `- Voice: ${identity.voiceDescription}`,
    `- Tone: ${identity.tone} (formality ${identity.formality}, energy ${identity.energy})`,
  ];
  if (identity.beliefs.length > 0) {
    lines.push(`- Beliefs: ${identity.beliefs.slice(0, 5).join('; ')}`);
  }
  if (identity.positioning) {
    lines.push(`- Positioning: ${identity.positioning}`);
  }
  if (identity.targetAudience) {
    lines.push(`- Target audience: ${identity.targetAudience}`);
  }
  if (identity.forbiddenPatterns.length > 0) {
    lines.push(`- Forbidden patterns (NEVER use): ${identity.forbiddenPatterns.slice(0, 10).join('; ')}`);
  }
  if (identity.requiredDisclosures.length > 0) {
    lines.push(`- Required disclosures (MUST include): ${identity.requiredDisclosures.join('; ')}`);
  }
  return lines.join('\n');
}

/**
 * Build the chat message array for an agent run. Identity-first prompting
 * (Constitution §6): when the workspace has an active CreativeIdentity it
 * leads the prompt as a system block. Without one the legacy two-message
 * shape is preserved byte-for-byte.
 */
export function buildAgentMessages(
  definition: AgentDefinition,
  context: AgentContext,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (context.creativeIdentity) {
    messages.push({ role: 'system', content: buildIdentityBlock(context.creativeIdentity) });
  }
  messages.push(
    { role: 'system', content: definition.role },
    { role: 'user', content: JSON.stringify(context.memory?.slice(0, 5) ?? {}) },
  );
  return messages;
}

// ─── Executor ────────────────────────────────────────────────────────────────

/**
 * Execute a single agent run.
 *
 * Flow:
 * 1. Resolve autonomy level for the workspace/agent type.
 * 2. For each permission in the definition, verify autonomy gate.
 * 3. Pick a healthy provider from the registry.
 * 4. Build a decision + action set from the agent's input.
 * 5. Run the provider chat() call.
 * 6. Record provenance for the generated artifact.
 * 7. Return AgentResult.
 *
 * Deterministic: provider calls are the only non-deterministic step; all
 * bookkeeping (provenance, autonomy, budget) is deterministic.
 */
export async function executeAgent(
  definition: AgentDefinition,
  context: AgentContext,
  registry: ProviderRegistry,
): Promise<Result<AgentExecutionResult, ExecutorError>> {
  const startedAt = Date.now();
  const correlationId = context.correlationId;

  // ── 1. Autonomy gate ──────────────────────────────────────────────────
  const autonomyResult = await isActionAllowed(
    context.workspaceId,
    'execute_agent',
    definition.id,
  );
  if (!autonomyResult) {
    logger.warn('[AgentExecutor] autonomy denied', { correlationId, agentId: definition.id });
    return failure(
      new ExecutorError(
        'AUTONOMY_DENIED',
        `Agent ${definition.id} denied by autonomy gate for workspace ${context.workspaceId}`,
      ),
    );
  }

  // ── 1b. Per-permission enforcement ─────────────────────────────────────
  // The agent-level gate only covers the agent's own existence. Every
  // declared permission must independently pass the autonomy gate, and any
  // permission requiring human approval must be backed by an approved action
  // id in the context. Fail closed: a missing or denied permission blocks the
  // run before any provider call.
  const approvedActionIds = new Set(context.approvedActionIds ?? []);
  for (const permission of definition.permissions) {
    const allowed = await isActionAllowed(
      context.workspaceId,
      permission.tool,
      definition.id,
    );
    if (!allowed) {
      logger.warn('[AgentExecutor] tool permission denied', {
        correlationId,
        tool: permission.tool,
        agentId: definition.id,
      });
      return failure(
        new ExecutorError(
          'AUTONOMY_DENIED',
          `Tool ${permission.tool} is not allowed for workspace ${context.workspaceId}`,
        ),
      );
    }
    if (permission.requiresApproval && !approvedActionIds.has(permission.tool)) {
      logger.warn('[AgentExecutor] approval required but missing', {
        correlationId,
        tool: permission.tool,
        agentId: definition.id,
      });
      return failure(
        new ExecutorError(
          'AUTONOMY_DENIED',
          `Tool ${permission.tool} requires approval that is not present in context`,
        ),
      );
    }
  }

  // ── 2. Budget check ───────────────────────────────────────────────────
  const estimatedCostCents = definition.permissions.reduce(
    (sum, p) => sum + (p.maxCostCents ?? 0),
    0,
  );
  if (estimatedCostCents > context.budgetRemainingCents) {
    return failure(
      new ExecutorError(
        'BUDGET_EXCEEDED',
        `Estimated cost ${estimatedCostCents}c exceeds remaining budget ${context.budgetRemainingCents}c`,
      ),
    );
  }

  // ── 3. Provider selection ─────────────────────────────────────────────
  const healthy = registry.getHealthy();
  if (healthy.length === 0) {
    return failure(
      new ExecutorError(
        'NO_PROVIDER',
        'No AI providers configured for this workspace. Open Setup Wizard and add your AI provider API key to start missions.',
      ),
    );
  }
  const provider = healthy[0].provider;

  // ── 4. Build decision + action ────────────────────────────────────────
  const decision: AgentDecision = {
    type: 'execute',
    reasoning: `Agent ${definition.name} (${definition.role}) executing with provider ${provider.id}`,
    confidence: 0.8,
    requiresHumanApproval: definition.permissions.some((p) => p.requiresApproval),
  };

  const actions: AgentAction[] = definition.permissions.map((p) => ({
    type: 'tool_call',
    tool: p.tool,
    parameters: { scopes: p.scopes },
    estimatedCostCents: p.maxCostCents,
    approvalRequired: p.requiresApproval,
  }));

  // Resolve the model once for both the provider call and cost estimation.
  const resolvedModel = resolveModelForCapability(definition.modelPolicy?.capability ?? 'text');

  // ── 5. Provider call ──────────────────────────────────────────────────
  const messages = buildAgentMessages(definition, context);

  let response;
  try {
    response = await provider.chat(messages, {
      model: resolvedModel,
      apiKey: '',
      maxTokens: 2048,
      timeoutMs: definition.timeoutMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    logger.error('[AgentExecutor] provider call failed', { correlationId, error: message });
    return failure(new ExecutorError('PROVIDER_ERROR', message));
  }

  // ── 6. Provenance ─────────────────────────────────────────────────────
  let provenanceRecordId: string | undefined;
  try {
    const prov = await recordProvenance({
      id: '',
      workspaceId: context.workspaceId,
      assetId: `agent-run:${definition.id}`,
      agentRunId: correlationId,
      action: 'generated',
      actorType: 'agent',
      actorId: definition.id,
      model: response.model,
      metadata: {
        provider: response.provider,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        latencyMs: response.latencyMs,
        decision: decision.type,
        actions: actions.map((a) => a.tool),
      },
      createdAt: 0,
    });
    provenanceRecordId = prov.id;
  } catch (err) {
    logger.warn('[AgentExecutor] provenance record failed (non-fatal)', {
      correlationId,
      error: err instanceof Error ? err.message : 'unknown',
    });
  }

  // ── 7. Result ─────────────────────────────────────────────────────────
  const durationMs = Date.now() - startedAt;

  // Compute cost using seed cost estimator
  const pricing = getModelPricing(resolvedModel, response.provider);
  let costCents: number;
  if (pricing) {
    // estimateCost returns USD; convert to cents
    const costUsd = estimateCost(
      messages,
      resolvedModel,
      { maxTokens: 2048, providerId: response.provider },
    );
    costCents = Math.round(costUsd * 100);
  } else {
    // Fallback to existing formula when model not in pricing table
    const totalTokens = response.usage.inputTokens + response.usage.outputTokens;
    costCents = Math.ceil(totalTokens * 0.001 * 100);
    logger.warn('[AgentExecutor] model not in pricing table, used fallback', { model: resolvedModel });
  }

  const result: AgentExecutionResult = {
    success: true,
    output: response.content,
    artifacts: [provenanceRecordId ?? `agent-run:${definition.id}`],
    costCents,
    durationMs,
    provenanceRecordId,
    totalTokens: response.usage.inputTokens + response.usage.outputTokens,
    decision,
  };

  logger.info('[AgentExecutor] agent completed', {
    correlationId,
    agentId: definition.id,
    durationMs,
    costCents: result.costCents,
  });

  return success(result);
}