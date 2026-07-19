/**
 * @module seed/ai/token-budget-guard
 *
 * TokenBudgetGuard — logic for enforcing token limits and safety buffers
 * to prevent context overflow in LLM requests.
 *
 * Layer rule: seed only.
 */

import { tokenCounter } from './token-counter';
import { logger } from '@/seed/utils/logger-utility';
import type { ChatMessage } from './provider-interface';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BudgetCheckResult {
  safe: boolean;
  tokensRemaining: number;
  estimatedTokens: number;
}

// ── Implementation ───────────────────────────────────────────────────────────

/**
 * Rough estimate of tokens for a given text.
 * Uses the seed/ai/token-counter for language-aware estimation.
 */
export function estimateTokens(text: string): number {
  return tokenCounter.estimateTokens(text).tokens;
}

/**
 * Checks if the current prompt tokens plus a safety buffer fit within the available budget.
 *
 * @param promptTokens — Current estimated tokens of the prompt/conversation.
 * @param budget — The total token limit for the model.
 * @param safetyBuffer — The reserved space to avoid overflow.
 */
export function checkBudget(
  promptTokens: number,
  budget: number,
  safetyBuffer: number = 20_000
): BudgetCheckResult {
  const effectiveLimit = budget - safetyBuffer;
  const tokensRemaining = effectiveLimit - promptTokens;

  return {
    safe: promptTokens <= effectiveLimit,
    tokensRemaining,
    estimatedTokens: promptTokens,
  };
}

/**
 * Throws an error if the estimated tokens exceed a hard ceiling.
 * Used as a last-line-of-defense before sending to API.
 */
export function enforceHardCeiling(totalEstimated: number, ceiling: number): void {
  if (totalEstimated > ceiling) {
    const errorMsg = `[TokenBudgetGuard] Hard ceiling exceeded: ${totalEstimated}/${ceiling} tokens. Request aborted to prevent context overflow.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Trims the conversation history to fit within a max token budget.
 * Keeps the system prompt (first message) and the most recent messages.
 *
 * @param messages — The array of chat messages.
 * @param maxTokens — The budget to fit into.
 */
export function trimToBudget(messages: ChatMessage[], maxTokens: number): ChatMessage[] {
  if (messages.length === 0) return [];

  // Always preserve the system message if it exists
  const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
  const userMessages = systemMessage ? messages.slice(1) : messages;

  let currentTokens = systemMessage ? tokenCounter.estimateTokens(systemMessage.content).tokens + 4 : 0;
  const trimmedMessages: ChatMessage[] = [];

  // Add messages from the end (most recent) backwards
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const msg = userMessages[i];
    const msgTokens = tokenCounter.estimateTokens(msg.content).tokens + 4;

    if (currentTokens + msgTokens > maxTokens) {
      break;
    }

    trimmedMessages.unshift(msg);
    currentTokens += msgTokens;
  }

  const finalMessages = systemMessage ? [systemMessage, ...trimmedMessages] : trimmedMessages;

  logger.info('[TokenBudgetGuard] Conversation trimmed', undefined, {
    originalCount: messages.length,
    trimmedCount: finalMessages.length,
    finalTokens: currentTokens,
  });

  return finalMessages;
}

/**
 * Simple conversation compression: summarize older messages.
 * In a real implementation, this would call an LLM to summarize.
 * For now, it implements a "summarize via truncation" or a placeholder
 * that the `context-window-enforcer` can coordinate.
 */
export function compressConversation(messages: ChatMessage[]): ChatMessage[] {
  // This is a strategic placeholder. a real compression would use the `conversation-summarizer.ts`
  // logic. For the budget guard, we provide the interface.
  logger.info('[TokenBudgetGuard] compressConversation called (placeholder for summarizer integration)');
  return messages;
}
