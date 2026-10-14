/**
 * @module seed/ai/token-counter
 *
 * TokenCounter — heuristic token estimation for AI model context management.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import {
  detectLanguage,
  resolveCharsPerToken,
  type TokenEstimate,
} from './token-counter-heuristics';

export type { TokenEstimate };

export class TokenCounter {
  private readonly mode: 'anthropic' | 'openai';

  constructor(mode: 'anthropic' | 'openai' = 'openai') {
    this.mode = mode;
    logger.info('[TokenCounter] Initialized', undefined, { mode });
  }

  estimateTokens(text: string, model?: string): TokenEstimate {
    if (text.length === 0) {
      return { tokens: 0, characters: 0, language: 'unknown', method: this.mode };
    }

    const language = detectLanguage(text);
    const charsPerToken = resolveCharsPerToken(language, this.mode);
    const tokens = Math.ceil(text.length / charsPerToken);

    logger.debug('[TokenCounter] Estimated tokens', undefined, {
      model: model ?? 'unknown',
      chars: text.length,
      tokens,
      language,
      mode: this.mode,
    });

    return {
      tokens,
      characters: text.length,
      language,
      method: this.mode,
    };
  }

  estimateMessages(messages: ChatMessage[], model?: string): number {
    if (messages.length === 0) return 0;

    const OVERHEAD_PER_MESSAGE = 4;
    let total = 0;

    for (const msg of messages) {
      total += this.estimateTokens(msg.content, model).tokens + OVERHEAD_PER_MESSAGE;
    }

    logger.debug('[TokenCounter] Estimated message tokens', undefined, {
      model: model ?? 'unknown',
      messageCount: messages.length,
      totalTokens: total,
      mode: this.mode,
    });

    return total;
  }
}

/** Default token counter (OpenAI-compatible mode). */
export const tokenCounter = new TokenCounter('openai');
