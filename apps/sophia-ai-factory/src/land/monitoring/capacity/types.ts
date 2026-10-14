/**
 * @module land/monitoring/capacity/types
 * Type definitions for D1 capacity and performance monitoring.
 */

export type AlertLevel = 'green' | 'yellow' | 'red';

export interface D1CapacityReport {
  /** Total number of D1 queries executed in the session */
  totalQueries: number;
  /** Average query latency in milliseconds */
  avgLatencyMs: number;
  /** P95 query latency in milliseconds */
  p95LatencyMs: number;
  /** Error rate as a fraction (0.0 to 1.0) */
  errorRate: number;
  /** Estimated total size of all tables in bytes (null if unavailable) */
  tablesSizeBytes: number | null;
  /** Alert level based on capacity thresholds */
  alertLevel: AlertLevel;
  /** Actionable recommendations */
  recommendations: string[];
}

export interface TableStat {
  name: string;
  rowCount: number;
}

export interface SqliteMasterRow {
  name: string;
  type: string;
}
