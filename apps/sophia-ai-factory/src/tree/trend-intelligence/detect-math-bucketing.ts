/**
 * Evidence Sliding-Window Bucketing & Types for Trend Detection.
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/detect-math-bucketing
 */

/** A single piece of timestamped evidence for a topic. */
export interface EvidencePoint {
  readonly id: string;
  readonly atMs: number;
}

export interface TopicWindowStats {
  readonly topic: string;
  /** Per-window event counts, oldest → newest. */
  readonly windowCounts: number[];
  /** count(last) − count(prev); 0 when fewer than 2 windows have data. */
  readonly velocity: number;
  /** (last − mean)/stddev over windows with data; 0 when variance is 0 or <3 windows. */
  readonly z: number;
  readonly seasonalMultiplier: number;
  readonly audienceMultiplier: number;
  /** z · seasonal · audience — the persisted `momentum` value. */
  readonly momentum: number;
}

export interface DetectOptions {
  /** Width of one sliding-window bucket in ms. */
  readonly windowMs?: number;
  /** Number of buckets ending at nowMs. */
  readonly windowCount?: number;
  /** Injected clock so pure functions stay deterministic. */
  readonly nowMs?: number;
}

export const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_WINDOW_COUNT = 7;

/**
 * Bucket evidence into `windowCount` fixed windows of `windowMs` ending at
 * nowMs. Window i (0-based, oldest first) covers
 * [nowMs − (windowCount−i)·windowMs, nowMs − (windowCount−1−i)·windowMs).
 * Points outside all windows are dropped.
 */
export function bucketEvidence(
  points: readonly EvidencePoint[],
  options?: { windowMs?: number; windowCount?: number; nowMs?: number },
): number[] {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const windowCount = options?.windowCount ?? DEFAULT_WINDOW_COUNT;
  const nowMs = options?.nowMs ?? 0;

  const counts = new Array<number>(windowCount).fill(0);
  const start = nowMs - windowCount * windowMs;
  for (const point of points) {
    if (!Number.isFinite(point.atMs)) continue;
    const idx = Math.floor((point.atMs - start) / windowMs);
    if (idx >= 0 && idx < windowCount) counts[idx] += 1;
  }
  return counts;
}
