/**
 * spawn-agent-fleet-types.ts — Types and error definitions for agent fleet executor
 * Phase 12: OpenClaw Orchestrator primitive
 */

import type { SOPAgentRole, IterationLimits } from "@/seed/types/multi-agent";

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
