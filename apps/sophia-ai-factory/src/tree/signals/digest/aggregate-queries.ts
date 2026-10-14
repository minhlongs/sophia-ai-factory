/**
 * D1 database aggregate query implementations for weekly metrics digest.
 */

import {
  type SignupStats,
  type ConversionRow,
  type PaymentStats,
  type ByokProviderRow,
  type AgentDispatchRow,
  windowStart,
  toInt,
  toFloat,
} from './aggregate-types';

export async function querySignupStats(
  db: D1Database,
  windowMs = windowStart(),
): Promise<SignupStats> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM signals_events
       WHERE event_type = 'tier_conversion'
         AND ts >= ?
         AND (
           json_extract(props_json, '$.from_tier') = 'free'
           OR json_extract(props_json, '$.from_tier') = 'BASIC'
         )`,
    )
    .bind(windowMs)
    .first<{ count: number | string }>();

  return { count: toInt(row?.count) };
}

export async function queryConversionsByTier(
  db: D1Database,
  windowMs = windowStart(),
): Promise<ConversionRow[]> {
  const result = await db
    .prepare(
      `SELECT json_extract(props_json, '$.to_tier') AS to_tier, COUNT(*) AS count
       FROM signals_events
       WHERE event_type = 'tier_conversion'
         AND ts >= ?
       GROUP BY json_extract(props_json, '$.to_tier')
       ORDER BY count DESC
       LIMIT 20`,
    )
    .bind(windowMs)
    .all<{ to_tier: string | null; count: number | string }>();

  return (result.results ?? [])
    .filter((r) => r.to_tier != null)
    .map((r) => ({ to_tier: String(r.to_tier), count: toInt(r.count) }));
}

export async function queryPaymentStats(
  db: D1Database,
  windowMs = windowStart(),
): Promise<PaymentStats> {
  const successRow = await db
    .prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(CAST(json_extract(props_json, '$.amount_usd') AS REAL)), 0) AS total
       FROM signals_events
       WHERE event_type = 'payment_success'
         AND ts >= ?`,
    )
    .bind(windowMs)
    .first<{ cnt: number | string; total: number | string }>();

  const failedRow = await db
    .prepare(
      `SELECT COUNT(*) AS cnt
       FROM signals_events
       WHERE event_type = 'payment_failed'
         AND ts >= ?`,
    )
    .bind(windowMs)
    .first<{ cnt: number | string }>();

  return {
    success_count: toInt(successRow?.cnt),
    failed_count: toInt(failedRow?.cnt),
    total_usd: toFloat(successRow?.total),
  };
}

export async function queryTopByokProviders(
  db: D1Database,
  windowMs = windowStart(),
): Promise<ByokProviderRow[]> {
  const result = await db
    .prepare(
      `SELECT json_extract(props_json, '$.provider') AS provider, COUNT(*) AS call_count
       FROM signals_events
       WHERE event_type = 'byok_call'
         AND ts >= ?
       GROUP BY json_extract(props_json, '$.provider')
       ORDER BY call_count DESC
       LIMIT 10`,
    )
    .bind(windowMs)
    .all<{ provider: string | null; call_count: number | string }>();

  return (result.results ?? [])
    .filter((r) => r.provider != null)
    .map((r) => ({ provider: String(r.provider), call_count: toInt(r.call_count) }));
}

export async function queryAgentDispatches(
  db: D1Database,
  windowMs = windowStart(),
): Promise<AgentDispatchRow[]> {
  const result = await db
    .prepare(
      `SELECT
         COALESCE(json_extract(props_json, '$.command'), json_extract(props_json, '$.campaign_id'), 'unknown') AS command,
         SUM(COALESCE(CAST(json_extract(props_json, '$.channel_count') AS INTEGER), 1)) AS dispatch_count
       FROM signals_events
       WHERE event_type = 'agent_dispatch'
         AND ts >= ?
       GROUP BY command
       ORDER BY dispatch_count DESC
       LIMIT 10`,
    )
    .bind(windowMs)
    .all<{ command: string | null; dispatch_count: number | string }>();

  return (result.results ?? []).map((r) => ({
    command: String(r.command ?? 'unknown'),
    dispatch_count: toInt(r.dispatch_count),
  }));
}
