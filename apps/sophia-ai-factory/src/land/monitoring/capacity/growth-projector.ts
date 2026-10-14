/**
 * @module land/monitoring/capacity/growth-projector
 * Capacity health analysis, threshold detection, and operational recommendations.
 */

import type { AlertLevel } from './types';

const MAX_TABLE_BYTES = 500 * 1024 * 1024; // 500MB per table soft limit

function collectCriticalRecommendations(
  avgLatencyMs: number,
  p95LatencyMs: number,
  errorRate: number,
  hasLargeTables: boolean,
): string[] {
  const recs: string[] = [];
  if (avgLatencyMs > 500) {
    recs.push('CRITICAL: Average query latency exceeds 500ms. Consider adding indexes or optimizing hot queries.');
  }
  if (p95LatencyMs > 1000) {
    recs.push('CRITICAL: P95 latency exceeds 1 second. High-priority optimization needed on slow queries.');
  }
  if (errorRate > 0.05) {
    recs.push('CRITICAL: Error rate exceeds 5%. Investigate D1 connection issues or corrupted queries.');
  }
  if (hasLargeTables) {
    recs.push('CRITICAL: Database size exceeds 500MB. Consider data archival or sharding.');
  }
  return recs;
}

function collectWarningRecommendations(
  avgLatencyMs: number,
  p95LatencyMs: number,
  errorRate: number,
  hasLargeTables: boolean,
  tableCount: number,
): string[] {
  const recs: string[] = [];
  if (avgLatencyMs > 100) {
    recs.push('Elevated average latency (>100ms). Review query patterns and consider adding composite indexes.');
  }
  if (p95LatencyMs > 300) {
    recs.push('Elevated P95 latency (>300ms). Profile slow queries using D1 query logging.');
  }
  if (errorRate > 0.01) {
    recs.push('Error rate above 1%. Check for timeout or constraint violations.');
  }
  if (hasLargeTables) {
    recs.push('Database approaching 500MB. Plan data retention policy or archive old records.');
  }
  if (tableCount > 50) {
    recs.push(`Table count (${tableCount}) is high. Consider consolidating related tables.`);
  }
  return recs;
}

/**
 * Determine alert level and recommendations based on capacity and latency metrics.
 */
export function analyzeCapacity(
  avgLatencyMs: number,
  p95LatencyMs: number,
  errorRate: number,
  tablesSizeBytes: number | null,
  tableCount: number,
): { alertLevel: AlertLevel; recommendations: string[] } {
  const hasLargeTables = tablesSizeBytes !== null && tablesSizeBytes > MAX_TABLE_BYTES;
  const isCritical = avgLatencyMs > 500 || p95LatencyMs > 1000 || errorRate > 0.05;

  if (isCritical) {
    const recommendations = collectCriticalRecommendations(
      avgLatencyMs,
      p95LatencyMs,
      errorRate,
      hasLargeTables,
    );
    return { alertLevel: 'red', recommendations };
  }

  const isWarning =
    avgLatencyMs > 100 ||
    p95LatencyMs > 300 ||
    errorRate > 0.01 ||
    hasLargeTables ||
    tableCount > 50;

  if (isWarning) {
    const recommendations = collectWarningRecommendations(
      avgLatencyMs,
      p95LatencyMs,
      errorRate,
      hasLargeTables,
      tableCount,
    );
    return { alertLevel: 'yellow', recommendations };
  }

  return {
    alertLevel: 'green',
    recommendations: ['D1 capacity is healthy. Continue monitoring query patterns as data grows.'],
  };
}
