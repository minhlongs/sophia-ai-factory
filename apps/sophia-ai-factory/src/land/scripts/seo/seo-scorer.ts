/**
 * SEO Script Scorer and Keyword Analysis
 * Layer: LAND (Business Domain Workflows)
 */

import type { ScoreInput } from './types';

/**
 * Pure: count keyword hits in body (case-insensitive whole-word match).
 * Exported so unit tests can exercise it without the LLM call.
 */
export function countKeywordHits(
  body: string,
  keywords: string[]
): Array<{ keyword: string; hits: number }> {
  const text = body.toLowerCase();
  return keywords.map((kw) => {
    const trimmed = kw.trim().toLowerCase();
    if (trimmed.length === 0) return { keyword: kw, hits: 0 };
    // Escape regex special chars in keyword.
    const safe = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, 'g');
    const matches = text.match(re);
    return { keyword: kw, hits: matches?.length ?? 0 };
  });
}

/**
 * Pure: compute the SEO score. 0–100 scale. Returns score + coverage table.
 * Exported for unit-testing without LLM I/O.
 */
export function scoreSeo(
  input: ScoreInput
): { score: number; coverage: Array<{ keyword: string; hits: number }> } {
  const coverage = countKeywordHits(input.body, input.keywords);
  const covered = coverage.filter((c) => c.hits > 0).length;
  const coverageRatio = input.keywords.length > 0 ? covered / input.keywords.length : 1;

  const primaryInTitle =
    input.primaryKeyword && input.title.toLowerCase().includes(input.primaryKeyword.toLowerCase())
      ? 1
      : 0;

  const headingHits = (input.body.match(/^##+\s/gm) ?? []).length;
  const headingFactor = headingHits >= 2 ? 1 : headingHits === 1 ? 0.5 : 0;

  const lenFactor =
    input.wordCount >= input.min && input.wordCount <= input.max
      ? 1
      : input.wordCount < input.min
        ? input.wordCount / input.min
        : input.max / input.wordCount;

  const score = Math.round(
    60 * coverageRatio + 20 * primaryInTitle + 10 * headingFactor + 10 * Math.max(0, Math.min(1, lenFactor))
  );
  return { score, coverage };
}
