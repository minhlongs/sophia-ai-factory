/**
 * @module forest/memory/memory-enrichment-types
 *
 * Types and helpers for post-chat async memory enrichment.
 * Import direction: forest → seed, tree (ONE-WAY)
 */

import type { ChatMessage } from '@/tree/memory/memory-extractor';

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

export function createEmptyEnrichmentResult(
  userId: string,
  error?: string,
): EnrichmentResult {
  return {
    userId,
    success: !error,
    extractedCount: 0,
    storedCount: 0,
    skipped: 0,
    ...(error ? { error } : {}),
  };
}

export function toExtractorChatMessages(
  messages: { role: string; content: string }[],
): ChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: Date.now(),
    }));
}
