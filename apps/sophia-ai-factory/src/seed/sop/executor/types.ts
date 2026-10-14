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
  rawYaml?: string;
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
  command?: string;
  missionId?: string;
  output: Record<string, unknown>;
  status?: 'success' | 'skipped' | 'failed';
  error?: Error;
}

/** Final result returned by runSop */
export interface RunResult {
  runId: string;
  status: 'completed' | 'failed' | 'paused';
  summary?: Record<string, unknown>;
  errorMessage?: string;
}

export interface ParsedPlaybook {
  title: string;
  version: string;
  steps: ParsedStep[];
}

export interface ExecutorContext {
  executorId: string;
  playbookId: string;
  orgId: string;
  userId: string;
  variables: Record<string, unknown>;
  stepResults: Record<number, unknown>;
}

export type StepOutcome =
  | { status: 'success'; result?: unknown }
  | { status: 'skipped'; reason?: string }
  | { status: 'failed'; error: Error };

/** Metadata for a command */
export interface CommandMetadata {
  name: string;
  description: string;
  argSchema?: Record<string, unknown>;
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
