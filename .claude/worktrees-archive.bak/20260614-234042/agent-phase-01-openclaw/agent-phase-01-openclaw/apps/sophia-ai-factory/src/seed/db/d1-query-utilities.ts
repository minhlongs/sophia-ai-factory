/** Auto-parse JSON fields stored as TEXT in D1 */
export function parseJsonFields<T>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try { out[k] = JSON.parse(v); } catch { /* keep as string */ }
    }
  }
  return out as T;
}

/** Serialize objects/arrays to JSON string for D1 storage */
export function serializeValue(v: unknown): unknown {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}
