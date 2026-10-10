import { logger } from '@/seed/utils/logger-utility';
import {
  ContextCheckResult,
  ContextManagerOptions,
  ContextMessage,
} from './types';
import {
  DEFAULT_CONTEXT_LIMIT,
  SUMMARIZE_THRESHOLD,
  MIN_RECENT_MESSAGES,
  estimateMessageTokens,
  evaluateContextBudget,
} from './token-budget-allocator';
import {
  trimMessagesWithinBudget,
  summarizeOlderConversation,
} from './message-pruner';

export class ContextManager {
  private readonly contextLimit: number;
  private readonly summarizeThreshold: number;
  private readonly minRecent: number;
  private readonly summarizationEnabled: boolean;

  constructor(options: ContextManagerOptions = {}) {
    this.contextLimit = options.contextLimit ?? DEFAULT_CONTEXT_LIMIT;
    this.summarizeThreshold = options.summarizeThreshold ?? SUMMARIZE_THRESHOLD;
    this.minRecent = options.minRecent ?? MIN_RECENT_MESSAGES;
    this.summarizationEnabled = options.summarizationEnabled ?? true;
  }

  estimateTokens(messages: ContextMessage[]): number {
    return estimateMessageTokens(messages);
  }

  checkContext(
    messages: ContextMessage[],
    systemPrompt: string,
    _model?: string,
  ): ContextCheckResult {
    const result = evaluateContextBudget(
      messages,
      systemPrompt,
      this.contextLimit,
      this.summarizeThreshold,
      this.summarizationEnabled,
    );

    logger.debug('[ContextManager] Context check', {
      currentTokens: result.currentTokens,
      limitTokens: this.contextLimit,
      utilization: (result.currentTokens / this.contextLimit).toFixed(3),
      action: result.action,
    });

    return result;
  }

  async trimMessages(
    messages: ContextMessage[],
    systemPrompt: string,
    _model?: string,
    targetTokens?: number,
  ): Promise<{ role: 'system' | 'user' | 'assistant'; content: string }[]> {
    return trimMessagesWithinBudget(
      messages,
      systemPrompt,
      this.minRecent,
      this.contextLimit,
      targetTokens,
    );
  }

  async summarizeOlder(
    messages: ContextMessage[],
    keepRecent: number,
  ): Promise<{
    summary: { role: 'system'; content: string };
    recent: { role: 'user' | 'assistant'; content: string }[];
  }> {
    return summarizeOlderConversation(messages, keepRecent);
  }
}

let contextManagerInstance: ContextManager | null = null;

export function getContextManager(options?: ContextManagerOptions): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager(options);
  }
  return contextManagerInstance;
}

export function resetContextManager(): void {
  contextManagerInstance = null;
}
