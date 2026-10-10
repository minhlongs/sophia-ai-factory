/**
 * Extractive Summarizer and Key Points Extractor
 *
 * Layer: tree/memory/summarizer
 */

import type { ChatMessage } from '@/seed/ai/provider-interface';
import {
  TOPIC_KEYWORDS,
  DECISION_PATTERNS,
  PREFERENCE_PATTERNS,
  ACTION_PATTERNS,
  MAX_TOPICS,
  MAX_DECISIONS,
  MAX_PREFERENCES,
  MAX_ACTIONS,
  estimateTokens,
  truncate,
  truncateToTokenBudget,
} from './types';

export function deduplicate(items: string[]): string[] {
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

export function extractTopics(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  for (const kw of TOPIC_KEYWORDS) {
    if (lowerText.includes(kw)) {
      found.push(kw);
    }
  }
  return found;
}

export function extractDecisions(text: string): string[] {
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

export function extractPreferences(text: string): string[] {
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

export function extractActions(text: string): string[] {
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
