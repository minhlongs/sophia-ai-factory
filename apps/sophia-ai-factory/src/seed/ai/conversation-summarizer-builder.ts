/**
 * @module seed/ai/conversation-summarizer-builder
 *
 * Summary assembly logic for ConversationSummarizer.
 * Layer rule: seed only.
 */

import type { ChatMessage } from './provider-interface';
import type { ConversationSummary } from './conversation-summarizer-types';
import type { KeyPoints } from './conversation-summarizer-extractors';
import {
  estimateTokens,
  truncateToTokenBudget,
  compressMessages,
} from './conversation-summarizer-helpers';

/**
 * Assemble a structured ConversationSummary from extracted key points
 * and raw messages within the specified token budget.
 */
export function buildConversationSummary(
  messages: ChatMessage[],
  keyPoints: KeyPoints,
  effectiveMax: number,
): ConversationSummary {
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

  let summaryText: string;
  if (parts.length === 0) {
    summaryText = compressMessages(messages, effectiveMax);
  } else {
    summaryText = parts.join(' ');
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
