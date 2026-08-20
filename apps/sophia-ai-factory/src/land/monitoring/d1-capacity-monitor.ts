/**
 * D1 Capacity Monitor
 *
 * Queries D1 for table statistics and latency patterns, then produces
 * a capacity report with alert level and recommendations.
 *
 * @module land/monitoring/d1-capacity-monitor
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Capacity status levels.
 * - green: below 50% capacity / normal latency
 * - yellow: 50-80% capacity / elevated latency
 * - red: above 80% capacity / critical latency or errors
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

interface TableStat {
  name: string;
  rowCount: number;
}

interface SqliteMasterRow {
  name: string;
  type: string;
}

/**
 * Run a simple timing measurement on a D1 query.
 * Returns the query latency in milliseconds.
 */
async function measureLatency(db: D1Database, sql: string): Promise<number> {
  const start = performance.now();
  await db.prepare(sql).all();
  return performance.now() - start;
}

/**
 * Query sqlite_master to discover table names and estimate row counts.
 */
async function getTableStats(db: D1Database): Promise<TableStat[]> {
  try {
    const masterResult = await db
      .prepare("SELECT name, type FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all<SqliteMasterRow>();

    const tables = masterResult.results ?? [];

    const stats: TableStat[] = [];
    for (const table of tables) {
      try {
        const countResult = await db.prepare(`SELECT COUNT(*) AS cnt FROM \`${table.name}\``).first<{ cnt: number }>();
        stats.push({ name: table.name, rowCount: countResult?.cnt ?? 0 });
      } catch {
        // Skip tables that cannot be counted (e.g. virtual tables)
        stats.push({ name: table.name, rowCount: 0 });
      }
    }

    return stats;
  } catch (err) {
    logger.error('[D1CapacityMonitor] Failed to query sqlite_master', err instanceof Error ? err : new Error(String(err)));
    return [];
  }
}

/**
 * Estimate total database size by summing table row estimates.
 * Each row is estimated at 1KB average for capacity planning purposes.
 * Returns null if table stats are unavailable.
 */
function estimateTablesSizeBytes(stats: TableStat[]): number | null {
  if (stats.length === 0) return null;
  return stats.reduce((total, t) => total + t.rowCount * 1024, 0);
}

/**
 * Determine alert level and recommendations based on metrics.
 */
function analyzeCapacity(
  avgLatencyMs: number,
  p95LatencyMs: number,
  errorRate: number,
  tablesSizeBytes: number | null,
  tableCount: number,
): { alertLevel: AlertLevel; recommendations: string[] } {
  const recommendations: string[] = [];
  const maxTableBytes = 500 * 1024 * 1024; // 500MB per table soft limit

  // Latency analysis
  const hasHighLatency = avgLatencyMs > 100 || p95LatencyMs > 300;
  const hasCriticalLatency = avgLatencyMs > 500 || p95LatencyMs > 1000;

  // Error rate analysis
  const hasElevatedErrors = errorRate > 0.01;
  const hasCriticalErrors = errorRate > 0.05;

  // Size analysis
  const hasLargeTables = tablesSizeBytes !== null && tablesSizeBytes > maxTableBytes;
  const hasManyTables = tableCount > 50;

  if (hasCriticalLatency || hasCriticalErrors) {
    if (avgLatencyMs > 500) recommendations.push('CRITICAL: Average query latency exceeds 500ms. Consider adding indexes or optimizing hot queries.');
    if (p95LatencyMs > 1000) recommendations.push('CRITICAL: P95 latency exceeds 1 second. High-priority optimization needed on slow queries.');
    if (errorRate > 0.05) recommendations.push('CRITICAL: Error rate exceeds 5%. Investigate D1 connection issues or corrupted queries.');
    if (hasLargeTables) recommendations.push('CRITICAL: Database size exceeds 500MB. Consider data archival or sharding.');
    return { alertLevel: 'red', recommendations };
  }

  if (hasHighLatency || hasElevatedErrors || hasLargeTables || hasManyTables) {
    if (avgLatencyMs > 100) recommendations.push('Elevated average latency (>100ms). Review query patterns and consider adding composite indexes.');
    if (p95LatencyMs > 300) recommendations.push('Elevated P95 latency (>300ms). Profile slow queries using D1 query logging.');
    if (errorRate > 0.01) recommendations.push('Error rate above 1%. Check for timeout or constraint violations.');
    if (hasLargeTables) recommendations.push('Database approaching 500MB. Plan data retention policy or archive old records.');
    if (hasManyTables) recommendations.push(`Table count (${tableCount}) is high. Consider consolidating related tables.`);
    return { alertLevel: 'yellow', recommendations };
  }

  recommendations.push('D1 capacity is healthy. Continue monitoring query patterns as data grows.');
  return { alertLevel: 'green', recommendations };
}

/**
 * Get the total query count and error rate since process start.
 * Uses a global counter since D1 does not expose session-level metrics.
 */
function getGlobalQueryStats(): { totalQueries: number; errorCount: number } {
  const globalState = globalThis as unknown as Record<string, unknown>;
  const queries = typeof globalState.__D1_QUERY_COUNT === 'number' ? (globalState.__D1_QUERY_COUNT as number) : 0;
  const errors = typeof globalState.__D1_ERROR_COUNT === 'number' ? (globalState.__D1_ERROR_COUNT as number) : 0;
  return { totalQueries: queries, errorCount: errors };
}

/**
 * Collect D1 capacity metrics and produce a structured report.
 */
export async function getD1CapacityReport(): Promise<D1CapacityReport> {
  try {
    const db = await getD1();
    if (!db) {
      return {
        totalQueries: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        errorRate: 0,
        tablesSizeBytes: null,
        alertLevel: 'green',
        recommendations: ['D1 database binding not available — running outside Cloudflare runtime.'],
      };
    }

    // Measure latency with 3 sample queries
    const latencies: number[] = [];
    latencies.push(await measureLatency(db, 'SELECT 1'));
    latencies.push(await measureLatency(db, "SELECT COUNT(*) FROM sqlite_master"));
    latencies.push(await measureLatency(db, 'SELECT 1'));

    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;
    const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
    const p95LatencyMs = p95Index >= 0 ? sortedLatencies[p95Index] : 0;

    // Get table stats
    const tableStats = await getTableStats(db);
    const tablesSizeBytes = estimateTablesSizeBytes(tableStats);

    // Get global query metrics
    const { totalQueries, errorCount } = getGlobalQueryStats();
    const errorRate = totalQueries > 0 ? errorCount / totalQueries : 0;

    // Analyze
    const { alertLevel, recommendations } = analyzeCapacity(
      avgLatencyMs,
      p95LatencyMs,
      errorRate,
      tablesSizeBytes,
      tableStats.length,
    );

    return {
      totalQueries,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      p95LatencyMs: Math.round(p95LatencyMs * 100) / 100,
      errorRate: Math.round(errorRate * 10000) / 10000,
      tablesSizeBytes,
      alertLevel,
      recommendations,
    };
  } catch (err) {
    logger.error('[D1CapacityMonitor] Failed to generate report', err instanceof Error ? err : new Error(String(err)));
    return {
      totalQueries: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      errorRate: 0,
      tablesSizeBytes: null,
      alertLevel: 'red',
      recommendations: ['Error generating report. Check logs for details.'],
    };
  }
}
