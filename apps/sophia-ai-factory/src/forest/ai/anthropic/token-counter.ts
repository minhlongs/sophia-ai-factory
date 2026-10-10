/**
 * @module forest/ai/anthropic/token-counter
 * Token counting and cost estimation routines for Anthropic models.
 */

import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';

export function countAnthropicTokens(messages: ChatMessage[], _model: string): number {
  let total = 0;
  const overheadPerMessage = 4;
  for (const msg of messages) {
    const cjkOrVn = (msg.content.match(/[一-鿿぀-ゟ가-힯À-ɏẠ-ỿ]/g) ?? []).length;
    const remaining = msg.content.length - cjkOrVn;
    total += Math.ceil(cjkOrVn + remaining / 4) + overheadPerMessage;
  }
  return total;
}

export function estimateAnthropicCost(
  messages: ChatMessage[],
  model: string,
  options?: ChatOptions,
): number {
  const inputTokens = countAnthropicTokens(messages, model);
  const maxTokens = options?.maxTokens ?? Math.ceil(inputTokens * 0.5);
  const outputTokens = Math.min(maxTokens, 4096);

  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-opus-4': { input: 15.0, output: 75.0 },
    'claude-haiku-3-5': { input: 0.8, output: 4.0 },
    'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
    'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  };

  const prices = pricing[model];
  if (!prices) {
    logger.warn('[AnthropicProvider] No pricing for model', undefined, { model });
    return 0;
  }

  const cost = (inputTokens / 1000) * prices.input + (outputTokens / 1000) * prices.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
