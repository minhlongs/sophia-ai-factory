/**
 * Audit log metadata parser and action frequency aggregation helpers.
 * @module land/observability/audit-log-stats-helpers
 */

import { getD1 } from '@/seed/db/client';

export interface ActionFrequency {
  action: string;
  count: number;
}

export function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Top-N most frequent actions within a window — useful for sanity-checking
 * what's flowing through the audit pipe.
 */
export async function getTopActions(
  fromTs: number,
  toTs: number,
  limit: number = 20,
): Promise<ActionFrequency[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db
    .prepare(
      `SELECT action, COUNT(*) AS n
       FROM audit_log
       WHERE ts >= ?1 AND ts <= ?2
       GROUP BY action
       ORDER BY n DESC
       LIMIT ?3`,
    )
    .bind(fromTs, toTs, safeLimit)
    .all<{ action: string; n: number }>();
  return (result.results ?? []).map((r) => ({
    action: r.action,
    count: Number(r.n),
  }));
}
