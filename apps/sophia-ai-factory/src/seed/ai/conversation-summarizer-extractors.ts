/**
 * @module seed/ai/conversation-summarizer-extractors
 *
 * Pure extraction functions for conversation summarization.
 * Extracted from conversation-summarizer.ts to keep each file ≤200 LOC.
 */

import type { ChatMessage } from './provider-interface';
import {
  STOP_WORDS,
  DECISION_PATTERNS,
  PREFERENCE_PATTERNS,
  ACTION_PATTERNS,
} from './conversation-summarizer-types';

// ── Key Points Container ──────────────────────────────────────────────────────

/** Structured key points extracted from a conversation. */
export interface KeyPoints {
  topics: string[];
  decisions: string[];
  userPreferences: string[];
  actionItems: string[];
}

// ── Topic Extraction ──────────────────────────────────────────────────────────

/**
 * Extract conversation topics from user messages.
 *
 * Uses keyword frequency and sentence position to identify
 * the main subjects discussed.
 */
export function extractTopics(userMessages: ChatMessage[]): string[] {
  if (userMessages.length === 0) return [];

  // Collect meaningful words from user messages.
  const wordFreq: Map<string, number> = new Map();
  const wordPositions: Map<string, number> = new Map();

  for (const msg of userMessages) {
    const words = msg.content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
      // Earlier messages get lower position score (more important).
      const posScore = userMessages.length - i;
      const existing = wordPositions.get(w) ?? 0;
      wordPositions.set(w, existing + posScore);
    }
  }

  // Score words: frequency * position weight.
  const scored = Array.from(wordFreq.entries()).map(([word, freq]) => ({
    word,
    score: freq * (wordPositions.get(word) ?? 1),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Return top topics (deduplicate similar words by prefix).
  const topics: string[] = [];
  const usedPrefixes = new Set<string>();

  for (const { word } of scored) {
    if (topics.length >= 5) break;
    const prefix = word.slice(0, 4);
    if (!usedPrefixes.has(prefix)) {
      topics.push(word);
      usedPrefixes.add(prefix);
    }
  }

  return topics;
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
