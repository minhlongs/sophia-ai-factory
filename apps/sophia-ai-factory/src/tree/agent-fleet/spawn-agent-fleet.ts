/**
 * spawn-agent-fleet.ts — Parallel/sequential agent fleet executor
 * Phase 12: OpenClaw Orchestrator primitive
 *
 * Constraints:
 *  - tenantId REQUIRED — throws OpenclawTenantMissingError if missing
 *  - Each task gets isolated context (tenantId injected)
 *  - Audit row written per spawn + per result
 *  - Falls back to local executor if Anthropic Agent SDK unavailable
 *  - Each task wrapped in withRetry + withBreaker for resilience
 */

import { audit } from "./audit";
import type { SOPAgentRole, IterationLimits } from "@/seed/types/multi-agent";
import { DEFAULT_ITERATION_LIMITS } from "@/seed/types/multi-agent";
import { checkIterationBudget } from "@/tree/sop/multi-agent-coordinator-helpers";
import { logger } from "@/seed/utils/logger-utility";
import { runTask, runWithConcurrency } from "./spawn-agent-fleet-executor";

export class OpenclawTenantMissingError extends Error {
  constructor() {
    super("OpenClaw: tenantId is required for spawnAgentFleet");
    this.name = "OpenclawTenantMissingError";
  }
}

export interface AgentTask {
  /** Unique identifier for this task within the fleet */
  id: string;
  /** Human-readable description / prompt for the agent */
  prompt: string;
  /** Optional context data injected into the task */
  context?: Record<string, unknown>;
  /** LLM tier for this task. Defaults to 'standard' */
  tier?: "lite" | "standard" | "max";
  /**
   * Typed prompt contract — validated against role schema before dispatch.
   * Opt-in: validation only fires when BOTH promptContract AND agentRole are present.
   */
  promptContract?: Record<string, unknown>;
  /** Agent role used for prompt contract schema lookup */
  agentRole?: SOPAgentRole;
}

export interface AgentResult {
  taskId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  /** How many retries were attempted before success or final failure */
  retryCount?: number;
}

export interface SpawnFleetOptions {
  tenantId: string;
  actor?: string;
  /** Run tasks in parallel (true) or sequentially (false). Default: true */
  parallel?: boolean;
  /** Max concurrent tasks when parallel=true. Default: 5 */
  maxConcurrency?: number;
  /** Iteration limits to prevent runaway agents. Uses defaults if omitted. */
  iterationLimits?: IterationLimits;
}

/**
 * Spawn a fleet of agents for a given tenant.
 *
 * @param tasks  Array of agent tasks to execute
 * @param opts   Fleet options (tenantId required)
 * @returns      Array of results, one per task, in input order
 */
export async function spawnAgentFleet(
  tasks: AgentTask[],
  opts: SpawnFleetOptions,
): Promise<AgentResult[]> {
  if (!opts.tenantId) {
    throw new OpenclawTenantMissingError();
  }

  const {
    tenantId,
    actor = "system",
    parallel = true,
    maxConcurrency = 100,
    iterationLimits = DEFAULT_ITERATION_LIMITS,
  } = opts;

  // Bounded iteration guard — check fleet-level limit before starting
  const fleetBudget = checkIterationBudget(0, tasks.length, iterationLimits);
  if (!fleetBudget.canProceed) {
    logger.warn("[spawnAgentFleet] Fleet iteration limit prevents dispatch", {
      taskCount: tasks.length,
      limit: iterationLimits.maxTotalIterations,
      reason: fleetBudget.reason,
    });
    return tasks.map((t) => ({
      taskId: t.id,
      success: false,
      error: `Iteration limit: ${fleetBudget.reason}`,
      durationMs: 0,
      retryCount: 0,
    }));
  }

  // Audit: fleet spawn
  await audit({
    tenantId,
    actor,
    action: "fleet.spawn",
    resource: "agent-fleet",
    metadata: {
      taskCount: tasks.length,
      parallel,
      maxConcurrency,
      taskIds: tasks.map((t) => t.id),
    },
  });

  let results: AgentResult[];

  if (!parallel) {
    // Sequential execution
    results = [];
    for (const task of tasks) {
      results.push(await runTask(task, tenantId));
    }
  } else {
    results = await runWithConcurrency(tasks, tenantId, maxConcurrency);
  }

  // Audit: fleet complete
  await audit({
    tenantId,
    actor,
    action: "fleet.complete",
    resource: "agent-fleet",
    metadata: {
      taskCount: tasks.length,
      successCount: results.filter((r) => r.success).length,
      failCount: results.filter((r) => !r.success).length,
    },
  });

  return results;
}
