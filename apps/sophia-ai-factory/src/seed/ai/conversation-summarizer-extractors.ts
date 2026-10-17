/**
 * @module seed/ai/conversation-summarizer-extractors
 *
 * Pure extraction functions for conversation summarization.
 * Extracted from conversation-summarizer.ts to keep each file ≤140 LOC.
 */

import type { ChatMessage } from './provider-interface';
import {
  DECISION_PATTERNS,
  PREFERENCE_PATTERNS,
  ACTION_PATTERNS,
} from './conversation-summarizer-types';
import { extractTopics } from './conversation-topic-extractor';

export { extractTopics };

// ── Key Points Container ──────────────────────────────────────────────────────

/** Structured key points extracted from a conversation. */
export interface KeyPoints {
  topics: string[];
  decisions: string[];
  userPreferences: string[];
  actionItems: string[];
}

// ── Decision Extraction ───────────────────────────────────────────────────────

/**
 * Extract key decisions from the conversation.
 *
 * Looks for decision markers in both user and assistant messages.
 */
export function extractDecisions(messages: ChatMessage[]): string[] {
  const decisions: string[] = [];

  for (const msg of messages) {
    for (const pattern of DECISION_PATTERNS) {
      const matches = msg.content.matchAll(pattern);
      for (const m of matches) {
        const decision = m[1]?.trim();
        if (decision && decision.length > 3 && decision.length < 120) {
          decisions.push(decision);
        }
      }
    }
  }

  return [...new Set(decisions)].slice(0, 5);
}

// ── Preference Extraction ─────────────────────────────────────────────────────

/**
 * Extract user preferences from user messages.
 *
 * Looks for preference markers like "I like", "I prefer", "I don't want".
 */
export function extractPreferences(userMessages: ChatMessage[]): string[] {
  const preferences: string[] = [];

  for (const msg of userMessages) {
    for (const pattern of PREFERENCE_PATTERNS) {
      const matches = msg.content.matchAll(pattern);
      for (const m of matches) {
        const pref = m[1]?.trim();
        if (pref && pref.length > 2 && pref.length < 100) {
          preferences.push(pref);
        }
      }
    }
  }

  return [...new Set(preferences)].slice(0, 5);
}

// ── Action Item Extraction ────────────────────────────────────────────────────

/**
 * Extract action items from the conversation.
 *
 * Looks for task markers, todos, and next-step indicators.
 */
export function extractActionItems(messages: ChatMessage[]): string[] {
  const actionItems: string[] = [];

  for (const msg of messages) {
    for (const pattern of ACTION_PATTERNS) {
      const matches = msg.content.matchAll(pattern);
      for (const m of matches) {
        const item = m[1]?.trim();
        if (item && item.length > 3 && item.length < 120) {
          actionItems.push(item);
        }
      }
    }
  }

  return [...new Set(actionItems)].slice(0, 5);
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Extract all key points from a conversation.
 * Orchestrates individual extraction functions.
 *
 * @param userMessages - Filtered user-role messages (for topics/preferences).
 * @param allMessages - Full message list (for decisions/action items).
 */
export function extractKeyPoints(
  userMessages: ChatMessage[],
  allMessages: ChatMessage[],
): KeyPoints {
  return {
    topics: extractTopics(userMessages),
    decisions: extractDecisions(allMessages),
    userPreferences: extractPreferences(userMessages),
    actionItems: extractActionItems(allMessages),
  };
}
