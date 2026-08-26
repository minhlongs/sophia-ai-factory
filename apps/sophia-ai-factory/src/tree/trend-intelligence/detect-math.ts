/**
 * Pure math for cross-channel trend detection.
 *
 * No DB access, no clock reads (nowMs injected), fully deterministic —
 * unit-testable without any fixture. The DB-backed pipeline lives in
 * detect-pipeline.ts; this module holds only the scoring math.
 *
 * Detection model per (workspace, channel, topic):
 *  - Bucket evidence into fixed-size time windows.
 *  - velocity = count(last window) − count(previous window)
 *    (acceleration of signal volume).
 *  - z = (count(last) − mean(windowCounts)) / stddev(windowCounts),
 *    guarding the zero-variance case.
 *  - momentum = z · seasonalMultiplier · audienceMultiplier
 *    (promote/demote via trend-scorer multipliers, DRY import).
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/detect-math
 */

import {
  extractKeywords,
  getAudienceMultiplier,
  getSeasonalMultiplier,
} from '@/tree/youtube-strategy/trend-scorer';

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

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_COUNT = 7;

/**
 * Extract topic keywords from free text using trend-scorer's extractor,
 * deduplicated and order-preserving.
 */
export function topicsFromText(text: string): string[] {
  return [...new Set(extractKeywords(text))];
}

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

/** Population standard deviation over a non-empty series (caller guarantees ≥1 value). */
function stdev(values: readonly number[]): number {
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute velocity + z-score + multiplier-weighted momentum for ONE topic's
 * binned counts. Multipliers come from trend-scorer.ts (DRY — imported, not
 * copied). Zero-variance and short-series cases degrade to 0 rather than NaN.
 */
export function computeTopicMomentum(
  topic: string,
  windowCounts: readonly number[],
): TopicWindowStats {
  const counts = [...windowCounts];
  let velocity = 0;
  let z = 0;

  const last = counts[counts.length - 1];
  if (counts.length >= 2) {
    const prev = counts[counts.length - 2];
    velocity = last - prev;
    const sd = stdev(counts);
    const mean = counts.reduce((acc, v) => acc + v, 0) / counts.length;
    if (sd > 0) {
      z = (last - mean) / sd;
    }
  }

  const seasonalMultiplier = getSeasonalMultiplier(topic);
  const audienceMultiplier = getAudienceMultiplier(topic);
  const momentum = z * seasonalMultiplier * audienceMultiplier;

  return {
    topic,
    windowCounts: counts,
    velocity,
    z,
    seasonalMultiplier,
    audienceMultiplier,
    momentum,
  };
}
