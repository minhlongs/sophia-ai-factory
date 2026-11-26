/**
 * Zero-Dependency Pure-TS Beta-Bernoulli Thompson Sampling Bandit Engine.
 *
 * Clean-room primitive (Apache-2.0 patterns from @takk/bayestruth and
 * @takk/bayesdecide): runs O(1) Beta-Bernoulli conjugate updates, exponential
 * time-decay of stale evidence, seeded reproducible mulberry32 PRNG, and
 * JSON snapshot()/load() for stateless Cloudflare Workers + D1 persistence.
 *
 * Layer: seed/ai (pure math, zero external deps)
 *
 * @module seed/ai/thompson-bandit-engine
 */

export interface BanditArmState {
  readonly id: string;
  readonly alpha: number;
  readonly beta: number;
}

export interface BanditSnapshot {
  readonly arms: readonly BanditArmState[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Marsaglia & Tsang gamma sampler for alpha >= 1 (with boost for alpha < 1). */
function sampleGamma(shape: number, rand: () => number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, rand) * Math.pow(Math.max(1e-12, rand()), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (let iter = 0; iter < 100; iter++) {
    let x = 0;
    let v = 0;
    do {
      const u1 = Math.max(1e-12, rand());
      const u2 = rand();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(Math.max(1e-12, u)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
  return d;
}

function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  const x = sampleGamma(Math.max(0.01, alpha), rand);
  const y = sampleGamma(Math.max(0.01, beta), rand);
  return x / (x + y);
}

export function createBanditSnapshot(armIds: readonly string[]): BanditSnapshot {
  return {
    arms: armIds.map((id) => ({ id, alpha: 1, beta: 1 })),
  };
}

export function updateBanditArm(
  snapshot: BanditSnapshot,
  armId: string,
  rewardSuccess: boolean,
  decayFactor: number = 1.0,
): BanditSnapshot {
  const safeDecay = Math.min(1, Math.max(0.5, decayFactor));
  return {
    arms: snapshot.arms.map((arm) => {
      const decayedAlpha = 1 + (arm.alpha - 1) * safeDecay;
      const decayedBeta = 1 + (arm.beta - 1) * safeDecay;
      if (arm.id !== armId) {
        return { id: arm.id, alpha: decayedAlpha, beta: decayedBeta };
      }
      return {
        id: arm.id,
        alpha: decayedAlpha + (rewardSuccess ? 1 : 0),
        beta: decayedBeta + (rewardSuccess ? 0 : 1),
      };
    }),
  };
}

export function selectThompsonWinningArm(
  snapshot: BanditSnapshot,
  seed: number = Date.now(),
): string | null {
  if (snapshot.arms.length === 0) return null;
  const rand = mulberry32(seed);
  let bestId = snapshot.arms[0].id;
  let bestDraw = -1;
  for (const arm of snapshot.arms) {
    const draw = sampleBeta(arm.alpha, arm.beta, rand);
    if (draw > bestDraw) {
      bestDraw = draw;
      bestId = arm.id;
    }
  }
  return bestId;
}
