import type { QueryResult } from '@/seed/db/d1-query-types';
import type { D1Database } from '@cloudflare/workers-types';

export async function llmCacheStats(db: D1Database): Promise<QueryResult<unknown>> {
  const nowIso = new Date().toISOString();
  const row = await db
    .prepare(
      `SELECT
        COUNT(*)                                            AS total,
        COALESCE(SUM(CASE WHEN expires_at > ? THEN 1 ELSE 0 END), 0)    AS fresh,
        COALESCE(SUM(CASE WHEN expires_at <= ? THEN 1 ELSE 0 END), 0)   AS expired,
        COALESCE(SUM(hit_count), 0)                                     AS total_hits,
        COALESCE(SUM((COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) * hit_count), 0) AS tokens_saved
      FROM llm_cache`,
    )
    .bind(nowIso, nowIso)
    .first<{ total: number; fresh: number; expired: number; total_hits: number; tokens_saved: number }>();
  return { data: row ?? null, error: null };
}

export async function workflowStats24h(db: D1Database): Promise<QueryResult<unknown>> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = await db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'queued'    THEN 1 ELSE 0 END), 0) AS queued,
        COALESCE(SUM(CASE WHEN status = 'running'   THEN 1 ELSE 0 END), 0) AS running,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END), 0) AS failed
      FROM workflows
      WHERE created_at >= ?`,
    )
    .bind(sinceIso)
    .first<{ queued: number; running: number; completed: number; failed: number }>();
  return { data: row ?? null, error: null };
}

export async function signalsTopEvents24h(db: D1Database, limit: number): Promise<QueryResult<unknown>> {
  const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const res = await db
    .prepare(
      `SELECT event_type, COUNT(*) AS cnt
       FROM signals_events
       WHERE ts >= ?
       GROUP BY event_type
       ORDER BY cnt DESC
       LIMIT ?`,
    )
    .bind(sinceMs, safeLimit)
    .all<{ event_type: string; cnt: number }>();
  return { data: res.results ?? [], error: null };
}
