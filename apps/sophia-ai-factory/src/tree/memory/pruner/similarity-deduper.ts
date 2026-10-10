import { logger } from '@/seed/utils/logger-utility';
import type { D1, MemoryCandidate } from './types';

/**
 * Extract the text field from a content_json string.
 */
export function extractText(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson) as { text?: string };
    return parsed.text ?? contentJson;
  } catch {
    return contentJson;
  }
}

/**
 * Compute normalised Levenshtein similarity between two strings.
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0 && lenB === 0) return 1.0;
  if (lenA === 0 || lenB === 0) return 0.0;

  const shorter = lenA < lenB ? a : b;
  const longer = lenA < lenB ? b : a;
  const slen = shorter.length;
  const llen = longer.length;

  if (slen === 0) return 0.0;

  const prev = new Array<number>(slen + 1);
  const curr = new Array<number>(slen + 1);

  for (let i = 0; i <= slen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= llen; j++) {
    curr[0] = j;
    const lchar = longer.charCodeAt(j - 1);
    for (let i = 1; i <= slen; i++) {
      const cost = shorter.charCodeAt(i - 1) === lchar ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    for (let k = 0; k <= slen; k++) {
      prev[k] = curr[k];
    }
  }

  const distance = prev[slen];
  return 1.0 - distance / Math.max(lenA, lenB);
}

export async function mergeDuplicatePair(
  db: D1,
  primary: MemoryCandidate,
  duplicate: MemoryCandidate,
  similarity: number,
): Promise<void> {
  const mergedText = `${extractText(primary.content_json)}\n\n${extractText(duplicate.content_json)}`;
  const boostedScore = Math.min(1.0, primary.relevance_score + 0.15);

  await db
    .prepare(
      `UPDATE creator_memory
       SET content_json = ?1,
           relevance_score = ?2,
           updated_at = ?3
       WHERE id = ?4`,
    )
    .bind(JSON.stringify({ text: mergedText }), boostedScore, Date.now(), primary.id)
    .run();

  await db.prepare(`DELETE FROM creator_memory WHERE id = ?1`).bind(duplicate.id).run();

  logger.debug('[MemoryPruner] Merged duplicate', undefined, {
    kept: primary.id,
    removed: duplicate.id,
    similarity,
    userId: primary.user_id,
  } as Record<string, unknown>);
}
