/**
 * Context and message preparation for POST /api/v1/agent-chat
 * @module app/api/v1/agent-chat/agent-chat-context-prep
 */

import { buildSystemPrompt } from '@/forest/agent-chat/system-prompt';
import { getContextManager, type ContextCheckResult } from '@/forest/agent-chat/context-manager';
import type { ChatMessage, ChatContext } from '@/forest/agent-chat/types';
import { buildConsolidatedMessages } from './agent-chat-helpers';

export async function prepareChatContextAndMessages(
  userId: string,
  messages: ChatMessage[],
  context: ChatContext,
): Promise<{
  contextResult: ContextCheckResult;
  fullMessages: Array<{ role: string; content: string }>;
}> {
  const systemPrompt = await buildSystemPrompt(context, {
    userId,
    injectMemories: true,
    maxMemories: 5,
  });

  const contextManager = getContextManager();
  const contextMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  let contextResult: ContextCheckResult;
  try {
    contextResult = contextManager.checkContext(contextMessages, systemPrompt);
  } catch {
    contextResult = { withinLimit: true, currentTokens: 0, limitTokens: 8192, action: 'none' };
  }

  let fullMessages: Array<{ role: string; content: string }>;
  try {
    if (contextResult.action !== 'none') {
      const trimmed = await contextManager.trimMessages(
        contextMessages,
        systemPrompt,
        undefined,
        contextResult.limitTokens,
      );
      if (contextResult.action === 'summarize+trim') {
        const { summary } = await contextManager.summarizeOlder(
          contextMessages,
          contextManager['minRecent'],
        );
        fullMessages = buildConsolidatedMessages(
          systemPrompt,
          contextMessages,
          contextManager['minRecent'],
          summary.content,
        );
      } else {
        fullMessages = [{ role: 'system', content: systemPrompt }, ...trimmed];
      }
    } else {
      fullMessages = [{ role: 'system', content: systemPrompt }, ...contextMessages];
    }
  } catch {
    fullMessages = [{ role: 'system', content: systemPrompt }, ...contextMessages];
  }

  return { contextResult, fullMessages };
}
