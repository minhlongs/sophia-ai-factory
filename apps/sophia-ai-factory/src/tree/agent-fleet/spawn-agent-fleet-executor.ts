/**
 * spawn-agent-fleet-executor.ts — Execution primitives for agent spawner
 * Part of Phase 12 OpenClaw orchestration
 */

import {
  validatePromptContract,
  PromptContractError,
} from "@/seed/validators/agent-prompt-contracts";
import { withBreaker, BreakerOpenError, getBreakerState, FLEET_BREAKER } from "@/seed/utils/in-memory-circuit-breaker";
import { withRetry } from "@/seed/utils/retry-with-backoff";
import { logger } from "@/seed/utils/logger-utility";
import { resilientChatCompletion } from "@/seed/inference/openrouter-client";
import { resolveUserApiKey } from "@/tree/byok/resolve-user-api-key";
import { tokenCounter } from "@/seed/ai/token-counter";
import { ContextWindow } from "@/seed/ai/context-window";
import { contextOverflowLog } from "@/seed/ai/context-overflow-log";
import type { AgentTask, AgentResult } from "./spawn-agent-fleet";

const FLEET_CONTEXT_WINDOW = new ContextWindow();
const SAFETY_BUFFER = 22_000;

function checkFleetBudget(prompt: string, modelId: string): { ok: boolean; tokens: number; limit: number } {
  const tokens = tokenCounter.estimateTokens(prompt).tokens;
  const limitConfig = FLEET_CONTEXT_WINDOW.getLimit(modelId);
  const safeLimit = limitConfig.contextLimit - SAFETY_BUFFER;
  return { ok: tokens <= safeLimit, tokens, limit: safeLimit };
}

export async function localExecutor(
  task: AgentTask,
  tenantId: string,
): Promise<unknown> {
  const apiKey = await resolveUserApiKey(tenantId, "openrouter");

  if (!apiKey) {
    // BYOK: no key configured — return stub queued status
    return {
      taskId: task.id,
      status: "queued",
      prompt: task.prompt,
      tier: task.tier ?? "standard",
      note: "OpenRouter API key not configured. Configure via Setup Wizard.",
    };
  }

  const model = task.tier === "max" ? "anthropic/claude-opus-4" : "anthropic/claude-sonnet-4";

  const budget = checkFleetBudget(task.prompt, model);
  if (!budget.ok) {
    void contextOverflowLog.log({
      provider: 'openrouter',
      tokensUsed: budget.tokens,
      limit: budget.limit,
      contextWindow: model,
      agentId: task.id,
    });
    throw new Error(`CONTEXT_OVERFLOW: Prompt tokens (${budget.tokens}) exceed safe limit (${budget.limit}) for model ${model}`);
  }

  const content = await resilientChatCompletion(task.prompt, {
    openRouterKey: apiKey,
    anthropicKey: undefined,
    enableFallback: true,
  tier: task.tier,
    model,
  });

  return {
    taskId: task.id,
    status: "completed",
    prompt: task.prompt,
    tier: task.tier ?? "standard",
    output: content,
  };
}

export async function runTask(
  task: AgentTask,
  tenantId: string,
): Promise<AgentResult> {
  const start = Date.now();
  logger.info("executing_task", {
    taskId: task.id,
    tenantId,
    agentRole: task.agentRole,
    tier: task.tier,
  });

  // Fail-fast if breaker is already open — no point dispatching
  if (getBreakerState(FLEET_BREAKER) === "open") {
    logger.warn("task_skipped_breaker_open", { taskId: task.id });
    return {
      taskId: task.id,
      success: false,
      error: "Skipped — circuit breaker open",
      durationMs: 0,
      retryCount: 0,
    };
  }

  let attempts = 0;

  try {
    // Validate typed prompt contract before dispatch (opt-in: both fields required)
    if (task.promptContract !== undefined && task.agentRole !== undefined) {
      validatePromptContract(task.agentRole, task.promptContract);
    }

    const enrichedTask: AgentTask = {
      ...task,
      context: { ...task.context, tenantId },
    };

    const output = await withRetry(
      () => {
        attempts++;
        return withBreaker(FLEET_BREAKER, () => localExecutor(enrichedTask, tenantId));
      },
      { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 10_000 },
    );

    const durationMs = Date.now() - start;
    logger.info("task_completed", {
      taskId: task.id,
      agentRole: task.agentRole,
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    });

    return {
      taskId: task.id,
      success: true,
      output,
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    logger.error("task_failed", {
      taskId: task.id,
      agentRole: task.agentRole,
      error: err instanceof Error ? err.message : String(err),
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    });

    return {
      taskId: task.id,
      success: false,
      error: err instanceof BreakerOpenError
        ? "Circuit breaker open — upstream degraded"
        : err instanceof PromptContractError
          ? `Contract validation: ${err.message}`
          : String(err),
      durationMs,
      retryCount: attempts > 0 ? attempts - 1 : 0,
    };
  }
}

export async function runWithConcurrency(
  tasks: AgentTask[],
  tenantId: string,
  maxConcurrency: number,
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  const chunks: AgentTask[][] = [];
  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    chunks.push(tasks.slice(i, i + maxConcurrency));
  }
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map((t) => runTask(t, tenantId)));
    results.push(...chunkResults);
  }
  return results;
}
