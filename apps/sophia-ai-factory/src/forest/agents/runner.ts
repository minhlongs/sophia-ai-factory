/**
 * Agent Runner — Executes AI agent tasks
 * Layer: forest
 * Purpose: Runs agent tasks by calling OpenRouter and handling results
 */

import type { Tier } from '@/seed/types';
import { assertTierAllowsAgent, AgentTierBlockedError } from './enforcement-gate';
import {
  getTask,
  getAgentById,
  updateTaskResult,
  appendLog,
} from './repository';
import { reportError } from '@/seed/observability/telemetry/error-tracker';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { track } from '@/tree/signals/track';
import { assignVariant } from '@/tree/signals/ab-experiment';
import { D1Events } from '@/tree/signals/d1-event-types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

/**
 * Executes an agent task
 * @param taskId - The task ID to execute
 * @param orgId - The organization ID (for auth)
 * @param userTier - The user's subscription tier
 * @returns Promise resolving to the agent output
 */
export async function runAgent(
  taskId: string,
  orgId: string,
  userTier: string
): Promise<string> {
  // Validate tier allows this agent role
  const task = await getTask(taskId, orgId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const agent = await getAgentById(task.agentId);
  if (!agent) {
    throw new Error(`Agent ${task.agentId} not found`);
  }

  // Check tier permission
  try {
    assertTierAllowsAgent(userTier as Tier, agent.role);
  } catch (err) {
    // Gate failed - record and throw
    await updateTaskResult(taskId, orgId, {
      status: 'failed',
      output: '',
      errorMessage: err instanceof AgentTierBlockedError ? err.message : 'Tier gate blocked',
    });
    throw err;
  }

  // Check API key
  if (!OPENROUTER_API_KEY) {
    await updateTaskResult(taskId, orgId, {
      status: 'failed',
      output: '',
      errorMessage: 'OPENROUTER_API_KEY not configured',
    });
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  // Build OpenRouter request
  const messages = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: task.input },
  ];

  // Get A/B experiment variant for this agent
  const { variant } = await assignVariant(`agent-${agent.id}`, orgId);

  // Adjust model or parameters based on variant
  let model = agent.model;
  let temperature = 0.7;
  switch (variant) {
    case 'temperature-high':
      temperature = 1.0;
      break;
    case 'model-gpt4':
      model = 'openai/gpt-4o';
      break;
  }

  // Circuit breaker: check if OpenRouter is available
  if (!shouldAllowRequest('openrouter')) {
    throw new Error('Circuit breaker open for OpenRouter — too many failures');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'https://sophia.agencyos.network',
        'X-Title': 'Sophia AI Factory',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as {
      choices?: { message?: { content: string } }[];
      usage?: { completion_tokens: number; prompt_tokens: number; cost?: number };
    };
    const output = data.choices?.[0]?.message?.content || '';

    // Circuit breaker: record success
    recordSuccess('openrouter');

    // Update task with success
    await updateTaskResult(taskId, orgId, {
      status: 'completed',
      output,
      tokensUsed: (data.usage?.completion_tokens || 0) + (data.usage?.prompt_tokens || 0),
      costUsd: data.usage?.cost || 0,
    });

    // Track success (fire-and-forget)
    track(D1Events.AGENT_TASK_COMPLETE, orgId, {
      agentId: agent.id,
      agentRole: agent.role,
      taskId,
      tokens: (data.usage?.completion_tokens || 0) + (data.usage?.prompt_tokens || 0),
      model,
      variant,
    });

    // Append invoke log
    await appendLog({
      taskId,
      action: 'invoke',
      payload: {
        model,
        temperature,
        tokens: data.usage,
        variant,
      },
    });

    return output;
  } catch (err) {
    // Record failure
    const error = err instanceof Error ? err : new Error(String(err));
    const errorMessage = error.message;

    // Circuit breaker: classify and record failure
    const kind = classifyError(error);
    recordFailure('openrouter', kind);

    await updateTaskResult(taskId, orgId, {
      status: 'failed',
      output: '',
      errorMessage,
    });

    // Report to error tracker
    await reportError(error, {
      route: 'agent.runner',
      agent_role: agent.role,
      task_id: taskId,
      org_id: orgId,
    });

    // Append error log
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
}
