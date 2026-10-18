/**
 * spawn-agent-fleet-executor.ts — Execution primitives for agent spawner
 * Part of Phase 12 OpenClaw orchestration
 */

import { getBreakerState, FLEET_BREAKER } from "@/seed/utils/in-memory-circuit-breaker";
import { logger } from "@/seed/utils/logger-utility";
import type { AgentTask, AgentResult } from "./spawn-agent-fleet";
import {
  localExecutor,
  formatTaskError,
  executeTaskWithRetry,
} from "./spawn-agent-fleet-task-runner";

export { localExecutor };

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
    const output = await executeTaskWithRetry(task, tenantId, () => {
      attempts++;
    });

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
      error: formatTaskError(err),
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
