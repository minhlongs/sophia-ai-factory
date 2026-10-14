/**
 * Language detection and chars-per-token heuristics for TokenCounter.
 * @module seed/ai/token-counter-heuristics
 */

export interface TokenEstimate {
  tokens: number;
  characters: number;
  language: string;
  method: 'anthropic' | 'openai';
}

const VIETNAMESE_PATTERN = '[À-ỿ]';
const CJK_PATTERN = '[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]';

/**
 * Detect the dominant language in a text sample.
 * @returns 'vi' | 'en' | 'mixed' | 'unknown'.
 */
export function detectLanguage(text: string): string {
  const vietnameseChars = (text.match(new RegExp(VIETNAMESE_PATTERN, 'g')) ?? []).length;
  const cjkChars = (text.match(new RegExp(CJK_PATTERN, 'g')) ?? []).length;
  const totalAlpha = text.replace(/[^a-zA-ZÀ-ỿ一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g, '').length;

  if (totalAlpha === 0) return 'unknown';

  const viRatio = vietnameseChars / totalAlpha;
  const cjkRatio = cjkChars / totalAlpha;

  if (viRatio > 0.15) return 'vi';
  if (cjkRatio > 0.1) return 'mixed';
  if (viRatio > 0.05 && cjkRatio === 0) return 'mixed';
  return 'en';
}

export function resolveCharsPerToken(language: string, mode: 'anthropic' | 'openai'): number {
  switch (language) {
    case 'vi':
      return mode === 'anthropic' ? 1.8 : 2.5;
    case 'mixed':
      return mode === 'anthropic' ? 2.5 : 3.0;
    case 'en':
    default:
      return mode === 'anthropic' ? 3.5 : 4.0;
  }
}
