/**
 * In-memory metrics ring buffer — per Worker isolate, best-effort.
 * Tracks request count, error count, and response durations per route.
 * snapshot() computes p50/p95/p99 percentiles from stored durations.
 * Ring buffer capped at MAX_DURATIONS per route to bound memory.
 */

const MAX_DURATIONS = 1000;

interface RouteStats {
  count: number;
  errors: number;
  durations: number[];
}

// Isolate-scoped map — persists across requests within same Worker instance
const statsMap = new Map<string, RouteStats>();

/** Record a completed request for a given route. */
export function record(route: string, durationMs: number, isError: boolean): void {
  let s = statsMap.get(route);
  if (!s) {
    s = { count: 0, errors: 0, durations: [] };
    statsMap.set(route, s);
  }
  s.count++;
  if (isError) s.errors++;
  // FIFO ring: drop oldest when capped
  if (s.durations.length >= MAX_DURATIONS) {
    s.durations.shift();
  }
  s.durations.push(durationMs);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export interface RouteSnapshot {
  route: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
}

/** Return current stats snapshot across all recorded routes. */
export function snapshot(): RouteSnapshot[] {
  const result: RouteSnapshot[] = [];
  for (const [route, s] of statsMap.entries()) {
    const sorted = s.durations.slice().sort((a, b) => a - b);
    result.push({
      route,
      count: s.count,
      errors: s.errors,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    });
  }
  return result;
}

/** Reset all stats (for testing). */
export function reset(): void {
  statsMap.clear();
}
