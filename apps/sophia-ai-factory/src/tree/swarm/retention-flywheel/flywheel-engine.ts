/**
 * Retention Flywheel Data Persistence & Batch Sweep Engine
 *
 * @module tree/swarm/retention-flywheel/flywheel-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHealthMetric,
  CustomerHealthTelemetryInput,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { evaluateCustomerHealth } from './metrics-calculator';

export {
  getCustomerHealthSummary,
  executeManualIntervention,
  runRetentionSweepBatch,
} from './flywheel-sweep';

/**
 * Persists evaluated customer health metric into D1 database.
 */
export async function recordCustomerHealth(
  db: D1Database,
  telemetry: CustomerHealthTelemetryInput
): Promise<CustomerHealthMetric> {
  const prevRow = await db
    .prepare('SELECT churn_risk_score FROM customer_health_metrics WHERE customer_id = ?1 ORDER BY evaluated_at DESC, rowid DESC LIMIT 1')
    .bind(telemetry.customerId)
    .first<{ churn_risk_score: number }>();

  const telemetryWithPrev = {
    ...telemetry,
    previousChurnRiskScore: prevRow ? prevRow.churn_risk_score : telemetry.previousChurnRiskScore,
  };

  const metric = evaluateCustomerHealth(telemetryWithPrev);

  await db
    .prepare(`
      INSERT INTO customer_health_metrics (
        id, customer_id, org_id, period_start, period_end,
        active_agents_count, video_generation_count, api_request_count,
        api_error_count, api_error_rate, login_frequency_7d, mcu_consumption_rate,
        nps_score, churn_risk_score, health_tier, trend_direction,
        risk_factors_json, last_activity_at, evaluated_at, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
    `)
    .bind(
      metric.id,
      metric.customerId,
      metric.orgId,
      metric.periodStart,
      metric.periodEnd,
      metric.activeAgentsCount,
      metric.videoGenerationCount,
      metric.apiRequestCount,
      metric.apiErrorCount,
      metric.apiErrorRate,
      metric.loginFrequency7d,
      metric.mcuConsumptionRate,
      metric.npsScore,
      metric.churnRiskScore,
      metric.healthTier,
      metric.trendDirection,
      JSON.stringify(metric.riskFactors),
      metric.lastActivityAt,
      metric.evaluatedAt,
      metric.createdAt
    )
    .run();

  logger.info('[retention-flywheel] Health metric recorded', {
    customerId: metric.customerId,
    churnRiskScore: metric.churnRiskScore,
    healthTier: metric.healthTier,
  });

  return metric;
}
