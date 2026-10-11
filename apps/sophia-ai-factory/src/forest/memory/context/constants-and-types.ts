/** Default context window size (tokens) for typical LLMs. */
export const DEFAULT_CONTEXT_LIMIT = 8192;

/** Utilization threshold (0.0–1.0) that triggers summarization. */
export const CONTEXT_SUMMARIZE_THRESHOLD = 0.8;

/** Number of recent messages to keep after summarization. */
export const KEEP_RECENT_MESSAGES = 6;

/** Approximate chars-per-token ratio for estimation. */
export const CHARS_PER_TOKEN = 4;

/** Result of a context window check. */
export interface ContextCheckResult {
  /** Whether summarization was triggered. */
  summarized: boolean;
  /** Original message count before trimming. */
  originalCount: number;
  /** Message count after trimming. */
  trimmedCount: number;
  /** Estimated token usage before. */
  estimatedTokensBefore: number;
  /** Estimated token usage after. */
  estimatedTokensAfter: number;
  /** Context limit used for the check. */
  contextLimit: number;
  /** Utilization ratio before trimming (0.0–1.0). */
  utilizationBefore: number;
}

/** Options for context window management. */
export interface ContextWindowOptions {
  /** Context limit in tokens (default: DEFAULT_CONTEXT_LIMIT). */
  contextLimit?: number;
  /** Summarization threshold ratio (default: CONTEXT_SUMMARIZE_THRESHOLD). */
  summarizeThreshold?: number;
  /** Number of recent messages to preserve (default: KEEP_RECENT_MESSAGES). */
  keepRecent?: number;
  /** User ID for memory consolidation after summarization. */
  userId?: string;
}
