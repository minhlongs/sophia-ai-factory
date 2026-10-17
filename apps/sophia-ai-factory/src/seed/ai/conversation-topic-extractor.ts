/**
 * @module seed/ai/conversation-topic-extractor
 *
 * Pure topic extraction helper for conversation summarization.
 */

import type { ChatMessage } from './provider-interface';
import { STOP_WORDS } from './conversation-summarizer-types';

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
