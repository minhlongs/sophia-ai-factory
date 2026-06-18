/**
 * Agent Factory — Runner
 * Loads a task + agent from D1, calls OpenRouter, writes result.
 * Phase 03: emits signals (AGENT_TASK_START/COMPLETE/FAIL) fire-and-forget.
 */

import { getTask, getAgentById, updateTaskStatus, updateTaskResult, appendLog } from './repository';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import { assignVariant } from '@/tree/signals/ab-experiment';
import { resolvePrompt, experimentName } from './prompt-variants';
import { assertTierAllowsAgent, AgentTierBlockedError } from './enforcement-gate';
import { reportError } from '@/seed/observability/telemetry/error-tracker';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { trackUsage } from '@/forest/usage-metering';
import { calculateCredits } from '@/seed/billing/credits-calculator';
import type { AgentTask } from './types';
import type { Tier } from '@/seed/types';

const COST_PER_TOKEN = 0.000001; // ~$1 / 1M tokens (gpt-4o-mini estimate)

/**
 * Run an agent task inline (sync for Cloudflare Workers free tier).
 * Updates task row with result / error.
 *
 * Phase 03: track() calls are fire-and-forget (void) — never block the runner.
 * Phase 04: assertTierAllowsAgent gate runs before any LLM call.
 *           reportError wraps LLM failures (non-blocking).
 *
 * @param userTier - caller's tier (BASIC|PREMIUM|ENTERPRISE|MASTER). Pass 'MASTER' for system calls.
 */
export async function runAgent(taskId: string, orgId: string, userTier = 'BASIC'): Promise<AgentTask> {
  // Mark as running
  await updateTaskStatus(taskId, orgId, 'running');
  await appendLog({ taskId, action: 'start', payload: { taskId } });

  const task = await getTask(taskId, orgId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const agent = await getAgentById(task.agentId);
  if (!agent) {
    await updateTaskResult(taskId, orgId, {
      output: '',
      tokensUsed: 0,
      costUsd: 0,
      status: 'failed',
      errorMessage: `Agent ${task.agentId} not found`,
    });
    throw new Error(`Agent ${task.agentId} not found`);
  }

  // Phase 04: Enforcement gate — block if tier does not permit agent role
  try {
    assertTierAllowsAgent(userTier, agent.role);
  } catch (gateErr) {
    if (gateErr instanceof AgentTierBlockedError) {
      await updateTaskResult(taskId, orgId, {
        output: '',
        tokensUsed: 0,
        costUsd: 0,
        status: 'failed',
        errorMessage: gateErr.message,
      });
      // Emit tier_blocked signal (fire-and-forget)
      void track(D1Events.AGENT_TASK_FAIL, orgId, {
        task_id: taskId,
        agent_role: agent.role,
        variant: 'control',
        error_class: 'tier_blocked',
      }, orgId);
      throw gateErr;
    }
    throw gateErr;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const errMsg = 'OPENROUTER_API_KEY not configured';
    await updateTaskResult(taskId, orgId, { output: '', tokensUsed: 0, costUsd: 0, status: 'failed', errorMessage: errMsg });
    throw new Error(errMsg);
  }

  // Phase 03: resolve A/B variant before LLM call (falls back to 'control' on error)
  const expName = experimentName(agent.role);
  let variant = 'control';
  try {
    const result = await assignVariant(expName, orgId);
    variant = result.variant;
  } catch {
    // assignVariant already logs — keep 'control'
  }

  // Resolve system prompt for this variant
  const systemPrompt = resolvePrompt(agent.role, variant) || agent.systemPrompt;

  // Phase 03: emit AGENT_TASK_START (fire-and-forget)
  void track(D1Events.AGENT_TASK_START, orgId, {
    task_id: taskId,
    agent_role: agent.role,
    agent_id: agent.id,
    variant,
  }, orgId);

  const startMs = Date.now();

  try {
    const prompt = `System: ${systemPrompt}\n\nUser: ${task.input}`;
    const output = await resilientChatCompletion(prompt, {
      openRouterKey: apiKey,
      anthropicKey: undefined,
      enableFallback: false,
      model: agent.model,
    });

    const responseTime = Date.now() - startMs;
    const estimatedTokens = Math.ceil(output.length / 4); // rough estimate

    // Track success
    await trackUsage({
      userId:         orgId, // using orgId as proxy
      licenseKeyHash: 'agent-runner',
      licenseNonce:   'n/a',
      service:        'openrouter',
      endpoint:       '/chat/completions',
      action:         'chat_completion',
      tokensInput:    estimatedTokens / 2,
      tokensOutput:   estimatedTokens / 2,
      creditsUsed:    calculateCredits('openrouter', 'chatCompletion', estimatedTokens, userTier as Tier),
      modelName:      agent.model,
      tierAtRequest:  userTier,
      statusCode:     200,
      responseTimeMs: responseTime,
    });

    await updateTaskResult(taskId, orgId, {
      output,
      tokensUsed: estimatedTokens,
      costUsd: COST_PER_TOKEN * estimatedTokens,
      status: 'completed',
    });

    // Log the LLM invocation with usage metrics
    await appendLog({
      taskId,
      action: 'invoke',
      payload: { tokens: estimatedTokens, cost: COST_PER_TOKEN * estimatedTokens },
    });

    // Emit success signal
    void track(D1Events.AGENT_TASK_COMPLETE, orgId, {
      task_id: taskId,
      agent_role: agent.role,
      agent_id: agent.id,
      variant,
      responseTimeMs: responseTime,
      tokensUsed: estimatedTokens,
    }, orgId);

    return {
      ...task,
      result: { output, tokensUsed: estimatedTokens, costUsd: COST_PER_TOKEN * estimatedTokens, status: 'completed' },
    } as AgentTask;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';

    // Phase 03: emit AGENT_TASK_FAIL (fire-and-forget) — only if not already emitted above
    if (!errMsg.startsWith('OpenRouter HTTP') && !errMsg.includes('Rate limited')) {
      void track(D1Events.AGENT_TASK_FAIL, orgId, {
        task_id: taskId,
        agent_role: agent.role,
        variant,
        error_class: errorClass,
      }, orgId);
    }

    // Phase 04: report error (non-blocking — fire-and-forget)
    const reportableErr = err instanceof Error ? err : new Error(errMsg);
    void reportError(reportableErr, {
      route: 'agent.runner',
      agent_role: agent.role,
      task_id: taskId,
      variant,
    });

    // Don't double-update if already written above
    try {
      await updateTaskResult(taskId, orgId, { output: '', tokensUsed: 0, costUsd: 0, status: 'failed', errorMessage: errMsg });
    } catch { /* best-effort */ }
    throw err;
  }
}
