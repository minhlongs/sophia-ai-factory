/**
 * Type contracts for cross-channel trend detection.
 */

import type { ForecastPayload } from './forecast';

export interface TrendDetectionRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly topic: string;
  readonly channel: string;
  readonly momentum: number;
  readonly velocity: number;
  readonly z: number;
  readonly forecast: ForecastPayload;
  readonly evidenceIds: readonly string[];
  readonly detectedAt: number;
}

export interface DetectTrendsInput {
  readonly workspaceId: string;
  /** Injected clock — defaults to Date.now() only at the async boundary. */
  readonly nowMs?: number;
  /** Width of one sliding-window bucket in ms (default 24h). */
  readonly windowMs?: number;
  /** Number of buckets ending at nowMs (default 7). */
  readonly windowCount?: number;
  /** Max detections persisted per run, ranked by momentum (default 50). */
  readonly maxDetections?: number;
  /** Mark ingested signals as consumed after detection (default false). */
  readonly consumeProcessed?: boolean;
}
