/**
 * Usage metering and failure telemetry helpers for tree Agent Task Execution Engine.
 * @module tree/agents/runner/executor-telemetry
 */

import { updateTaskResult, appendLog } from '../repository';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { reportError } from '@/seed/observability/telemetry/error-tracker';
import { trackUsage } from '@/tree/usage-metering';
import { calculateCredits } from '@/seed/billing/credits-calculator';
import type { Tier } from '@/seed/types';

export const COST_PER_TOKEN = 0.000001; // ~$1 / 1M tokens (gpt-4o-mini estimate)

export async function recordAgentTaskSuccess(params: {
  taskId: string;
  orgId: string;
  userTier: string;
  agent: { id: string; role: string; model: string };
  variant: string;
  output: string;
  responseTime: number;
}): Promise<number> {
  const { taskId, orgId, userTier, agent, variant, output, responseTime } = params;
  const estimatedTokens = Math.ceil(output.length / 4);

  await trackUsage({
    userId: orgId,
    licenseKeyHash: 'agent-runner',
    licenseNonce: 'n/a',
    service: 'openrouter',
    endpoint: '/chat/completions',
    action: 'chat_completion',
    tokensInput: estimatedTokens / 2,
    tokensOutput: estimatedTokens / 2,
    creditsUsed: calculateCredits(
      'openrouter',
      'chatCompletion',
      estimatedTokens,
      userTier as Tier,
    ),
    modelName: agent.model,
    tierAtRequest: userTier,
    statusCode: 200,
    responseTimeMs: responseTime,
  });

  await updateTaskResult(taskId, orgId, {
    output,
    tokensUsed: estimatedTokens,
    costUsd: COST_PER_TOKEN * estimatedTokens,
    status: 'completed',
  });

  await appendLog({
    taskId,
    action: 'invoke',
    payload: {
      tokens: estimatedTokens,
      cost: COST_PER_TOKEN * estimatedTokens,
    },
  });

  void track(
    D1Events.AGENT_TASK_COMPLETE,
    orgId,
    {
      task_id: taskId,
      agent_role: agent.role,
      agent_id: agent.id,
      variant,
      responseTimeMs: responseTime,
      tokensUsed: estimatedTokens,
    },
    orgId,
  );

  return estimatedTokens;
}

export async function recordAgentTaskFailure(params: {
  err: unknown;
  taskId: string;
  orgId: string;
  agentRole: string;
  variant: string;
}): Promise<never> {
  const { err, taskId, orgId, agentRole, variant } = params;
  const errMsg = err instanceof Error ? err.message : String(err);
  const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';

  if (!errMsg.startsWith('OpenRouter HTTP') && !errMsg.includes('Rate limited')) {
    void track(
      D1Events.AGENT_TASK_FAIL,
      orgId,
      {
        task_id: taskId,
        agent_role: agentRole,
        variant,
        error_class: errorClass,
      },
      orgId,
    );
  }

  const reportableErr = err instanceof Error ? err : new Error(errMsg);
  void reportError(reportableErr, {
    route: 'agent.runner',
    agent_role: agentRole,
    task_id: taskId,
    variant,
  });

  try {
    await updateTaskResult(taskId, orgId, {
      output: '',
      tokensUsed: 0,
      costUsd: 0,
      status: 'failed',
      errorMessage: errMsg,
    });
  } catch {
    /* best-effort */
  }
  throw err;
}
