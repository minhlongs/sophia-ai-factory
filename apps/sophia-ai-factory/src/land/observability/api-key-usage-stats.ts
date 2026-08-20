/**
 * API key usage observability.
 *
 * Joins `raas_api_keys` (one row per issued key) with `raas_api_usage`
 * (per-request log) to surface per-key request volume + error rate + latency
 * within a window. Used by /dashboard/admin/api-key-usage.
 *
 * Keys with zero usage in the window still appear (LEFT JOIN) so admins can
 * spot dormant keys to clean up.
 *
 * @module land/observability/api-key-usage-stats
 */

import { getD1 } from '@/seed/db/client';

export interface ApiKeyUsageRow {
  apiKeyId: string;
  orgId: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  requestCount: number;
  errorCount: number;
  /** errorCount / requestCount; 0 when no requests. */
  errorRate: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  /** ISO string from raas_api_keys.last_used_at, null if never used. */
  lastUsedAt: string | null;
  createdAt: string;
}

interface RawRow {
  api_key_id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  is_active: number;
  request_count: number;
  error_count: number;
  avg_latency_ms: number | null;
  max_latency_ms: number | null;
  last_used_at: string | null;
  created_at: string;
}

/**
 * Per-key usage stats within [fromTs, toTs]. Sorted DESC by request count.
 * `limit` clamped to [1, 200].
 */
export async function getApiKeyUsageStats(
  fromTs: number,
  toTs: number,
  limit: number = 50,
): Promise<ApiKeyUsageRow[]> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  const fromIso = new Date(fromTs * 1000).toISOString();
  const toIso = new Date(toTs * 1000).toISOString();

  const result = await db
    .prepare(
      `SELECT
         k.id   AS api_key_id,
         k.org_id,
         k.name,
         k.key_prefix,
         k.is_active,
         COALESCE(u.request_count, 0) AS request_count,
         COALESCE(u.error_count, 0)   AS error_count,
         u.avg_latency_ms,
         u.max_latency_ms,
         k.last_used_at,
         k.created_at
       FROM raas_api_keys k
       LEFT JOIN (
         SELECT api_key_id,
                COUNT(*) AS request_count,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS error_count,
                AVG(response_time_ms) AS avg_latency_ms,
                MAX(response_time_ms) AS max_latency_ms
         FROM raas_api_usage
         WHERE datetime(created_at) >= datetime(?1)
           AND datetime(created_at) <= datetime(?2)
         GROUP BY api_key_id
       ) u ON u.api_key_id = k.id
       ORDER BY request_count DESC, k.created_at DESC
       LIMIT ?3`,
    )
    .bind(fromIso, toIso, safeLimit)
    .all<RawRow>();

  return (result.results ?? []).map((r) => {
    const requestCount = Number(r.request_count);
    const errorCount = Number(r.error_count);
    return {
      apiKeyId: r.api_key_id,
      orgId: r.org_id,
      name: r.name,
      keyPrefix: r.key_prefix,
      isActive: Number(r.is_active) === 1,
      requestCount,
      errorCount,
      errorRate: requestCount > 0 ? errorCount / requestCount : 0,
      avgLatencyMs: r.avg_latency_ms !== null ? Math.round(Number(r.avg_latency_ms)) : 0,
      maxLatencyMs: r.max_latency_ms !== null ? Number(r.max_latency_ms) : 0,
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
    };
  });
}
