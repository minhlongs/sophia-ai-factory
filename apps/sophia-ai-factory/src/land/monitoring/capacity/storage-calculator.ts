/**
 * @module land/monitoring/capacity/storage-calculator
 * D1 table statistics, storage sizing estimation, and latency measurement.
 */

import { logger } from '@/seed/utils/logger-utility';
import type { TableStat, SqliteMasterRow } from './types';

/**
 * Run a simple timing measurement on a D1 query.
 * Returns the query latency in milliseconds.
 */
export async function measureLatency(db: D1Database, sql: string): Promise<number> {
  const start = performance.now();
  await db.prepare(sql).all();
  return performance.now() - start;
}

/**
 * Query sqlite_master to discover table names and estimate row counts.
 */
export async function getTableStats(db: D1Database): Promise<TableStat[]> {
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
export function estimateTablesSizeBytes(stats: TableStat[]): number | null {
  if (stats.length === 0) return null;
  return stats.reduce((total, t) => total + t.rowCount * 1024, 0);
}

/**
 * Get the total query count and error rate since process start.
 * Uses a global counter since D1 does not expose session-level metrics.
 */
export function getGlobalQueryStats(): { totalQueries: number; errorCount: number } {
  const globalState = globalThis as unknown as Record<string, unknown>;
  const queries = typeof globalState.__D1_QUERY_COUNT === 'number' ? (globalState.__D1_QUERY_COUNT as number) : 0;
  const errors = typeof globalState.__D1_ERROR_COUNT === 'number' ? (globalState.__D1_ERROR_COUNT as number) : 0;
  return { totalQueries: queries, errorCount: errors };
}
