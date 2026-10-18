import { ProviderRegistry } from '@/seed/ai/provider-registry';
import type {
  AgentDefinition,
  AgentContext,
  AgentDecision,
  AgentAction,
} from '@/seed/types/creative-domain';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { resolveModelForCapability } from '../builtin-agents';
import { ExecutorError, type AgentExecutionResult } from './types';
import { buildAgentMessages } from './prompt-builder';
import { isGateAllowed, verifyAgentPermissions } from './gate-verifier';
import {
  recordAgentExecutionProvenance,
  buildAgentExecutionResult,
} from './executor-provenance-helper';

export async function executeAgent(
  definition: AgentDefinition,
  context: AgentContext,
  registry: ProviderRegistry,
): Promise<Result<AgentExecutionResult, ExecutorError>> {
  const startedAt = Date.now();
  const correlationId = context.correlationId;

  // ── 1. Autonomy gate ──────────────────────────────────────────────────
  const autonomyResult = await isGateAllowed(context, definition.id, 'execute_agent');
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
  const permCheck = await verifyAgentPermissions(definition, context);
  if (!permCheck.ok) {
    return failure(permCheck.error);
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

  const resolvedModel = resolveModelForCapability(definition.modelPolicy?.capability ?? 'text');
  const messages = buildAgentMessages(definition, context);

  // ── 5. Provider call ──────────────────────────────────────────────────
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

  // ── 6. Provenance & Result ────────────────────────────────────────────
  const provenanceRecordId = await recordAgentExecutionProvenance({
    definition,
    context,
    response,
    decision,
    actions,
  });

  const durationMs = Date.now() - startedAt;
  const result = buildAgentExecutionResult({
    definition,
    resolvedModel,
    messages,
    response,
    decision,
    provenanceRecordId,
    durationMs,
  });

  logger.info('[AgentExecutor] agent completed', {
    correlationId,
    agentId: definition.id,
    durationMs,
    costCents: result.costCents,
  });

  return success(result);
}
