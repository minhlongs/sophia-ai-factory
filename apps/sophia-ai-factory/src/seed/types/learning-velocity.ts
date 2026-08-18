/**
 * Learning Velocity Types
 *
 * Types for tracking how quickly a workspace learns from performance signals.
 * Used by performance-aggregation and learning-velocity-cron (Phase 4).
 *
 * Layer: seed (primitives — no domain logic)
 */

export interface LearningVelocityMetric {
  id: string;
  workspaceId: string;
  entityType: string;
  channel: string;
  velocityScore: number; // 0-100, how fast metrics improve
  eventCount: number;
  windowStartMs: number;
  windowEndMs: number;
  avgMetrics: Record<string, number>;
  createdAt: number;
}

export type VelocityTrend = 'improving' | 'stable' | 'declining';

export interface VelocitySnapshot {
  entityType: string;
  channel: string;
  currentScore: number;
  previousScore: number;
  trend: VelocityTrend;
  sampleSize: number;
}

export interface LearningVelocityResult {
  workspaceId: string;
  snapshotTimeMs: number;
  snapshots: VelocitySnapshot[];
}
