/**
 * Playbook Pattern Types — Phase 5: Auto-Creative Playbook (COMPOUND stage)
 *
 * Shared types for detected winning patterns and derived playbook rules.
 * Layer: seed (primitives — no domain logic here)
 */

export * from './playbook-pattern-rules';
export * from './playbook-blueprints';

/** Composite creative effectiveness scoring result */
export interface CreativeEffectivenessScore {
  score: number; // 0..100
  ctr: number; // 0..1
  retentionRate: number; // 0..1
  conversionRate: number; // 0..1
  efficiencyScore: number; // 0..1
  confidence: number; // 0..1
  confidenceLevel: 'high' | 'medium' | 'low';
  sampleSize: number;
}

/** Input metrics for creative effectiveness scoring */
export interface CreativeMetricsInput {
  impressions?: number;
  views?: number;
  clicks?: number;
  conversions?: number;
  spendCents?: number;
  revenueCents?: number;
  watchTimeSeconds?: number;
  totalDurationSeconds?: number;
  retentionRate?: number;
  ctr?: number;
  conversionRate?: number;
  efficiencyScore?: number;
  sampleSize?: number;
}

/** Result of an atomic Compare-And-Swap (CAS) update */
export interface CASUpdateResult {
  success: boolean;
  changes: number;
  retries: number;
  error?: string;
}

/** Payload for pattern score CAS update */
export interface PatternScoreUpdates {
  avgMetric: number;
  sampleSize: number;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}
