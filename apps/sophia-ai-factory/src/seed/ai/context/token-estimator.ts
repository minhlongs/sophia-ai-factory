import type { ChatMessage } from '../provider-interface';

/**
 * Estimate tokens for a plain text string.
 *
 * Vietnamese: ~2.5 chars/token (OpenAI mode) or ~1.8 (Anthropic mode).
 * English: ~4 chars/token (OpenAI) or ~3.5 (Anthropic).
 * CJK: ~1.3 chars/token.
 */
export function estimateTextTokens(text: string): number {
  if (text.length === 0) return 0;

  const vietnameseChars = (text.match(/[À-ɏẠ-ỿ]/g) ?? []).length;
  const cjkChars = (text.match(/[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g) ?? []).length;
  const remaining = text.length - vietnameseChars - cjkChars;

  // Approximate: VN ~2.5 chars/token, CJK ~1.3, EN ~4.0
  const vnTokens = vietnameseChars / 2.5;
  const cjkTokens = cjkChars / 1.3;
  const enTokens = remaining / 4.0;

  return Math.ceil(vnTokens + cjkTokens + enTokens);
}

/**
 * Estimate tokens for an array of messages (content + per-message overhead).
 */
export function estimateMessageTokens(messages: ChatMessage[]): number {
  if (messages.length === 0) return 0;

  const OVERHEAD_PER_MESSAGE = 4; // role + formatting tokens
  let total = 0;

  for (const msg of messages) {
    total += estimateTextTokens(msg.content) + OVERHEAD_PER_MESSAGE;
  }

  return total;
}
