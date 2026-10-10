import { ContextMessage } from './types';
import { estimateMessageTokens } from './token-budget-allocator';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export async function trimMessagesWithinBudget(
  messages: ContextMessage[],
  systemPrompt: string,
  minRecent: number,
  contextLimit: number,
  targetTokens?: number,
): Promise<{ role: 'system' | 'user' | 'assistant'; content: string }[]> {
  const budget = targetTokens ?? contextLimit;
  const result: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  const conversation = messages.filter((m) => m.role !== 'system');
  if (conversation.length === 0) {
    return result;
  }

  const keepRecent = Math.min(minRecent, conversation.length);
  const recentMessages = conversation.slice(-keepRecent);
  const recentTokens = estimateMessageTokens([
    { role: 'system', content: systemPrompt },
    ...recentMessages,
  ]);

  if (recentTokens <= budget) {
    for (const m of recentMessages) {
      result.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
    return result;
  }

  logger.warn('[ContextManager] Recent messages exceed budget, aggressive trim', {
    recentTokens,
    budget,
    recentCount: recentMessages.length,
  });

  const trimmed: ContextMessage[] = [];
  let tokens = estimateMessageTokens([{ role: 'system', content: systemPrompt }]);
  for (const m of [...recentMessages].reverse()) {
    const mTokens = estimateMessageTokens([m]);
    if (tokens + mTokens > budget) break;
    trimmed.unshift(m);
    tokens += mTokens;
  }

  for (const m of trimmed) {
    result.push({ role: m.role as 'user' | 'assistant', content: m.content });
  }

  return result;
}

export async function generateSummary(messages: ContextMessage[]): Promise<string> {
  const lines: string[] = [
    `[Context summary — ${messages.length} earlier messages condensed]`,
  ];

  let currentRole: string | null = null;
  let currentContent: string[] = [];

  const flush = () => {
    if (currentContent.length === 0) return;
    const combined = currentContent.join(' ');
    const truncated = combined.length > 300
      ? combined.slice(0, 300) + '...'
      : combined;
    lines.push(`[${currentRole}]: ${truncated}`);
    currentContent = [];
  };

  for (const msg of messages) {
    if (msg.role === currentRole) {
      currentContent.push(msg.content);
    } else {
      flush();
      currentRole = msg.role;
      currentContent = [msg.content];
    }
  }
  flush();

  return lines.join('\n');
}

export async function summarizeOlderConversation(
  messages: ContextMessage[],
  keepRecent: number,
): Promise<{
  summary: { role: 'system'; content: string };
  recent: { role: 'user' | 'assistant'; content: string }[];
}> {
  const recent = messages.slice(-keepRecent);
  const older = messages.slice(0, messages.length - keepRecent);

  let summaryContent: string;
  try {
    summaryContent = await generateSummary(older);
  } catch (err) {
    logger.warn('[ContextManager] Summarization failed, using truncated fallback', {
      error: getErrorMessage(err),
      olderCount: older.length,
    });
    const lines: string[] = [
      `[Context summary — ${older.length} earlier messages (truncated)]`,
    ];
    for (const msg of older) {
      const truncated = msg.content.length > 150
        ? msg.content.slice(0, 150) + '...'
        : msg.content;
      lines.push(`[${msg.role}]: ${truncated}`);
    }
    summaryContent = lines.join('\n');
  }

  return {
    summary: { role: 'system', content: summaryContent },
    recent: recent.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  };
}
