/**
 * @module tree/memory/conversation-summarizer
 *
 * ConversationSummarizer — LLM-backed conversation history compression.
 *
 * Compresses long message histories into concise summaries using an
 * OpenAI-compatible /chat/completions endpoint. Falls back to
 * extractive summarization when no LLM is configured.
 *
 * Layer rule: tree → seed only. No imports from forest/ or land/.
 */

import type { ChatMessage } from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Result of a conversation summarization call.
 */
export interface SummaryResult {
  /** Condensed summary text suitable for system-message injection. */
  summary: string;
  /** Approximate token count of the generated summary. */
  tokenCount: number;
  /** Number of input messages that were summarized. */
  messagesSummarized: number;
  /** Whether the LLM was used (true) or extractive fallback (false). */
  usedLLM: boolean;
}

// ── Summarization prompt ───────────────────────────────────────────────────────

const SUMMARIZATION_SYSTEM_PROMPT = `You are a conversation summarizer. Compress the following chat history into a concise summary that preserves:
- Key topics and decisions made
- User preferences and requirements stated
- Action items or next steps agreed upon
- Important context needed to continue the conversation

Write 3-8 sentences. Be specific — include names, numbers, and concrete choices. Do NOT add information not present in the messages.`;

const SUMMARIZATION_USER_TEMPLATE = (
  messageCount: number,
): string => `Summarize the following ${messageCount} chat messages:\n\n`;

// ── ConversationSummarizer ─────────────────────────────────────────────────────

/**
 * LLM-backed conversation summarizer.
 *
 * Sends message history to an OpenAI-compatible /chat/completions endpoint
 * for compression. Falls back to extractive summarization when no API
 * key or endpoint is configured.
 *
 * All LLM calls go through fetch — no provider adapter dependency,
 * keeping this module lightweight and tree-layer-safe.
 */
export class ConversationSummarizer {
  private readonly maxSummaryTokens: number;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  /**
   * @param maxSummaryTokens — Maximum tokens for the generated summary (default 500).
   * @param apiKey — OpenAI-compatible API key. Falls back to OPENROUTER_API_KEY env var.
   * @param baseUrl — Base URL for the completions endpoint. Defaults to OpenRouter.
   */
  constructor(
    maxSummaryTokens = 500,
    apiKey?: string,
    baseUrl = 'https://openrouter.ai/api/v1',
  ) {
    this.maxSummaryTokens = maxSummaryTokens;
    this.apiKey = apiKey ?? process.env.OPENROUTER_API_KEY;
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // trim trailing slashes

    logger.info('[ConversationSummarizer] Initialized', undefined, {
      maxSummaryTokens,
      hasApiKey: Boolean(this.apiKey),
      baseUrl: this.baseUrl,
    });
  }

  // ── Main entry point ────────────────────────────────────────────────────────

  /**
   * Summarize a message history into a concise text summary.
   *
   * Uses the configured LLM when available; falls back to extractive
   * summarization (first/last user messages) when no API key is set.
   *
   * @param messages — Chat messages to summarize.
   * @param maxTokens — Optional override for max summary tokens.
   * @returns SummaryResult with summary text, token count, and metadata.
   */
  async summarize(messages: ChatMessage[], maxTokens?: number): Promise<SummaryResult> {
    const effectiveMax = maxTokens ?? this.maxSummaryTokens;

    if (messages.length === 0) {
      return {
        summary: '',
        tokenCount: 0,
        messagesSummarized: 0,
        usedLLM: false,
      };
    }

    // Attempt LLM summarization when configured.
    if (this.apiKey) {
      try {
        const result = await this.summarizeWithLLM(messages, effectiveMax);
        logger.info('[ConversationSummarizer] LLM summary complete', undefined, {
          messagesSummarized: result.messagesSummarized,
          tokenCount: result.tokenCount,
        });
        return result;
      } catch (err) {
        logger.warn('[ConversationSummarizer] LLM summarization failed, using fallback', undefined, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Extractive fallback.
    const fallback = this.summarizeExtractive(messages, effectiveMax);
    logger.info('[ConversationSummarizer] Extractive fallback summary', undefined, {
      messagesSummarized: fallback.messagesSummarized,
      tokenCount: fallback.tokenCount,
    });
    return fallback;
  }

  // ── LLM summarization ───────────────────────────────────────────────────────

  /**
   * Send messages to an OpenAI-compatible /chat/completions endpoint
   * and return the compressed summary.
   */
  private async summarizeWithLLM(
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<SummaryResult> {
    if (!this.apiKey) {
      throw new Error('No API key configured for LLM summarization');
    }

    // Build the prompt: system + user message containing the conversation.
    const userContent = [
      SUMMARIZATION_USER_TEMPLATE(messages.length),
      ...messages.map((m, i) => `[${i + 1}] ${m.role}: ${m.content}`).join('\n'),
    ].join('');

    const requestBody = {
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARIZATION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://sophia.agencyos.network',
        'X-Title': 'Sophia AI Factory',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `LLM summarization failed: ${response.status} ${response.statusText} — ${errorText.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };

    const summaryText = data.choices?.[0]?.message?.content?.trim() ?? '';
    const tokenCount = data.usage?.total_tokens ?? this.estimateTokens(summaryText);

    return {
      summary: summaryText,
      tokenCount,
      messagesSummarized: messages.length,
      usedLLM: true,
    };
  }

  // ── Extractive fallback ─────────────────────────────────────────────────────

  /**
   * Produce a lightweight summary without LLM calls.
   *
   * Uses the first and last user messages as anchors, plus a count.
   */
  private summarizeExtractive(
    messages: ChatMessage[],
    maxTokens: number,
  ): SummaryResult {
    const userMessages = messages.filter((m) => m.role === 'user');

    if (userMessages.length === 0) {
      return {
        summary: `Conversation with ${messages.length} messages.`,
        tokenCount: this.estimateTokens(`Conversation with ${messages.length} messages.`),
        messagesSummarized: messages.length,
        usedLLM: false,
      };
    }

    const firstMsg = userMessages[0].content;
    const lastMsg = userMessages[userMessages.length - 1].content;

    const segments: string[] = [];
    if (firstMsg.length > 0) {
      segments.push(`Started: "${this.truncate(firstMsg, 120)}"`);
    }
    if (userMessages.length > 1) {
      segments.push(`Latest: "${this.truncate(lastMsg, 120)}"`);
    }
    segments.push(`Total: ${messages.length} messages exchanged.`);

    let summaryText = segments.join(' ');
    summaryText = this.truncateToTokenBudget(summaryText, maxTokens);

    return {
      summary: summaryText,
      tokenCount: this.estimateTokens(summaryText),
      messagesSummarized: messages.length,
      usedLLM: false,
    };
  }

  // ── Token estimation ────────────────────────────────────────────────────────

  /**
   * Estimate token count for text.
   *
   * Vietnamese: ~2.5 chars/token. English: ~4 chars/token.
   * CJK: ~1.3 chars/token.
   */
  private estimateTokens(text: string): number {
    if (text.length === 0) return 0;

    const vietnameseChars = (text.match(/[À-ɏẠ-ỿ]/g) ?? []).length;
    const cjkChars = (text.match(/[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g) ?? []).length;
    const remaining = text.length - vietnameseChars - cjkChars;

    const tokens =
      vietnameseChars / 2.5 + cjkChars / 1.3 + remaining / 4.0;
    return Math.ceil(tokens);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Truncate text to a maximum character length.
   */
  private truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 3).trimEnd() + '...';
  }

  /**
   * Truncate text to fit within a token budget.
   */
  private truncateToTokenBudget(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    const ratio = maxTokens / estimatedTokens;
    const targetChars = Math.floor(text.length * ratio * 0.9);
    return this.truncate(text, Math.max(targetChars, 20));
  }
}
