import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { getContextManager } from '../context-manager';
import type { ConsolidationResult } from '../memory-consolidation-types';
import { storeSummaryAsync } from '../memory-consolidation-storage';
import { pruneOldMemoriesAsync } from './pruner';

export async function runConversationConsolidation(
  contextManager: ReturnType<typeof getContextManager>,
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
    const systemPrompt =
      messages.find((m) => m.role === 'system')?.content ?? 'You are a helpful AI assistant.';
    const chatMessages = messages.filter((m) => m.role !== 'system');
    const contextResult = contextManager.checkContext(chatMessages, systemPrompt);

    let trimmedMessages = [...messages];
    let summaryContent: string | null = null;

    if (contextResult.action === 'trim') {
      trimmedMessages = await contextManager.trimMessages(chatMessages, systemPrompt);
    } else if (contextResult.action === 'summarize+trim') {
      const { summary, recent } = await contextManager.summarizeOlder(chatMessages, 4);

      if (summary) {
        summaryContent = summary.content;
        trimmedMessages = [
          { role: 'system', content: systemPrompt },
          summary,
          ...recent,
        ];
      } else {
        trimmedMessages = await contextManager.trimMessages(chatMessages, systemPrompt);
      }
    }

    const tokensAfter = contextManager.estimateTokens(trimmedMessages);

    let summaryStored = false;
    if (summaryContent) {
      storeSummaryAsync(conversationId, summaryContent, messages.length, userId)
        .then((stored) => {
          summaryStored = stored;
        })
        .catch(() => {
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

    pruneOldMemoriesAsync(userId);

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
