/**
 * Variant parameter resolution and outcome persistence helpers for Agent Runner.
 * @module forest/agents/agent-runner-helpers
 */

import { updateTaskResult, appendLog } from './repository';
import { reportError } from '@/seed/observability/telemetry/error-tracker';
import { recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { track } from '@/tree/signals/track';
import { assignVariant } from '@/tree/signals/ab-experiment';
import { D1Events } from '@/tree/signals/d1-event-types';

export async function resolveAgentVariantConfig(
  agentId: string,
  defaultModel: string,
  orgId: string,
): Promise<{ variant: string; model: string; temperature: number }> {
  const { variant } = await assignVariant(`agent-${agentId}`, orgId);

  let model = defaultModel;
  let temperature = 0.7;
  switch (variant) {
    case 'temperature-high':
      temperature = 1.0;
      break;
    case 'model-gpt4':
      model = 'openai/gpt-4o';
      break;
  }

  return { variant, model, temperature };
}

export async function recordAgentRunSuccess(params: {
  taskId: string;
  orgId: string;
  agent: { id: string; role: string };
  output: string;
  usage?: { completion_tokens: number; prompt_tokens: number; cost?: number };
  model: string;
  temperature: number;
  variant: string;
}): Promise<void> {
  const { taskId, orgId, agent, output, usage, model, temperature, variant } = params;

  recordSuccess('openrouter');

  const totalTokens = (usage?.completion_tokens || 0) + (usage?.prompt_tokens || 0);

  await updateTaskResult(taskId, orgId, {
    status: 'completed',
    output,
    tokensUsed: totalTokens,
    costUsd: usage?.cost || 0,
  });

  track(D1Events.AGENT_TASK_COMPLETE, orgId, {
    agentId: agent.id,
    agentRole: agent.role,
    taskId,
    tokens: totalTokens,
    model,
    variant,
  });

  await appendLog({
    taskId,
    action: 'invoke',
    payload: {
      model,
      temperature,
      tokens: usage,
      variant,
    },
  });
}

export async function recordAgentRunFailure(params: {
  err: unknown;
  taskId: string;
  orgId: string;
  agentRole: string;
}): Promise<never> {
  const { err, taskId, orgId, agentRole } = params;
  const error = err instanceof Error ? err : new Error(String(err));
  const errorMessage = error.message;

  const kind = classifyError(error);
  recordFailure('openrouter', kind);

  await updateTaskResult(taskId, orgId, {
    status: 'failed',
    output: '',
    errorMessage,
  });

  await reportError(error, {
    route: 'agent.runner',
    agent_role: agentRole,
    task_id: taskId,
    org_id: orgId,
  });

  await appendLog({
    taskId,
    action: 'error',
    payload: {
      error: errorMessage,
      stack: error.stack,
    },
  });

  throw error;
}
