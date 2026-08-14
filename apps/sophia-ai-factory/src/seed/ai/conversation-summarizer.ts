/**
 * @module seed/ai/conversation-summarizer
 *
 * Deterministic conversation summarization — no LLM calls.
 *
 * Compresses message history into a system-message-style summary
 * using extractive techniques: key user messages, assistant responses,
 * and detected topics/decisions/action items.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import type { ConversationSummary } from './conversation-summarizer-types';
import type { KeyPoints } from './conversation-summarizer-extractors';
import { extractKeyPoints } from './conversation-summarizer-extractors';
import { estimateTokens, truncateToTokenBudget, compressMessages } from './conversation-summarizer-helpers';

// ── Re-exports (sub-modules) ──────────────────────────────────────────────────

export type { ConversationSummary } from './conversation-summarizer-types';

export {
  STOP_WORDS,
  DECISION_PATTERNS,
  PREFERENCE_PATTERNS,
  ACTION_PATTERNS,
} from './conversation-summarizer-types';

export type { KeyPoints } from './conversation-summarizer-extractors';

export {
  extractTopics,
  extractDecisions,
  extractPreferences,
  extractActionItems,
  extractKeyPoints,
} from './conversation-summarizer-extractors';

export {
  estimateTokens,
  truncate,
  truncateToTokenBudget,
  compressMessages,
} from './conversation-summarizer-helpers';

// ── ConversationSummarizer ────────────────────────────────────────────────────

/**
 * Deterministic conversation summarizer.
 *
 * Uses extractive techniques to compress message history into a
 * concise summary. No network calls — pure computation.
 */
export class ConversationSummarizer {
  private readonly maxSummaryTokens: number;

  /**
   * @param maxSummaryTokens — Maximum tokens for the generated summary.
   */
  constructor(maxSummaryTokens = 500) {
    this.maxSummaryTokens = maxSummaryTokens;
    logger.info('[ConversationSummarizer] Initialized', undefined, {
      maxSummaryTokens,
    });
  }

  // ── Key point extraction ────────────────────────────────────────────────────

  /**
   * Extract key points from a message array.
   *
   * Identifies topics, decisions, preferences, and action items
   * using pattern matching on message content.
   *
   * @param messages — Chat messages to analyze.
   * @returns Extracted key points.
   */
  extractKeyPoints(messages: ChatMessage[]): KeyPoints {
    const userMessages = messages.filter((m) => m.role === 'user');
    const _assistantMessages = messages.filter((m) => m.role === 'assistant');

    return extractKeyPoints(userMessages, messages);
  }

  /**
   * Summarize a message history into a system-message-style summary.
   *
   * The summary preserves topic, key decisions, user preferences,
   * and action items in a compact format suitable for injection
   * as a system message.
   *
   * @param messages — Chat messages to summarize.
   * @param maxTokens — Optional override for max summary tokens.
   * @returns Structured conversation summary.
   */
  summarize(messages: ChatMessage[], maxTokens?: number): ConversationSummary {
    const effectiveMax = maxTokens ?? this.maxSummaryTokens;
    const keyPoints = this.extractKeyPoints(messages);

    // Build the summary text in system-message style.
    const parts: string[] = [];

    if (keyPoints.topics.length > 0) {
      parts.push(`Topics discussed: ${keyPoints.topics.join(', ')}.`);
    }

    if (keyPoints.decisions.length > 0) {
      parts.push(
        `Key decisions: ${keyPoints.decisions.map((d) => `- ${d}`).join(' ')}`,
      );
    }

    if (keyPoints.userPreferences.length > 0) {
      parts.push(
        `User preferences: ${keyPoints.userPreferences.map((p) => `- ${p}`).join(' ')}`,
      );
    }

    if (keyPoints.actionItems.length > 0) {
      parts.push(
        `Action items: ${keyPoints.actionItems.map((a) => `- ${a}`).join(' ')}`,
      );
    }

    // Fallback: if no structured points found, compress the last few messages.
    let summaryText: string;
    if (parts.length === 0) {
      summaryText = compressMessages(messages, effectiveMax);
    } else {
      summaryText = parts.join(' ');
      // Truncate if over budget.
      summaryText = truncateToTokenBudget(summaryText, effectiveMax);
    }

    return {
      summary: summaryText,
      topics: keyPoints.topics,
      decisions: keyPoints.decisions,
      userPreferences: keyPoints.userPreferences,
      actionItems: keyPoints.actionItems,
      estimatedTokens: estimateTokens(summaryText),
      messagesSummarized: messages.length,
    };
  }
}
