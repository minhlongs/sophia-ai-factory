import type { createServerClient } from '@/seed/db/client';
import { emitBurnRateAlert } from '@/seed/observability/telemetry/sentry-metrics';
import type { SLOBurnMetrics, SLOConfig } from './types';

export function recordSloBurn(
  db: ReturnType<typeof createServerClient>,
  slo: SLOConfig,
  yearMonth: string,
  windowStart: string,
  windowEnd: string,
  metrics: SLOBurnMetrics
): void {
  const stmt = db.prepare(`
    INSERT INTO slo_burn (
      slo_name, year_month, window_start, window_end,
      target_value, target_operator,
      total_requests, good_requests, bad_requests, measured_value,
      error_budget, error_budget_consumed, burn_rate,
      alert_level, alert_fired_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slo_name, year_month) DO UPDATE SET
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      target_value = excluded.target_value,
      target_operator = excluded.target_operator,
      total_requests = excluded.total_requests,
      good_requests = excluded.good_requests,
      bad_requests = excluded.bad_requests,
      measured_value = excluded.measured_value,
      error_budget = excluded.error_budget,
      error_budget_consumed = excluded.error_budget_consumed,
      burn_rate = excluded.burn_rate,
      alert_level = excluded.alert_level,
      alert_fired_at = excluded.alert_fired_at,
      alert_acknowledged_at = CASE WHEN excluded.alert_level IS NOT NULL AND slo_burn.alert_acknowledged_at IS NULL
        THEN datetime('now') ELSE slo_burn.alert_acknowledged_at END,
      metadata = excluded.metadata,
      computed_at = datetime('now')
  `);

  const metadata = {
    p50: metrics.p50,
    p95: metrics.p95,
    p99: metrics.p99,
    sample_count: metrics.totalRequests,
    routes: slo.routes,
    thresholdMs: slo.thresholdMs,
  };

  const alertFiredAt = metrics.alertLevel ? new Date().toISOString() : null;

  stmt.bind(
    slo.name,
    yearMonth,
    windowStart,
    windowEnd,
    slo.targetValue,
    slo.targetOperator,
    metrics.totalRequests,
    metrics.goodRequests,
    metrics.badRequests,
    metrics.measuredValue,
    metrics.errorBudget,
    metrics.errorBudgetConsumed,
    metrics.burnRate,
    metrics.alertLevel,
    alertFiredAt,
    JSON.stringify(metadata)
  ).run();

  if (metrics.alertLevel) {
    emitBurnRateAlert({
      sloName: slo.name,
      burnRate: metrics.burnRate,
      alertLevel: metrics.alertLevel,
      period: '1m',
    });
  }
}
