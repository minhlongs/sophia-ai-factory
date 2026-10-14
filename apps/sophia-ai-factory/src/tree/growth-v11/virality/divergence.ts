/**
 * Computes Jensen-Shannon Divergence (JSD) using base-2 logarithm [0, 1].
 * Symmetric divergence measure between source and target token distributions.
 */
export function calculateHookDivergence(sourceTokens: string[], targetTokens: string[]): number {
  const cleanSource = (sourceTokens || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);
  const cleanTarget = (targetTokens || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);

  if (cleanSource.length === 0 && cleanTarget.length === 0) {
    return 0;
  }
  if (cleanSource.length === 0 || cleanTarget.length === 0) {
    return 1.0;
  }

  // Count frequencies
  const freqP = new Map<string, number>();
  for (const token of cleanSource) {
    freqP.set(token, (freqP.get(token) || 0) + 1);
  }

  const freqQ = new Map<string, number>();
  for (const token of cleanTarget) {
    freqQ.set(token, (freqQ.get(token) || 0) + 1);
  }

  // Build union vocabulary
  const vocab = new Set<string>([...freqP.keys(), ...freqQ.keys()]);
  const lenP = cleanSource.length;
  const lenQ = cleanTarget.length;

  let klPM = 0;
  let klQM = 0;

  for (const word of vocab) {
    const p = (freqP.get(word) || 0) / lenP;
    const q = (freqQ.get(word) || 0) / lenQ;
    const m = 0.5 * (p + q);

    if (p > 0 && m > 0) {
      klPM += p * Math.log2(p / m);
    }
    if (q > 0 && m > 0) {
      klQM += q * Math.log2(q / m);
    }
  }

  const jsd = 0.5 * klPM + 0.5 * klQM;
  return Number(Math.max(0, Math.min(1, jsd)).toFixed(4));
}
