/**
 * Extractive Summarizer and Key Points Extractor
 *
 * Layer: tree/memory/summarizer
 */

import type { ChatMessage } from '@/seed/ai/provider-interface';
import {
  MAX_TOPICS,
  MAX_DECISIONS,
  MAX_PREFERENCES,
  MAX_ACTIONS,
  estimateTokens,
  truncate,
  truncateToTokenBudget,
} from './types';
import {
  deduplicate,
  extractTopics,
  extractDecisions,
  extractPreferences,
  extractActions,
} from './key-point-matchers';

export {
  deduplicate,
  extractTopics,
  extractDecisions,
  extractPreferences,
  extractActions,
};

export function extractKeyPoints(messages: ChatMessage[]): {
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

  return {
    topics: deduplicate(extractTopics(allText)).slice(0, MAX_TOPICS),
    decisions: deduplicate(extractDecisions(allText)).slice(0, MAX_DECISIONS),
    userPreferences: deduplicate(extractPreferences(allText)).slice(0, MAX_PREFERENCES),
    actionItems: deduplicate(extractActions(allText)).slice(0, MAX_ACTIONS),
  };
}

export function summarizeExtractive(
  messages: ChatMessage[],
  maxTokens: number,
): {
  summary: string;
  tokenCount: number;
  messagesSummarized: number;
  usedLLM: boolean;
} {
  const userMessages = messages.filter((m) => m.role === 'user');

  if (userMessages.length === 0) {
    const defaultText = `Conversation with ${messages.length} messages.`;
    return {
      summary: defaultText,
      tokenCount: estimateTokens(defaultText),
      messagesSummarized: messages.length,
      usedLLM: false,
    };
  }

  const firstMsg = userMessages[0].content;
  const lastMsg = userMessages[userMessages.length - 1].content;

  const segments: string[] = [];
  if (firstMsg.length > 0) {
    segments.push(`Started: "${truncate(firstMsg, 120)}"`);
  }
  if (userMessages.length > 1) {
    segments.push(`Latest: "${truncate(lastMsg, 120)}"`);
  }
  segments.push(`Total: ${messages.length} messages exchanged.`);

  let summaryText = segments.join(' ');
  summaryText = truncateToTokenBudget(summaryText, maxTokens);

  return {
    summary: summaryText,
    tokenCount: estimateTokens(summaryText),
    messagesSummarized: messages.length,
    usedLLM: false,
  };
}
