export interface ContextWindowConfig {
  /** Model identifier (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`). */
  modelId: string;
  /** Maximum context window size in tokens. */
  contextLimit: number;
  /** Recommended threshold (0–1) at which consolidation should trigger. */
  consolidationThreshold: number;
}

export interface ContextUtilizationReport {
  modelId: string;
  contextLimit: number;
  usedTokens: number;
  systemTokens: number;
  messageTokens: number;
  utilizationRatio: number;
  utilizationPercent: number;
  remainingTokens: number;
  needsConsolidation: boolean;
}
