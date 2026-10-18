/**
 * D1 BYOK and agent dispatch aggregate queries for weekly metrics digest.
 */

import {
  type ByokProviderRow,
  type AgentDispatchRow,
  windowStart,
  toInt,
} from './aggregate-types';

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
