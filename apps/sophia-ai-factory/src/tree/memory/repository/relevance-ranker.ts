/**
 * Keyword Overlap and Relevance Ranking for Memories
 *
 * @module tree/memory/repository/relevance-ranker
 */

import type { RelevantMemory, StoredMemory } from './types';

/**
 * Computes keyword overlap relevance against stored memories.
 *
 * Combines lexical token overlap score with base stored relevance score:
 * combined = keywordScore * 0.4 + memory.relevanceScore * 0.6
 */
export function rankMemoriesByQuery(
  memories: StoredMemory[],
  query: string,
  limit = 20,
): RelevantMemory[] {
  const queryTerms = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );

  if (queryTerms.size === 0) {
    return memories
      .slice(0, limit)
      .map((m) => ({ ...m, relevance: m.relevanceScore }));
  }

  const scored = memories
    .map((memory) => {
      const contentTerms = new Set(
        memory.content.text
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2),
      );
      let overlap = 0;
      for (const term of queryTerms) {
        if (contentTerms.has(term)) overlap++;
      }
      const keywordScore =
        queryTerms.size > 0 ? overlap / queryTerms.size : 0;
      const combined = keywordScore * 0.4 + memory.relevanceScore * 0.6;
      return { ...memory, relevance: combined };
    })
    .filter((m) => m.relevance > 0.05)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return scored;
}
