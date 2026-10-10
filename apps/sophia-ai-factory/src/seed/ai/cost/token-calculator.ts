/**
 * @module seed/ai/cost/token-calculator
 * Token counting heuristics for cost estimation.
 * Layer rule: seed only.
 */

import type { ChatMessage } from '../provider-interface';

/**
 * Rough token-count heuristic for cost estimation.
 *
 * Uses character-based approximation (4 chars ≈ 1 token for
 * English, ~2.5 chars for Vietnamese).
 */
export function estimateTokenCount(text: string): number {
  const cjkOrVn = (text.match(/[一-鿿぀-ゟ가-힯À-ɏẠ-ỿ]/g) ?? []).length;
  const remaining = text.length - cjkOrVn;
  return Math.ceil(cjkOrVn + remaining / 4);
}

/**
 * Count tokens across a message array.
 */
export function countMessageTokens(messages: ChatMessage[]): number {
  const overheadPerMessage = 4;
  let total = 0;
  for (const msg of messages) {
    total += estimateTokenCount(msg.content) + overheadPerMessage;
  }
  return total;
}
