import type { AgentDecision, AgentResult } from '@/seed/types/creative-domain';

export type ExecutorErrorCode =
  | 'NO_PROVIDER'
  | 'NO_PROVIDER_HEALTHY'
  | 'AUTONOMY_DENIED'
  | 'PROVIDER_ERROR'
  | 'BUDGET_EXCEEDED'
  | 'EXECUTION_FAILED';

export class ExecutorError extends Error {
  code: ExecutorErrorCode;
  constructor(code: ExecutorErrorCode, message: string) {
    super(message);
    this.name = 'ExecutorError';
    this.code = code;
  }
}

/**
 * Execution result enriched with token accounting for D1 agent_runs
 * bookkeeping. Extends the canonical AgentResult with totalTokens and the
 * decision the executor committed to (consumed downstream for memory
 * persistence confidence).
 */
export interface AgentExecutionResult extends AgentResult {
  /** Total tokens consumed (input + output) across the provider call. */
  totalTokens: number;
  /** Decision built during execution — carries confidence for memory write-back. */
  decision?: AgentDecision;
}
