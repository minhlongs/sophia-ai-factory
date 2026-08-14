/**
 * @module forest/memory/memory-enrichment
 *
 * MemoryEnrichment — post-chat async memory extraction and storage.
 *
 * After a conversation completes, extracts structured memories from the
 * message exchange and stores them as creator_memory entries.
 *
 * Runs asynchronously (fire-and-forget) — never blocks the chat response.
 * Gracefully degrades: if extraction fails, the conversation is unaffected.
 *
 * Import direction: forest → seed, tree (ONE-WAY)
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { MemoryExtractor, type ChatMessage } from '@/tree/memory/memory-extractor'

// ── Types ──────────────────────────────────────────────────────────────────────

/** Options for post-chat memory enrichment. */
export interface MemoryEnrichmentOptions {
  /** User ID to attribute memories to. */
  userId: string;
  /** Minimum confidence threshold for extracted memories (default 0.5). */
  minConfidence?: number;
  /** Maximum memories to extract per type (default 10). */
  maxPerType?: number;
  /** Whether enrichment is enabled (default true). */
  enabled?: boolean;
}

/** Result of an enrichment run. */
export interface EnrichmentResult {
  userId: string;
  success: boolean;
  extractedCount: number;
  storedCount: number;
  skipped: number;
  error?: string;
}

// ── MemoryEnrichment ───────────────────────────────────────────────────────────

/**
 * Post-chat memory enrichment service.
 *
 * Extracts and stores memories from completed conversations.
 * Designed to be called asynchronously after the LLM response streams.
 */
export class MemoryEnrichment {
  private readonly extractor: MemoryExtractor;
  private readonly options: Required<Omit<MemoryEnrichmentOptions, 'userId'>> & { userId: string };

  constructor(options: MemoryEnrichmentOptions) {
    this.extractor = new MemoryExtractor();
    this.options = {
      userId: options.userId,
      minConfidence: options.minConfidence ?? 0.5,
      maxPerType: options.maxPerType ?? 10,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * Enrich memory from a completed chat conversation.
   *
   * Converts API ChatMessage format to extractor format,
   * runs extraction, and stores results.
   *
   * @param messages — the full conversation (user + assistant messages)
   * @returns enrichment result
   */
  async enrich(
    messages: { role: string; content: string }[],
  ): Promise<EnrichmentResult> {
    if (!this.options.enabled) {
      logger.debug('[MemoryEnrichment] Disabled via config, skipping');
      return {
        userId: this.options.userId,
        success: true,
        extractedCount: 0,
        storedCount: 0,
        skipped: 0,
      };
    }

    if (messages.length === 0) {
      return {
        userId: this.options.userId,
        success: true,
        extractedCount: 0,
        storedCount: 0,
        skipped: 0,
      };
    }

    try {
      // Convert to extractor's ChatMessage format.
      const extractorMessages: ChatMessage[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: Date.now(),
        }));

      const result = await this.extractor.extractFromMessages(extractorMessages, {
        userId: this.options.userId,
        minConfidence: this.options.minConfidence,
        maxPerType: this.options.maxPerType,
      });

      logger.info('[MemoryEnrichment] Enrichment complete', {
        userId: this.options.userId,
        messageCount: messages.length,
        extracted: result.extracted.length,
        stored: result.stored.length,
        skipped: result.skipped,
      });

      return {
        userId: this.options.userId,
        success: true,
        extractedCount: result.extracted.length,
        storedCount: result.stored.length,
        skipped: result.skipped,
      };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      logger.error('[MemoryEnrichment] Enrichment failed', {
        userId: this.options.userId,
        error: errorMsg,
      });
      return {
        userId: this.options.userId,
        success: false,
        extractedCount: 0,
        storedCount: 0,
        skipped: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Fire-and-forget enrichment from a completed conversation.
   *
   * Calls enrich() but does not return a promise to the caller.
   * Errors are logged internally.
   *
   * @param messages — the full conversation
   */
  enrichFireAndForget(messages: { role: string; content: string }[]): void {
    this.enrich(messages).catch((err) => {
      logger.warn('[MemoryEnrichment] Fire-and-forget enrichment failed', {
        userId: this.options.userId,
        error: getErrorMessage(err),
      });
    });
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

let enrichmentInstance: MemoryEnrichment | null = null;

/**
 * Get or create the singleton MemoryEnrichment instance.
 */
export function getMemoryEnrichment(options?: MemoryEnrichmentOptions): MemoryEnrichment {
  if (!enrichmentInstance) {
    enrichmentInstance = new MemoryEnrichment(options ?? { userId: 'anonymous' });
  }
  return enrichmentInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetMemoryEnrichment(): void {
  enrichmentInstance = null;
}
