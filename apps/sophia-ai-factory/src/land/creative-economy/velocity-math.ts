/**
 * Learning-velocity scoring math (pure functions, no I/O).
 *
 * Mirrors forest/inngest/functions/learning-velocity-cron.ts exactly.
 * land cannot import forest (layer rule), so the math is duplicated here.
 * A drift-guard test asserts parity between the two implementations.
 *
 * @module land/creative-economy/velocity-math
 */

export interface EventRow {
  metrics_json: string;
}

export function parseMetrics(row: EventRow): Record<string, number> {
  try {
    const raw = JSON.parse(row.metrics_json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function avgMetrics(rows: EventRow[]): Record<string, number> {
  const accum: Record<string, number[]> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(parseMetrics(r))) {
      if (!accum[k]) accum[k] = [];
      accum[k].push(v);
    }
  }
  const out: Record<string, number> = {};
  for (const [k, vals] of Object.entries(accum)) {
    out[k] = vals.reduce((s, n) => s + n, 0) / vals.length;
  }
  return out;
}

export function computeVelocityScore(
  early: Record<string, number>,
  late: Record<string, number>,
): number {
  const keys = new Set([...Object.keys(early), ...Object.keys(late)]);
  if (keys.size === 0) return 50; // no data → neutral

  let totalChange = 0;
  let count = 0;
  for (const k of keys) {
    const e = early[k] ?? 0;
    const l = late[k] ?? 0;
    const denom = Math.abs(e) + Math.abs(l);
    if (denom === 0) continue;
    totalChange += (l - e) / denom;
    count++;
  }
  if (count === 0) return 50;
  const avg = totalChange / count;
  return Math.round(Math.max(0, Math.min(100, (avg + 1) * 50)));
}