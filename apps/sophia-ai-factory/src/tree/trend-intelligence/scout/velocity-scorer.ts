/**
 * Evidence Generation & Velocity Scoring Helpers
 *
 * Implements deterministic seeded pseudo-randomness and sliding window evidence.
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/scout/velocity-scorer
 */

import type { EvidencePoint } from '../detect-math';

/**
 * Deterministically generates pseudo-random float in [0, 1) from seed string.
 */
export function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const normalized = (Math.abs(hash) % 10000) / 10000;
  return normalized;
}

/**
 * Creates simulated timestamped evidence points across 7 sliding 24h windows
 * to compute deterministic velocity and momentum.
 */
export function generateEvidencePoints(
  topicKey: string,
  nowMs: number,
  dayWindowMs = 86_400_000,
): EvidencePoint[] {
  const points: EvidencePoint[] = [];
  const seedVal = seededRandom(topicKey);

  // 7-day distribution with upward acceleration for trending topics
  const dailyMultipliers = [0.8, 0.9, 1.1, 1.3, 1.6, 2.1, 2.8];

  for (let day = 0; day < 7; day++) {
    const windowStart = nowMs - (7 - day) * dayWindowMs;
    const baseCount = Math.floor((10 + seedVal * 25) * dailyMultipliers[day]);

    for (let i = 0; i < baseCount; i++) {
      const offsetMs = Math.floor(seededRandom(`${topicKey}_${day}_${i}`) * dayWindowMs);
      points.push({
        id: `ev_${topicKey}_${day}_${i}`,
        atMs: windowStart + offsetMs,
      });
    }
  }

  return points;
}
