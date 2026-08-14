/**
 * @module seed/ai/conversation-summarizer-helpers
 *
 * Utility functions for conversation summarization.
 * Extracted from conversation-summarizer.ts to keep each file ≤200 LOC.
 */

import type { ChatMessage } from './provider-interface';

// ── Token Estimation ──────────────────────────────────────────────────────────

/**
 * Estimate token count for text (chars/4 with 10% overhead).
 * CJK-aware: counts CJK characters individually.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  const cjkCount = (text.match(/[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g) ?? []).length;
  const remaining = text.length - cjkCount;
  return Math.ceil((cjkCount + remaining / 4) * 1.1);
}

// ── Text Truncation ───────────────────────────────────────────────────────────

/**
 * Truncate text to a maximum character length.
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3).trimEnd() + '...';
}

/**
 * Truncate text to fit within a token budget.
 * Reduces proportionally when over budget.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) return text;

  // Reduce proportionally.
  const ratio = maxTokens / tokens;
  const targetChars = Math.floor(text.length * ratio * 0.9); // slight buffer
  return truncate(text, Math.max(targetChars, 20));
}

// ── Message Compression ───────────────────────────────────────────────────────

/**
 * Compress messages into a brief summary when no structured
 * points are found. Uses first/last user messages as anchors.
 */
export function compressMessages(
  messages: ChatMessage[],
  maxTokens: number,
): string {
  const userMessages = messages.filter((m) => m.role === 'user');
  if (userMessages.length === 0) {
    return `Conversation with ${messages.length} messages.`;
  }

  const firstMsg = userMessages[0].content;
  const lastMsg = userMessages[userMessages.length - 1].content;

  const segments: string[] = [];
  if (firstMsg.length > 0) {
    segments.push(`Started with: "${truncate(firstMsg, 100)}"`);
  }
  if (userMessages.length > 1) {
    segments.push(`Latest: "${truncate(lastMsg, 100)}"`);
  }
  segments.push(`Total: ${messages.length} messages exchanged.`);

  const result = segments.join(' ');
  return truncateToTokenBudget(result, maxTokens);
}
