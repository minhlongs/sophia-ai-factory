export type DialectDictionary = {
  [word: string]: number; // weight of the cultural word
};

/**
 * Calculates the Cultural Alignment Index (CAI) of a given text,
 * producing a normalized score [0, 1].
 *
 * @param text The input text to analyze
 * @param dictionary The cultural weights dictionary
 * @param targetDensity The ideal ratio of cultural words to total words (default 0.1, meaning 10% of words)
 */
export function calculateCulturalAlignmentIndex(
  text: string,
  dictionary: DialectDictionary,
  targetDensity: number = 0.1
): number {
  if (!text || text.trim().length === 0) {
    return 0;
  }

  // Tokenize words (simple regex for letters/numbers, lowercase)
  const words = text.toLowerCase().match(/\p{L}+/gu) || [];
  if (words.length === 0) {
    return 0;
  }

  let culturalScore = 0;
  for (const word of words) {
    if (Object.prototype.hasOwnProperty.call(dictionary, word)) {
      culturalScore += dictionary[word];
    }
  }

  // Raw density is the weighted score divided by total words
  const rawDensity = culturalScore / words.length;

  // We map the raw density to [0, 1] using a clamping function against the target density
  // If targetDensity is met or exceeded, the score approaches 1.0.
  let index = rawDensity / targetDensity;
  if (index > 1) {
    // If it's overly dense, it might sound unnatural (slop), so we penalize slightly past 1.5x target
    if (index > 1.5) {
      // parabolic penalty
      const excess = index - 1.5;
      index = 1.0 - (excess * 0.5);
    } else {
      index = 1.0;
    }
  }

  return Math.max(0, Math.min(1, index));
}
