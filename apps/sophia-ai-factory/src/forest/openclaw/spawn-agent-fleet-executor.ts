/**
 * spawn-agent-fleet-executor.ts — Execution primitives for agent spawner
 * Part of Phase 12 OpenClaw orchestration
 */

import {
  validatePromptContract,
  PromptContractError,
} from "@/seed/validators/agent-prompt-contracts";
import { withBreaker, BreakerOpenError, getBreakerState } from "@/seed/utils/circuit-breaker";
import { withRetry } from "@/seed/utils/retry-with-backoff";
import { logger } from "@/seed/utils/logger-utility";
import type { AgentTask, AgentResult } from "./spawn-agent-fleet";

export const FLEET_BREAKER = "agent-fleet";

/**
 * OpenRouter-powered task executor — runs prompts through OpenRouter API.
 * Falls back to stub if OPENROUTER_API_KEY is not configured (BYOK).
 */
import { resolveUserApiKey } from "@/tree/byok/resolve-user-api-key";

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

  // Real LLM execution via OpenRouter
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: task.tier === "max" ? "anthropic/claude-opus-4" : "anthropic/claude-sonnet-4",
      messages: [{ role: "user", content: task.prompt }],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return {
    taskId: task.id,
    status: "completed",
    prompt: task.prompt,
    tier: task.tier ?? "standard",
    output: data.choices[0]?.message?.content ?? "",
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
    logger.success("task_completed", {
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
