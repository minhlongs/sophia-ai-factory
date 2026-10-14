/**
 * Message summarization and async memory consolidation helpers for ContextWindowService.
 * @module forest/memory/context/context-summarizer-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { MemoryConsolidator } from '@/tree/memory/memory-consolidator';

/**
 * Summarize the oldest messages, keeping the most recent N.
 */
export function summarizeOldestMessages(
  messages: { role: string; content: string }[],
  keepRecent: number,
): { role: string; content: string }[] {
  const total = messages.length;
  if (total <= keepRecent + 1) {
    return messages;
  }

  const systemMsg = messages.find((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  const recent = conversation.slice(-keepRecent);
  const older = conversation.slice(0, conversation.length - keepRecent);

  if (older.length === 0) {
    return messages;
  }

  const summaryLines: string[] = [];
  for (const msg of older) {
    const truncated =
      msg.content.length > 200 ? msg.content.slice(0, 200) + '...' : msg.content;
    summaryLines.push(`[${msg.role}]: ${truncated}`);
  }

  const summaryContent = [
    `[Context summary — ${older.length} earlier messages condensed]`,
    ...summaryLines,
  ].join('\n');

  const result: { role: string; content: string }[] = [];
  if (systemMsg) {
    result.push(systemMsg);
  }
  result.push({ role: 'system', content: summaryContent });
  result.push(...recent);

  return result;
}

/**
 * Trigger memory consolidation asynchronously (fire-and-forget).
 */
export function triggerAsyncMemoryConsolidation(userId: string): void {
  try {
    const consolidator = new MemoryConsolidator();
    consolidator.consolidate(userId).catch((err) => {
      logger.warn('[ContextWindow] Async consolidation failed', {
        userId,
        error: getErrorMessage(err),
      });
    });
  } catch {
    // Silently ignore — consolidation is non-critical.
  }
}
