/**
 * @module forest/agent-chat/memory-consolidation-types
 *
 * Type definitions and constants for memory consolidation.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** KV type for conversation memory entries. */
export const CONVERSATION_MEMORY_TYPE = 'session';

/** Key prefix for conversation memory entries. */
export const CONVERSATION_KEY_PREFIX = 'conv:';

/** How long to retain old conversation memories (30 days). */
export const CONVERSATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum number of past conversations to keep in the index per user. */
export const MAX_CONVERSATIONS_PER_USER = 20;

// ── Types ────────────────────────────────────────────────────────────────────

/** Stored conversation memory entry. */
export interface ConversationMemory {
  /** Unique record ID (same as conversationId). */
  id: string;
  /** Unique conversation identifier. */
  conversationId: string;
  /** Summary text of the conversation. */
  summary: string;
  /** Number of messages at time of consolidation. */
  messageCount: number;
  /** ISO timestamp of last consolidation. */
  lastConsolidatedAt: string;
}

/** Result of a consolidation operation. */
export interface ConsolidationResult {
  /** Whether consolidation ran successfully. */
  success: boolean;
  /** Conversation ID. */
  conversationId: string;
  /** Action taken: none, trim, summarize+trim. */
  action: 'none' | 'trim' | 'summarize+trim';
  /** Token count before consolidation. */
  tokensBefore: number;
  /** Token count after consolidation. */
  tokensAfter: number;
  /** Whether a summary was stored. */
  summaryStored: boolean;
  /** Error message if consolidation failed. */
  error?: string;
}
