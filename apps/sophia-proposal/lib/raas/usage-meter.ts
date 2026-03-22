/**
 * RaaS Usage Meter
 *
 * Records API usage per key and provides aggregated stats for billing/analytics.
 */

import { getD1Client } from '@/lib/db/client';

// ── Local types ───────────────────────────────────────────────────────────────

export interface UsageStats {
  total_calls: number;
  total_mcu: number;
  avg_response_ms: number;
  calls_by_day: { date: string; count: number; mcu: number }[];
}

export interface RecordUsageParams {
  apiKeyId: string;
  orgId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  mcuConsumed: number;
  responseTimeMs: number;
}

// ── Record usage ──────────────────────────────────────────────────────────────

/**
 * Insert a single API usage record into raas_api_usage.
 * Non-blocking — errors are logged but not thrown.
 */
export async function recordUsage(params: RecordUsageParams): Promise<void> {
  try {
    const db = await getD1Client();
    await db.from('raas_api_usage').insert({
      api_key_id:      params.apiKeyId,
      org_id:          params.orgId,
      endpoint:        params.endpoint,
      method:          params.method,
      status_code:     params.statusCode,
      mcu_consumed:    params.mcuConsumed,
      response_time_ms: params.responseTimeMs,
    });
  } catch (err) {
    console.error('[usage-meter] recordUsage failed:', err);
  }
}

// ── Aggregate stats ───────────────────────────────────────────────────────────

/**
 * Return aggregated usage stats for an org over the last N days.
 */
export async function getUsageStats(orgId: string, days: number): Promise<UsageStats> {
  const db = await getD1Client();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await db
    .from<{ status_code: number; mcu_consumed: number; response_time_ms: number; created_at: string }>('raas_api_usage')
    .select('status_code, mcu_consumed, response_time_ms, created_at')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (error) throw new Error('Failed to fetch usage stats');

  const rows = data ?? [];
  const total_calls = rows.length;
  const total_mcu = rows.reduce((s, r) => s + (r.mcu_consumed ?? 0), 0);
  const total_ms = rows.reduce((s, r) => s + (r.response_time_ms ?? 0), 0);
  const avg_response_ms = total_calls ? Math.round(total_ms / total_calls) : 0;

  // Group by UTC date string
  const byDay: Record<string, { count: number; mcu: number }> = {};
  for (const row of rows) {
    const date = row.created_at.substring(0, 10);
    if (!byDay[date]) byDay[date] = { count: 0, mcu: 0 };
    byDay[date].count += 1;
    byDay[date].mcu += row.mcu_consumed ?? 0;
  }

  const calls_by_day = Object.entries(byDay)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { total_calls, total_mcu, avg_response_ms, calls_by_day };
}
