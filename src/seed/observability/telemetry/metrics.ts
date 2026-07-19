/**
 * In-memory metrics ring buffer for API route observability.
 *
 * Used by instrument-api.ts to record per-route latency + error counts.
 * Safe to import in Cloudflare Workers (no Node.js-specific APIs).
 */

type MetricEntry = {
  route: string;
  durationMs: number;
  isError: boolean;
  timestamp: number;
};

const MAX_ENTRIES = 1000;
const entries: MetricEntry[] = [];

export function record(route: string, durationMs: number, isError: boolean): void {
  entries.push({ route, durationMs, isError, timestamp: Date.now() });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function getStats(route?: string): Record<string, { count: number; avgMs: number; errorRate: number }> {
  const filtered = route ? entries.filter(e => e.route === route) : entries;
  const grouped = new Map<string, MetricEntry[]>();
  for (const entry of filtered) {
    const list = grouped.get(entry.route) ?? [];
    list.push(entry);
    grouped.set(entry.route, list);
  }
  const result: Record<string, { count: number; avgMs: number; errorRate: number }> = {};
  for (const [key, list] of grouped) {
    const totalMs = list.reduce((sum, e) => sum + e.durationMs, 0);
    const errors = list.filter(e => e.isError).length;
    result[key] = {
      count: list.length,
      avgMs: Math.round(totalMs / list.length),
      errorRate: Number((errors / list.length).toFixed(4)),
    };
  }
  return result;
}

export function getEntries(limit = 100): MetricEntry[] {
  const start = Math.max(0, entries.length - limit);
  return entries.slice(start);
}

export function clear(): void {
  entries.length = 0;
}
