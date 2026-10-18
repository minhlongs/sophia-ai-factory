/**
 * Agent Executor Post-Execution Provenance and Cost Accounting
 */

import type {
  AgentDefinition,
  AgentContext,
  AgentDecision,
  AgentAction,
} from '@/seed/types/creative-domain';
import { recordProvenance } from '@/tree/provenance/index';
import { logger } from '@/seed/utils/logger-utility';
import { getModelPricing, estimateCost } from '@/seed/ai/cost-estimator';
import type { ChatMessage, ChatResponse } from '@/seed/ai/provider-interface';
import type { AgentExecutionResult } from './types';

export async function recordAgentExecutionProvenance(params: {
  definition: AgentDefinition;
  context: AgentContext;
  response: ChatResponse;
  decision: AgentDecision;
  actions: AgentAction[];
}): Promise<string | undefined> {
  const { definition, context, response, decision, actions } = params;
  const correlationId = context.correlationId;

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
    return prov.id;
  } catch (err) {
    logger.warn('[AgentExecutor] provenance record failed (non-fatal)', {
      correlationId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return undefined;
  }
}

export function buildAgentExecutionResult(params: {
  definition: AgentDefinition;
  resolvedModel: string;
  messages: ChatMessage[];
  response: ChatResponse;
  decision: AgentDecision;
  provenanceRecordId: string | undefined;
  durationMs: number;
}): AgentExecutionResult {
  const { definition, resolvedModel, messages, response, decision, provenanceRecordId, durationMs } = params;
  const pricing = getModelPricing(resolvedModel, response.provider);
  let costCents: number;

  if (pricing) {
    const costUsd = estimateCost(messages, resolvedModel, {
      maxTokens: 2048,
      providerId: response.provider,
    });
    costCents = Math.round(costUsd * 100);
  } else {
    const totalTokens = response.usage.inputTokens + response.usage.outputTokens;
    costCents = Math.ceil(totalTokens * 0.001 * 100);
    logger.warn('[AgentExecutor] model not in pricing table, used fallback', { model: resolvedModel });
  }

  return {
    success: true,
    output: response.content,
    artifacts: [provenanceRecordId ?? `agent-run:${definition.id}`],
    costCents,
    durationMs,
    provenanceRecordId,
    totalTokens: response.usage.inputTokens + response.usage.outputTokens,
    decision,
  };
}
