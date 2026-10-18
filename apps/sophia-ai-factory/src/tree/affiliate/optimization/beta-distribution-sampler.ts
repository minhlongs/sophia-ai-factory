/**
 * Marsaglia-Tsang Gamma & Beta Distribution Samplers
 *
 * Layer: tree/affiliate/optimization (Domain Logic)
 * @module tree/affiliate/optimization/beta-distribution-sampler
 */

/**
 * Standard Box-Muller transform for generating standard normal random numbers.
 */
function randomStandardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generates a Gamma distributed random variate using Marsaglia and Tsang method (2000).
 * Handles shape parameter alpha >= 1, or alpha < 1 via Johnk's generator or boost factor.
 */
export function sampleGamma(alpha: number, scale = 1): number {
  if (alpha < 1) {
    // Boost alpha by 1: Gamma(alpha) = Gamma(alpha + 1) * U^(1/alpha)
    const boosted = sampleGamma(alpha + 1, scale);
    const u = Math.random();
    return boosted * Math.pow(u, 1 / alpha);
  }

  const d = alpha - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);

  while (true) {
    let z = randomStandardNormal();
    let v = 1.0 + c * z;
    while (v <= 0) {
      z = randomStandardNormal();
      v = 1.0 + c * z;
    }

    const vCubed = v * v * v;
    const u = Math.random();

    // Squeeze test
    if (u < 1.0 - 0.0331 * (z * z) * (z * z)) {
      return d * vCubed * scale;
    }

    // Full log-ratio test
    if (Math.log(u) < 0.5 * (z * z) + d * (1.0 - vCubed + Math.log(vCubed))) {
      return d * vCubed * scale;
    }
  }
}

/**
 * Samples a random value from a Beta(alpha, beta) distribution.
 * Uses relationship: Beta(a, b) = Gamma(a) / (Gamma(a) + Gamma(b))
 */
export function sampleBeta(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) {
    throw new Error('Beta distribution parameters alpha and beta must be positive');
  }

  const gammaA = sampleGamma(alpha, 1);
  const gammaB = sampleGamma(beta, 1);

  if (gammaA + gammaB === 0) {
    return 0.5;
  }

  return gammaA / (gammaA + gammaB);
}
