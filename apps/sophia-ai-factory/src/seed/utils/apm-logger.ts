/**
 * APM baseline logger — lightweight D1 counter for 5 critical signals.
 *
 * Uses D1 UPSERT (INSERT … ON CONFLICT DO UPDATE SET value = value + 1) via
 * `createServerClient()` + `db.prepare().bind().run()`. Follows the same
 * proven pattern used in per-channel-quota.ts and tier-ledger.ts.
 *
 * Writes are fire-and-forget: log failure, never throw.
 * Reads return a number; 0 on failure or null result.
 *
 * Layer: seed — importable by all layers.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

// ─── Public types ────────────────────────────────────────────────────────────

export const APM_METRICS = [
  'deploy_bypasses',
  'payment_failures',
  'quota_violations',
  'auth_failures',
  'video_gen_errors',
] as const;

export type APM_METRIC = (typeof APM_METRICS)[number];

const METRIC_SET: ReadonlySet<string> = new Set(APM_METRICS);

export function isAPMMetric(name: string): name is APM_METRIC {
  return METRIC_SET.has(name);
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

const UPVOTE_SQL = `INSERT INTO apm_metrics (id, metric_name, value)
  VALUES (?1, ?2, ?3)
  ON CONFLICT(metric_name) DO UPDATE SET value = value + excluded.value`;

const COUNT_SQL = `SELECT COALESCE(SUM(value), 0) AS total
  FROM apm_metrics WHERE metric_name = ?1`;

const COUNT_SINCE_SQL = `SELECT COALESCE(SUM(value), 0) AS total
  FROM apm_metrics WHERE metric_name = ?1 AND recorded_at >= ?2`;

// ─── Core operations ─────────────────────────────────────────────────────────

/**
 * Increment a metric counter in D1. Non-fatal.
 */
export async function recordAPM(metricName: APM_METRIC, count = 1): Promise<void> {
  try {
    const db = createServerClient();
    await db.prepare(UPVOTE_SQL).bind(crypto.randomUUID(), metricName, count).run();
  } catch (err) {
    logger.warn('[apm] recordAPM failed — continuing', {
      metric: metricName,
      count,
      error: err instanceof Error ? err.message : String(err),
    } as Record<string, unknown>);
  }
}

/**
 * Return the total count for a metric. Optionally filter since a
 * Unix timestamp (seconds) — the recorded_at column uses ISO-8601 so
 * pass an ISO string for the `since` parameter.
 */
export async function getAPMCount(metricName: APM_METRIC, since?: string): Promise<number> {
  try {
    const db = createServerClient();
    const sql = since ? COUNT_SINCE_SQL : COUNT_SQL;
    const params = since ? [metricName, since] : [metricName];
    const row = await db.prepare(sql).bind(...params).first<{ total: number }>();
    return row?.total ?? 0;
  } catch (err) {
    logger.warn('[apm] getAPMCount failed', {
      metric: metricName,
      since,
      error: err instanceof Error ? err.message : String(err),
    } as Record<string, unknown>);
    return 0;
  }
}
