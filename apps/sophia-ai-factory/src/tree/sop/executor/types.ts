/**
 * SOP Executor — Type definitions
 * Shared between playbook-parser.ts, sop-runner.ts, and tests.
 */

export interface ParsedStep {
  order: number;
  command: string;
  args: Record<string, unknown>;
  rawYaml?: string;
}

export interface StepResult {
  order: number;
  output: Record<string, unknown>;
  status?: 'success' | 'skipped' | 'failed';
  error?: Error;
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

// Compatibility alias — seed version uses RunContext
export type RunContext = ExecutorContext;

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
