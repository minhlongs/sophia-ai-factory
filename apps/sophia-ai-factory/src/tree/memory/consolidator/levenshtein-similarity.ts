/**
 * Normalised Levenshtein String Similarity Calculator
 *
 * Layer: tree/memory/consolidator
 */

/**
 * Compute normalised Levenshtein similarity between two strings.
 *
 * Returns a value in [0.0, 1.0] where 1.0 means identical.
 * Uses the iterative DP approach with O(min(m,n)) space.
 */
export function computeSimilarity(a: string, b: string): number {
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
