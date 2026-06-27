/**
 * @module seed/ai/token-counter
 *
 * TokenCounter — heuristic token estimation for AI model context management.
 *
 * Supports two estimation modes:
 * - Anthropic approximation: ~3.5 chars/token for English, ~1.8 chars/token for Vietnamese
 * - OpenAI-compatible estimation: ~4 chars/token for English, ~2.5 chars/token for Vietnamese
 *
 * No external tokenizer dependency — pure character-count heuristics.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Result of a token estimation call.
 */
export interface TokenEstimate {
  /** Estimated total token count. */
  tokens: number;
  /** Approximate character count of the input. */
  characters: number;
  /** Detected language hint: 'en' | 'vi' | 'mixed' | 'unknown'. */
  language: string;
  /** Estimation method used. */
  method: 'anthropic' | 'openai';
}

// ── Language detection ─────────────────────────────────────────────────────────

/**
 * Vietnamese character range (lowercase + uppercase, with diacritics).
 * Covers: À-ẮẲẴẶẤẦẨẪẬẺẼỀỀỂỄỆỈỊỌỎỜỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸ
 *          à-ắẳẵặấầẩẫậẻẽềềểễệỉịọỏờờởỡợụủứừửữựỳỵỷỹ
 */
const VIETNAMESE_PATTERN = '[À-ỿ]';
const CJK_PATTERN = '[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]';

/**
 * Detect the dominant language in a text sample.
 *
 * @param text — Text to analyze.
 * @returns 'vi' | 'en' | 'mixed' | 'unknown'.
 */
function detectLanguage(text: string): string {
  // Use fresh RegExp instances to avoid lastIndex mutation from prior .match()/.replace() calls
  const vietnameseChars = (text.match(new RegExp(VIETNAMESE_PATTERN, 'g')) ?? []).length;
  const cjkChars = (text.match(new RegExp(CJK_PATTERN, 'g')) ?? []).length;
  const totalAlpha = text.replace(/[^a-zA-ZÀ-ỿ一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g, '').length;

  if (totalAlpha === 0) return 'unknown';

  const viRatio = vietnameseChars / totalAlpha;
  const cjkRatio = cjkChars / totalAlpha;

  if (viRatio > 0.15) return 'vi';
  if (cjkRatio > 0.1) return 'mixed';
  if (viRatio > 0.05 && cjkRatio === 0) return 'mixed';
  return 'en';
}

// ── TokenCounter ───────────────────────────────────────────────────────────────

/**
 * Heuristic token counter for AI model context management.
 *
 * Two estimation modes:
 * - Anthropic: slightly more conservative (~3.5 EN chars/token, ~1.8 VN chars/token)
 * - OpenAI-compatible: standard approximation (~4 EN chars/token, ~2.5 VN chars/token)
 *
 * Vietnamese text is denser in tokens per character because each
 * accented character maps to roughly one token in most tokenizers.
 */
export class TokenCounter {
  private readonly mode: 'anthropic' | 'openai';

  /**
   * @param mode — Estimation mode. 'openai' (default) uses ~4 chars/token for EN,
   *   ~2.5 for VN. 'anthropic' uses ~3.5 for EN, ~1.8 for VN (more conservative).
   */
  constructor(mode: 'anthropic' | 'openai' = 'openai') {
    this.mode = mode;
    logger.info('[TokenCounter] Initialized', undefined, { mode });
  }

  // ── Single text estimation ──────────────────────────────────────────────────

  /**
   * Estimate the token count for a text string.
   *
   * Automatically detects Vietnamese content and applies the appropriate
   * chars-per-token heuristic. Falls back to English heuristic for
   * unknown/CJK text.
   *
   * @param text — Text to estimate.
   * @param model — Model identifier (logged for observability; affects
   *   heuristic selection only if a model-specific override is registered).
   * @returns TokenEstimate with count, language hint, and method.
   */
  estimateTokens(text: string, model?: string): TokenEstimate {
    if (text.length === 0) {
      return { tokens: 0, characters: 0, language: 'unknown', method: this.mode };
    }

    const language = detectLanguage(text);
    const charsPerToken = this.charsPerToken(language);
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

  // ── Message array estimation ────────────────────────────────────────────────

  /**
   * Estimate the total token count for an array of chat messages.
   *
   * Adds per-message overhead for role tokens and message framing
   * (typically 4 tokens per message for role + formatting).
   *
   * @param messages — Chat messages to estimate.
   * @param model — Model identifier (for logging and model-specific heuristics).
   * @returns Total estimated token count across all messages.
   */
  estimateMessages(messages: ChatMessage[], model?: string): number {
    if (messages.length === 0) return 0;

    const OVERHEAD_PER_MESSAGE = 4; // role token + message framing
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Get the chars-per-token ratio for a detected language.
   *
   * Vietnamese is denser (fewer chars per token) because each
   * diacritic-bearing character typically maps to one token.
   */
  private charsPerToken(language: string): number {
    switch (language) {
      case 'vi':
        // Vietnamese: ~2 chars per token (dense diacritics)
        return this.mode === 'anthropic' ? 1.8 : 2.5;
      case 'mixed':
        // Mixed CJK + EN: average of CJK (~1.3) and EN (~4)
        return this.mode === 'anthropic' ? 2.5 : 3.0;
      case 'en':
      default:
        // English/ASCII: ~4 chars per token
        return this.mode === 'anthropic' ? 3.5 : 4.0;
    }
  }
}

// ── Singleton convenience ──────────────────────────────────────────────────────

/** Default token counter (OpenAI-compatible mode). */
export const tokenCounter = new TokenCounter('openai');
