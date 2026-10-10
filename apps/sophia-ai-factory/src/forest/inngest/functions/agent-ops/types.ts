/**
 * Types and interfaces for agent mission execution.
 * @module forest/inngest/functions/agent-ops/types
 */

export interface MissionExecutionResult {
  runId: string;
  status: 'completed' | 'failed';
}

export interface RunFailedErrorDetails {
  code: string;
  message?: string;
  agentId?: string;
  budgetRemainingCents?: number;
  [key: string]: unknown;
}
