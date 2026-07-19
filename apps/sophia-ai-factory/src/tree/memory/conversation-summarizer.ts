/**
 * @module tree/memory/conversation-summarizer

 * ConversationSummarizer — LLM-backed conversation history compression.

 * Compresses long message histories into concise summaries using an
 * OpenAI-compatible /chat/completions endpoint. Falls back to
 * extractive summarization when no LLM is configured.

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
  /** Extracted key topics from the conversation. */
  topics: string[];
  /** Decisions made during the conversation. */
  decisions: string[];
  /** User preferences stated in the conversation. */
  userPreferences: string[];
  /** Action items or next steps agreed upon. */
  actionItems: string[];
  /** Estimated token count (alias for tokenCount, for backward compat). */
  estimatedTokens: number;
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

// ── Keyword patterns for extraction ───────────────────────────────────────────

const TOPIC_KEYWORDS = [
  'docker', 'kubernetes', 'k8s', 'react', 'next.js', 'nextjs',
  'typescript', 'javascript', 'python', 'node.js', 'nodejs',
  'aws', 'terraform', 'ansible', 'nginx', 'stripe', 'cloudflare',
  'e-commerce', 'ecommerce', 'saas', 'video', 'deployment',
  'ci/cd', 'cicd', 'database', 'auth', 'authentication',
  'api', 'microservices', 'monorepo', 'dark mode', 'blue',
];

const DECISION_PATTERNS = [
  /(?:let'?s go with|we decided on|going with|selected|chosen|we chose|decided to use|picked|opted for)\s+(.+?)(?:\.|$)/i,
  /(?:decision|chose|selected):\s*(.+?)(?:\.|$)/i,
];

const PREFERENCE_PATTERNS = [
  /(?:i prefer|i like|i want|prefer|would like)\s+(.+?)(?:\.|$)/i,
];

const ACTION_PATTERNS = [
  /(?:need to|must|should|remember to|make sure to|don'?t forget to)\s+(.+?)(?:\.|$)/i,
  /(?:i will|we will|let me|i'?ll)\s+(.+?)(?:\.|$)/i,
];

const MAX_TOPICS = 5;
const MAX_DECISIONS = 5;
const MAX_PREFERENCES = 5;
const MAX_ACTIONS = 5;

// ── ConversationSummarizer ─────────────────────────────────────────────────────

/**
 * LLM-backed conversation summarizer.

 * Sends message history to an OpenAI-compatible /chat/completions endpoint
 * for compression. Falls back to extractive summarization when no API
 * key or endpoint is configured.

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

   * Uses the configured LLM when available; falls back to extractive
   * summarization (first/last user messages) when no API key is set.

   * @param messages — Chat messages to summarize.
   * @param maxTokens — Optional override for max summary tokens.
   * @returns SummaryResult with summary text, token count, and metadata.
   */
  async summarize(
    messages: ChatMessage[],
    maxTokens?: number,
  ): Promise<SummaryResult> {
    const effectiveMax = maxTokens ?? this.maxSummaryTokens;

    if (messages.length === 0) {
      return {
        summary: 'No messages to summarize.',
        tokenCount: 3,
        messagesSummarized: 0,
        usedLLM: false,
        topics: [],
        decisions: [],
        userPreferences: [],
        actionItems: [],
        estimatedTokens: 3,
      };
    }

    // Extract key points from the conversation
    const keyPoints = this.extractKeyPoints(messages);

    // Attempt LLM summarization when configured.
    if (this.apiKey) {
      try {
        const result = await this.summarizeWithLLM(messages, effectiveMax);
        logger.info('[ConversationSummarizer] LLM summary complete', undefined, {
          messagesSummarized: result.messagesSummarized,
          tokenCount: result.tokenCount,
        });
        return {
          ...result,
          topics: keyPoints.topics,
          decisions: keyPoints.decisions,
          userPreferences: keyPoints.userPreferences,
          actionItems: keyPoints.actionItems,
          estimatedTokens: result.tokenCount,
        };
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
    return {
      ...fallback,
      topics: keyPoints.topics,
      decisions: keyPoints.decisions,
      userPreferences: keyPoints.userPreferences,
      actionItems: keyPoints.actionItems,
      estimatedTokens: fallback.tokenCount,
    };
  }

  // ── Key point extraction ────────────────────────────────────────────────────

  /**
   * Extract structured key points from a conversation: topics, decisions,
   * user preferences, and action items.
   *
   * Uses keyword matching and pattern extraction — no LLM required.
   */
  extractKeyPoints(messages: ChatMessage[]): {
    topics: string[];
    decisions: string[];
    userPreferences: string[];
    actionItems: string[];
  } {
    if (messages.length === 0) {
      return {
        topics: [],
        decisions: [],
        userPreferences: [],
        actionItems: [],
      };
    }

    const allText = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    const topics = this.extractTopics(allText);
    const decisions = this.extractDecisions(allText);
    const userPreferences = this.extractPreferences(allText);
    const actionItems = this.extractActions(allText);

    return {
      topics: this.deduplicate(topics).slice(0, MAX_TOPICS),
      decisions: this.deduplicate(decisions).slice(0, MAX_DECISIONS),
      userPreferences: this.deduplicate(userPreferences).slice(0, MAX_PREFERENCES),
      actionItems: this.deduplicate(actionItems).slice(0, MAX_ACTIONS),
    };
  }

  // ── LLM summarization ───────────────────────────────────────────────────────

  /**
   * Send messages to an OpenAI-compatible /chat/completions endpoint
   * and return the compressed summary.
   */
  private async summarizeWithLLM(
    messages: ChatMessage[],
    maxTokens: number,
  ): Promise<Omit<SummaryResult, 'topics' | 'decisions' | 'userPreferences' | 'actionItems' | 'estimatedTokens'>> {
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

   * Uses the first and last user messages as anchors, plus a count.
   */
  private summarizeExtractive(
    messages: ChatMessage[],
    maxTokens: number,
  ): Omit<SummaryResult, 'topics' | 'decisions' | 'userPreferences' | 'actionItems' | 'estimatedTokens'> {
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

  // ── Extraction helpers ──────────────────────────────────────────────────────

  private extractTopics(text: string): string[] {
    const found: string[] = [];
    const lowerText = text.toLowerCase();
    for (const kw of TOPIC_KEYWORDS) {
      if (lowerText.includes(kw)) {
        found.push(kw);
      }
    }
    return found;
  }

  private extractDecisions(text: string): string[] {
    const found: string[] = [];
    for (const pattern of DECISION_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        const decision = matches[1]?.trim();
        if (decision && decision.length > 2) {
          found.push(decision);
        }
      }
    }
    return found;
  }

  private extractPreferences(text: string): string[] {
    const found: string[] = [];
    for (const pattern of PREFERENCE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        const pref = matches[1]?.trim();
        if (pref && pref.length > 2) {
          found.push(pref);
        }
      }
    }
    return found;
  }

  private extractActions(text: string): string[] {
    const found: string[] = [];
    for (const pattern of ACTION_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        const action = matches[1]?.trim();
        if (action && action.length > 2) {
          found.push(action);
        }
      }
    }
    return found;
  }

  private deduplicate(items: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of items) {
      const normalized = item.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(item);
      }
    }
    return result;
  }

  // ── Token estimation ────────────────────────────────────────────────────────

  /**
   * Estimate token count for text.

   * Vietnamese: ~2.5 chars/token. English: ~4 chars/token.
   * CJK: ~1.3 chars/token.
   */
  private estimateTokens(text: string): number {
    if (text.length === 0) return 0;

    // Use split-based counting to avoid lastIndex mutation from global regex
    const VI_PATTERN = '[À-ỿ]';
    const CJK_PATTERN = '[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]';
    const vietnameseChars = text.split(new RegExp(VI_PATTERN)).length - 1;
    const cjkChars = text.split(new RegExp(CJK_PATTERN)).length - 1;
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
