/**
 * @module forest/agent-chat/memory-consolidation-service
 *
 * MemoryConsolidationService — orchestrates conversation memory consolidation.
 *
 * Responsibilities:
 * - Check conversation context size against model limits.
 * - Trim and/or summarize messages when over budget.
 * - Store conversation summaries to memory_kv via the memory adapter.
 * - Prune stale conversation memories periodically.
 *
 * Import direction: forest → seed, tree (ONE-WAY).
 * Calls land/openclaw memory-adapter for storage (orchestration boundary).
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { memory } from '@/land/openclaw/memory-adapter';
import { getContextManager, type ContextCheckResult } from './context-manager';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Memory type key for conversation summaries. */
const CONVERSATION_MEMORY_TYPE = 'session';
/** Memory key prefix for conversation summaries. */
const CONVERSATION_KEY_PREFIX = 'conversation-summary:';
/** Retention period for conversation summaries (30 days in ms). */
const CONVERSATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Maximum number of conversation summaries to retain per user. */
const MAX_CONVERSATIONS_PER_USER = 50;

// ── Types ───────────────────────────────────────────────────────────────────────

/**
 * Stored conversation memory record.
 */
export interface ConversationMemory {
  /** Unique identifier for this conversation memory. */
  id: string;
  /** Compact summary of the conversation. */
  summary: string;
  /** Number of messages in the original conversation. */
  messageCount: number;
  /** ISO timestamp of when this summary was created. */
  lastConsolidatedAt: string;
  /** Conversation ID this summary belongs to. */
  conversationId: string;
}

/**
 * Result of a consolidation run.
 */
export interface ConsolidationResult {
  /** Whether consolidation succeeded. */
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

// ── MemoryConsolidationService ──────────────────────────────────────────────────

/**
 * Orchestrates conversation memory consolidation for agent chat.
 *
 * Flow:
 * a) Check context size against model limit.
 * b) Trim/summarize if over budget.
 * c) Store summary to memory_kv via the memory adapter.
 * d) Prune old memories periodically.
 *
 * Summarization is async and non-blocking — callers should not await it
 * when streaming is in progress.
 */
export class MemoryConsolidationService {
  private readonly contextManager: ReturnType<typeof getContextManager>;

  constructor() {
    this.contextManager = getContextManager();
  }

  /**
   * Consolidate a conversation: check size, trim/summarize if needed,
   * store summary, and prune old memories.
   *
   * @param conversationId — unique conversation identifier
   * @param messages — full message array (user + assistant + optional system)
   * @param userId — user identifier for memory scoping
   * @returns consolidation result
   */
  async consolidate(
    conversationId: string,
    messages: { role: string; content: string }[],
    userId: string,
  ): Promise<ConsolidationResult> {
    logger.info('[MemoryConsolidation] Starting consolidation', {
      conversationId,
      userId,
      messageCount: messages.length,
    });

    try {
      // Step a: Check context size.
      const systemPrompt = this.extractSystemPrompt(messages);
      const chatMessages = messages.filter((m) => m.role !== 'system');
      const contextResult = this.contextManager.checkContext(
        chatMessages,
        systemPrompt,
      );

      if (contextResult.action === 'none') {
        // Under budget — no action needed.
        logger.debug('[MemoryConsolidation] Within budget, no trimming needed', {
          conversationId,
          currentTokens: contextResult.currentTokens,
          limitTokens: contextResult.limitTokens,
        });
        return {
          success: true,
          conversationId,
          action: 'none',
          tokensBefore: contextResult.currentTokens,
          tokensAfter: contextResult.currentTokens,
          summaryStored: false,
        };
      }

      // Step b: Trim/summarize.
      let trimmedMessages: { role: 'system' | 'user' | 'assistant'; content: string }[];
      let summaryContent: string | undefined;

      if (contextResult.action === 'summarize+trim') {
        const { summary, recent } = await this.contextManager.summarizeOlder(
          chatMessages,
          this.contextManager['minRecent'],
        );
        summaryContent = summary.content;
        trimmedMessages = [
          { role: 'system', content: systemPrompt },
          summary,
          ...recent,
        ];
      } else {
        // trim only — no summarization.
        trimmedMessages = await this.contextManager.trimMessages(
          chatMessages,
          systemPrompt,
        );
      }

      const tokensAfter = this.contextManager.estimateTokens(trimmedMessages);

      // Step c: Store summary to memory_kv (non-blocking fire-and-forget).
      let summaryStored = false;
      if (summaryContent) {
        this.storeSummaryAsync(
          conversationId,
          summaryContent,
          messages.length,
          userId,
        ).then((stored) => {
          summaryStored = stored;
        }).catch(() => {
          // Non-critical: summary storage failure does not affect the response.
        });
      }

      logger.info('[MemoryConsolidation] Consolidation complete', {
        conversationId,
        userId,
        action: contextResult.action,
        tokensBefore: contextResult.currentTokens,
        tokensAfter,
        savedTokens: contextResult.currentTokens - tokensAfter,
        messageCount: messages.length,
        trimmedCount: trimmedMessages.length,
      });

      // Step d: Prune old memories (fire-and-forget).
      this.pruneOldMemoriesAsync(userId);

      return {
        success: true,
        conversationId,
        action: contextResult.action,
        tokensBefore: contextResult.currentTokens,
        tokensAfter,
        summaryStored,
      };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      logger.error('[MemoryConsolidation] Consolidation failed', {
        conversationId,
        userId,
        error: errorMsg,
      });
      return {
        success: false,
        conversationId,
        action: 'none',
        tokensBefore: 0,
        tokensAfter: 0,
        summaryStored: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Fire-and-forget consolidation — calls consolidate() but does not
   * return a promise to the caller. Errors are logged internally.
   *
   * @param conversationId — unique conversation identifier
   * @param messages — full message array
   * @param userId — user identifier
   */
  consolidateFireAndForget(
    conversationId: string,
    messages: { role: string; content: string }[],
    userId: string,
  ): void {
    this.consolidate(conversationId, messages, userId).catch((err) => {
      logger.warn('[MemoryConsolidation] Fire-and-forget consolidation failed', {
        conversationId,
        userId,
        error: getErrorMessage(err),
      });
    });
  }

  /**
   * Retrieve a stored conversation summary by ID.
   *
   * @param conversationId — the conversation identifier
   * @param userId — user identifier for scoping
   * @returns the stored ConversationMemory, or null if not found
   */
  async getConversationMemory(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMemory | null> {
    try {
      const key = `${CONVERSATION_KEY_PREFIX}${conversationId}`;
      const stored = (await memory.query(
        CONVERSATION_MEMORY_TYPE,
        key,
        userId,
      )) as ConversationMemory | null;
      return stored ?? null;
    } catch (err) {
      logger.warn('[MemoryConsolidation] Failed to retrieve conversation memory', {
        conversationId,
        userId,
        error: getErrorMessage(err),
      });
      return null;
    }
  }

  /**
   * List recent conversation summaries for a user.
   *
   * @param userId — user identifier
   * @param limit — maximum number to return (default 20)
   * @returns array of ConversationMemory records
   */
  async listConversationMemories(
    userId: string,
    limit = 20,
  ): Promise<ConversationMemory[]> {
    try {
      const key = `${CONVERSATION_KEY_PREFIX}${userId}:index`;
      const index = (await memory.query(
        CONVERSATION_MEMORY_TYPE,
        key,
        userId,
      )) as string[] | undefined;
      if (!Array.isArray(index)) return [];

      const memories: ConversationMemory[] = [];
      for (const convId of index.slice(0, limit)) {
        const mem = await this.getConversationMemory(convId, userId);
        if (mem) memories.push(mem);
      }
      return memories;
    } catch (err) {
      logger.warn('[MemoryConsolidation] Failed to list conversation memories', {
        userId,
        error: getErrorMessage(err),
      });
      return [];
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Extract or synthesize a system prompt from the message array.
   * If no system message exists, returns a default.
   */
  private extractSystemPrompt(messages: { role: string; content: string }[]): string {
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) return systemMsg.content;
    return 'You are a helpful AI assistant.';
  }

  /**
   * Store a conversation summary to memory_kv asynchronously.
   */
  private async storeSummaryAsync(
    conversationId: string,
    summary: string,
    messageCount: number,
    userId: string,
  ): Promise<boolean> {
    try {
      const key = `${CONVERSATION_KEY_PREFIX}${conversationId}`;
      const record: ConversationMemory = {
        id: conversationId,
        summary,
        messageCount,
        lastConsolidatedAt: new Date().toISOString(),
        conversationId,
      };

      await memory.store(
        CONVERSATION_MEMORY_TYPE,
        key,
        record,
        userId,
      );

      // Update the user's index of conversation IDs.
      await this.updateConversationIndex(conversationId, userId);

      logger.debug('[MemoryConsolidation] Summary stored', {
        conversationId,
        userId,
        messageCount,
      });
      return true;
    } catch (err) {
      logger.warn('[MemoryConsolidation] Failed to store summary', {
        conversationId,
        userId,
        error: getErrorMessage(err),
      });
      return false;
    }
  }

  /**
   * Update the user's conversation index to include this conversation ID.
   */
  private async updateConversationIndex(conversationId: string, userId: string): Promise<void> {
    try {
      const indexKey = `${CONVERSATION_KEY_PREFIX}${userId}:index`;
      const existing = (await memory.query(
        CONVERSATION_MEMORY_TYPE,
        indexKey,
        userId,
      )) as string[] | undefined;
      const index: string[] = existing ?? [];

      // Add to front, deduplicate, cap at max.
      const updated = [conversationId, ...index.filter((id) => id !== conversationId)]
        .slice(0, MAX_CONVERSATIONS_PER_USER);

      await memory.store(
        CONVERSATION_MEMORY_TYPE,
        indexKey,
        updated,
        userId,
      );
    } catch {
      // Non-critical: index update failure does not affect summary storage.
    }
  }

  /**
   * Prune stale conversation memories older than the retention period.
   * Runs asynchronously — does not block the caller.
   */
  private pruneOldMemoriesAsync(userId: string): void {
    try {
      this.pruneOldMemories(userId).catch((err) => {
        logger.warn('[MemoryConsolidation] Pruning failed', {
          userId,
          error: getErrorMessage(err),
        });
      });
    } catch {
      // Silently ignore — pruning is non-critical.
    }
  }

  /**
   * Prune conversation memories older than the retention period.
   */
  private async pruneOldMemories(userId: string): Promise<void> {
    try {
      const indexKey = `${CONVERSATION_KEY_PREFIX}${userId}:index`;
      const existing = (await memory.query(
        CONVERSATION_MEMORY_TYPE,
        indexKey,
        userId,
      )) as string[] | undefined;
      const index: string[] = existing ?? [];
      if (index.length === 0) return;

      const cutoff = Date.now() - CONVERSATION_RETENTION_MS;
      const toDelete: string[] = [];

      for (const convId of index) {
        const key = `${CONVERSATION_KEY_PREFIX}${convId}`;
        const memRaw = await memory.query(
          CONVERSATION_MEMORY_TYPE,
          key,
          userId,
        );
        const mem = memRaw as ConversationMemory | undefined;
        if (mem && new Date(mem.lastConsolidatedAt).getTime() < cutoff) {
          toDelete.push(convId);
        }
      }

      if (toDelete.length > 0) {
        // D1 doesn't have a direct delete-by-key in the memory adapter,
        // so we use the underlying DB for bulk cleanup.
        const { getD1 } = await import('@/seed/db/client');
        const db = getD1();
        if (db) {
          for (const convId of toDelete) {
            await db
              .prepare(
                'DELETE FROM memory_kv WHERE tenant_id = ? AND type = ? AND key_name = ?',
              )
              .bind(userId, CONVERSATION_MEMORY_TYPE, `${CONVERSATION_KEY_PREFIX}${convId}`)
              .run();
          }
          // Update index to remove deleted entries.
          const remaining = index.filter((id) => !toDelete.includes(id));
          await memory.store(
            CONVERSATION_MEMORY_TYPE,
            indexKey,
            remaining,
            userId,
          );
        }

        logger.info('[MemoryConsolidation] Pruned old memories', {
          userId,
          prunedCount: toDelete.length,
        });
      }
    } catch (err) {
      logger.warn('[MemoryConsolidation] Prune old memories failed', {
        userId,
        error: getErrorMessage(err),
      });
    }
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────────

let consolidationServiceInstance: MemoryConsolidationService | null = null;

/**
 * Get the singleton MemoryConsolidationService instance.
 */
export function getMemoryConsolidationService(): MemoryConsolidationService {
  if (!consolidationServiceInstance) {
    consolidationServiceInstance = new MemoryConsolidationService();
  }
  return consolidationServiceInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetMemoryConsolidationService(): void {
  consolidationServiceInstance = null;
}
