/**
 * Pattern Matchers for Extractive Key Points
 *
 * Layer: tree/memory/summarizer
 */

import {
  TOPIC_KEYWORDS,
  DECISION_PATTERNS,
  PREFERENCE_PATTERNS,
  ACTION_PATTERNS,
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
