import { SIGNIFICANCE_LEVEL } from './constants';

/**
 * Standard normal CDF approximation.
 * Using rational approximation with max error ~7e-8 (from Abramowitz & Stegun 7.1.27)
 */
function normalCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Approximate p-value for chi-square distribution with df=1.
 * Uses the relationship: sqrt(chi2) ~ N(0,1) for df=1
 * p = 2 * (1 - Φ(|z|)) where z = sqrt(chi2)
 */
function pValueChiSquareDf1(chi2: number): number {
  if (chi2 <= 0) return 1;
  const z = Math.sqrt(chi2);
  const cdf = normalCdf(z);
  return 2 * (1 - cdf); // two-tailed
}

/**
 * Chi-square test for independence (2×2 contingency table).
 * Tests: are conversion rates between variant A and B statistically different?
 */
export function chiSquareTest(
  conversionsA: number,
  impressionsA: number,
  conversionsB: number,
  impressionsB: number,
): { chi2: number; pValue: number; significant: boolean } {
  const a = conversionsA;
  const b = impressionsA - conversionsA;
  const c = conversionsB;
  const d = impressionsB - conversionsB;

  const nA = impressionsA;
  const nB = impressionsB;
  const total = nA + nB;
  const totalConverted = a + c;
  const totalNotConverted = b + d;

  if (total === 0) {
    return { chi2: 0, pValue: 1, significant: false };
  }

  const eA = (nA * totalConverted) / total;
  const eB = (nA * totalNotConverted) / total;
  const eC = (nB * totalConverted) / total;
  const eD = (nB * totalNotConverted) / total;

  if (eA === 0 || eB === 0 || eC === 0 || eD === 0) {
    return { chi2: 0, pValue: 1, significant: false };
  }

  const chi2 =
    (a - eA) ** 2 / eA +
    (b - eB) ** 2 / eB +
    (c - eC) ** 2 / eC +
    (d - eD) ** 2 / eD;

  const pValue = pValueChiSquareDf1(chi2);

  return {
    chi2,
    pValue,
    significant: pValue < SIGNIFICANCE_LEVEL,
  };
}
