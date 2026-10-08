/**
 * @file cultural-alignment.engine.ts
 * @description Zero-IO mathematical engine to score cultural keyword alignment
 * @layer tree
 */

export interface CulturalDictionary {
  region: string;
  keywords: string[];
  idioms: string[];
}

export interface CulturalScoreResult {
  alignmentScore: number; // Normalized [0, 1]
  matchedKeywords: string[];
  matchedIdioms: string[];
}

/**
 * Calculates a cultural alignment index using token matching frequency.
 * Designed to be zero-IO, purely operating on the input strings.
 */
export function calculateCulturalAlignmentIndex(
  text: string,
  dictionary: CulturalDictionary
): CulturalScoreResult {
  if (!text || (!dictionary.keywords.length && !dictionary.idioms.length)) {
    return {
      alignmentScore: 0,
      matchedKeywords: [],
      matchedIdioms: [],
    };
  }

  const normalizedText = text.toLowerCase();

  // Extract and match keywords
  const matchedKeywords = dictionary.keywords.filter((kw) => {
    // Simple boundary matching to avoid partial word hits
    const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'g');
    return regex.test(normalizedText);
  });

  // Extract and match idioms (multi-word phrases)
  const matchedIdioms = dictionary.idioms.filter((idiom) => {
    return normalizedText.includes(idiom.toLowerCase());
  });

  const totalPossibleMatches = dictionary.keywords.length + dictionary.idioms.length;

  if (totalPossibleMatches === 0) {
    return {
      alignmentScore: 0,
      matchedKeywords: [],
      matchedIdioms: [],
    };
  }

  // Pure mathematical alignment ratio
  const alignmentScore = (matchedKeywords.length + matchedIdioms.length) / totalPossibleMatches;

  return {
    alignmentScore,
    matchedKeywords,
    matchedIdioms,
  };
}
