/**
 * @module land/monitoring/capacity/capacity-monitor
 * Orchestrator service for collecting D1 metrics and generating capacity reports.
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { D1CapacityReport } from './types';
import {
  measureLatency,
  getTableStats,
  estimateTablesSizeBytes,
  getGlobalQueryStats,
} from './storage-calculator';
import { analyzeCapacity } from './growth-projector';

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
    latencies.push(await measureLatency(db, 'SELECT COUNT(*) FROM sqlite_master'));
    latencies.push(await measureLatency(db, 'SELECT 1'));

    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0
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
    logger.error(
      '[D1CapacityMonitor] Failed to generate report',
      err instanceof Error ? err : new Error(String(err)),
    );
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
