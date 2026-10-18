/**
 * Wildcard Pattern & Intent Keyword Matcher for Natural Language Ask Router
 *
 * Layer: tree/ask
 * @module tree/ask/ask-wildcard-matcher
 */

import type { IntentCategoryDefinition } from './ask-types';
import { CANONICAL_INTENT_CATEGORIES } from './ask-intent-categories';

export interface MatchCandidate {
  readonly intent: IntentCategoryDefinition;
  readonly keyword: string;
  readonly language: 'vi' | 'en';
  readonly specificity: number;
}

/**
 * Checks if a candidate text matches a pattern using fnmatch wildcard semantics.
 */
export function matchesWildcard(pattern: string, text: string): boolean {
  const normPattern = pattern.trim().toLowerCase();
  const normText = text.trim().toLowerCase();

  if (normPattern.length === 0 || normText.length === 0) {
    return false;
  }

  if (normPattern.startsWith('*') && normPattern.endsWith('*')) {
    const sub = normPattern.slice(1, -1);
    return sub.length > 0 && normText.includes(sub);
  }

  if (normPattern.startsWith('*')) {
    const sub = normPattern.slice(1);
    return sub.length > 0 && normText.endsWith(sub);
  }

  if (normPattern.endsWith('*')) {
    const sub = normPattern.slice(0, -1);
    return sub.length > 0 && normText.startsWith(sub);
  }

  return normText.includes(normPattern);
}

export function findBestIntentMatch(trimmed: string, language: 'vi' | 'en'): MatchCandidate | null {
  const matches: MatchCandidate[] = [];
  for (const intent of CANONICAL_INTENT_CATEGORIES) {
    const keywords = language === 'vi' ? intent.keywordsVi : intent.keywordsEn;
    for (const kw of keywords) {
      if (matchesWildcard(kw, trimmed)) {
        matches.push({
          intent,
          keyword: kw,
          language,
          specificity: kw.length,
        });
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => b.specificity - a.specificity);
  return matches[0] ?? null;
}
