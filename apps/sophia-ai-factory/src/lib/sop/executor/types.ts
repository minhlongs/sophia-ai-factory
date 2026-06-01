/**
 * SOP Executor Domain Types
 *
 * Internal types for parsing agents.yaml, playbook.md steps,
 * and run context passed between executor modules.
 */

/** Parsed agent definition from agents.yaml (Tier 1 HDR format) */
export interface ParsedAgent {
  role: string;
  goal: string;
  tools: string[];
  backstory?: string;
}

/** Map of agent name → definition, as parsed from agents.yaml root */
export type ParsedAgentMap = Record<string, ParsedAgent>;

/** A single parsed step from playbook.md */
export interface ParsedStep {
  order: number;
  command: string;
  args: Record<string, unknown>;
  dependsOn?: number[];
}

/** Context carried through a SOP run execution */
export interface RunContext {
  installationId: string;
  runId: string;
  userId: string;
  trigger: 'cron' | 'webhook' | 'manual';
  triggerPayload?: Record<string, unknown>;
}

/** Result collected from each step execution */
export interface StepResult {
  order: number;
  command: string;
  missionId: string;
  output: Record<string, unknown>;
}

/** Final result returned by runSop */
export interface RunResult {
  runId: string;
  status: 'completed' | 'failed' | 'paused';
  summary?: Record<string, unknown>;
  errorMessage?: string;
}

/** Error thrown when a step fails, carries step order for partial status */
export class StepFailed extends Error {
  constructor(
    public readonly stepOrder: number,
    public readonly stepError: string,
  ) {
    super(`Step ${stepOrder} failed: ${stepError}`);
    this.name = 'StepFailed';
  }
}
