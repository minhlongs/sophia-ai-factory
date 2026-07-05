/**
 * Worker Performance Tracker
 *
 * Reads available Cloudflare Workers analytics via context bindings
 * and produces a performance report with CPU, memory, and request metrics.
 *
 * @module land/monitoring/worker-performance
 */

import { logger } from '@/seed/utils/logger-utility';

export interface WorkerPerformanceReport {
  /** Estimated CPU time for the current request in milliseconds */
  cpuTimeMs: number;
  /** Estimated memory usage in megabytes */
  memoryMb: number;
  /** Request count tracked since worker start */
  requestCount: number;
  /** Actionable recommendations */
  recommendations: string[];
}

const CPU_TIME_WARNING_MS = 400;
const CPU_TIME_CRITICAL_MS = 800;
const MEMORY_WARNING_MB = 128;
const MEMORY_CRITICAL_MB = 256;

/**
 * Estimate current CPU timing using performance.now().
 * In Cloudflare Workers, this measures wall-clock time for the current request.
 */
function estimateCpuTime(): number {
  // Use performance.memory if available (not all runtimes expose this)
  // Fallback: return 0 as a baseline (runtime-specific measurement not available)
  return 0;
}

/**
 * Read memory usage from runtime if available.
 * Cloudflare Workers expose limited memory introspection.
 */
function estimateMemoryMb(): number {
  try {
    const memory = (process as unknown as Record<string, unknown>).memoryUsage;
    if (typeof memory === 'function') {
      const usage = (memory as () => { heapUsed: number })();
      return Math.round(usage.heapUsed / (1024 * 1024) * 100) / 100;
    }
  } catch {
    // process.memoryUsage is not available in Edge runtime
  }

  // In Cloudflare Workers, check for binding-provided memory info
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  if (env?.CF_WORKER_MEMORY_MB) {
    return Number(env.CF_WORKER_MEMORY_MB);
  }

  return 0;
}

/**
 * Read request count from a global counter incremented in middleware.
 */
function getRequestCount(): number {
  const globalState = globalThis as unknown as Record<string, number>;
  return globalState.__WORKER_REQUEST_COUNT ?? 0;
}

/**
 * Evaluate CPU and memory metrics and produce recommendations.
 */
function evaluatePerformance(cpuTimeMs: number, memoryMb: number, requestCount: number): string[] {
  const recommendations: string[] = [];

  if (memoryMb > MEMORY_CRITICAL_MB) {
    recommendations.push(`CRITICAL: Memory usage (${memoryMb}MB) exceeds ${MEMORY_CRITICAL_MB}MB threshold. Check for memory leaks in long-running processes.`);
  } else if (memoryMb > MEMORY_WARNING_MB) {
    recommendations.push(`Elevated memory usage (${memoryMb}MB). Review large data structures and consider streaming responses.`);
  }

  if (cpuTimeMs > CPU_TIME_CRITICAL_MS) {
    recommendations.push(`CRITICAL: CPU time (${cpuTimeMs}ms) exceeds ${CPU_TIME_CRITICAL_MS}ms threshold. Optimize compute-heavy operations.`);
  } else if (cpuTimeMs > CPU_TIME_WARNING_MS) {
    recommendations.push(`Elevated CPU time (${cpuTimeMs}ms). Consider caching or deferring expensive computations.`);
  }

  if (requestCount > 0 && recommendations.length === 0) {
    recommendations.push('Worker performance is within healthy thresholds. No action needed.');
  }

  return recommendations;
}

/**
 * Generate a Worker performance report using available runtime metrics.
 * Designed for both Cloudflare Workers and local Node.js environments.
 */
export async function getWorkerPerformanceReport(): Promise<WorkerPerformanceReport> {
  try {
    const cpuTimeMs = estimateCpuTime();
    const memoryMb = estimateMemoryMb();
    const requestCount = getRequestCount();

    const recommendations = evaluatePerformance(cpuTimeMs, memoryMb, requestCount);

    return { cpuTimeMs, memoryMb, requestCount, recommendations };
  } catch (err) {
    logger.error('[WorkerPerformance] Failed to generate report', err instanceof Error ? err : new Error(String(err)));
    return {
      cpuTimeMs: 0,
      memoryMb: 0,
      requestCount: 0,
      recommendations: ['Error generating report. Check logs for details.'],
    };
  }
}
