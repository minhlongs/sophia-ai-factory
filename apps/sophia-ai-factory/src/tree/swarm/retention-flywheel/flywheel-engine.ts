/**
 * Retention Flywheel Data Persistence & Batch Sweep Engine
 *
 * @module tree/swarm/retention-flywheel/flywheel-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHealthMetric,
  CustomerHealthMetricRow,
  CustomerHealthTelemetryInput,
  SwarmInterventionType,
  SwarmInterventionEvent,
} from '@/seed/types/autonomous-swarm';
import { mapRowToCustomerHealthMetric } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { evaluateCustomerHealth } from './metrics-calculator';
import {
  executeAutomatedInterventions,
  recordManualInterventionEvent,
} from './retention-actions';

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

/**
 * Retrieves the latest health metric for a customer.
 */
export async function getCustomerHealthSummary(
  db: D1Database,
  customerId: string
): Promise<CustomerHealthMetric | null> {
  const row = await db
    .prepare(`
      SELECT * FROM customer_health_metrics
      WHERE customer_id = ?1
      ORDER BY evaluated_at DESC
      LIMIT 1
    `)
    .bind(customerId)
    .first<CustomerHealthMetricRow>();

  return row ? mapRowToCustomerHealthMetric(row) : null;
}

/**
 * Executes a manual intervention dispatched by an administrator or manager.
 */
export async function executeManualIntervention(
  db: D1Database,
  input: {
    customerId: string;
    interventionType: SwarmInterventionType;
    payload?: Record<string, unknown>;
    swarmNodeId?: string;
  }
): Promise<SwarmInterventionEvent> {
  const latestMetric = await getCustomerHealthSummary(db, input.customerId);
  return recordManualInterventionEvent(db, {
    ...input,
    churnRiskBefore: latestMetric ? latestMetric.churnRiskScore : 0.5,
    triggerMetricId: latestMetric ? latestMetric.id : null,
  });
}

/**
 * Runs a high-throughput retention sweep batch over customer health records.
 */
export async function runRetentionSweepBatch(
  db: D1Database,
  limit: number = 50
): Promise<{ evaluatedCount: number; interventionsTriggered: number }> {
  const { results } = await db
    .prepare(`
      SELECT * FROM customer_health_metrics
      WHERE evaluated_at = (
        SELECT MAX(evaluated_at) FROM customer_health_metrics AS sub WHERE sub.customer_id = customer_health_metrics.customer_id
      )
      ORDER BY churn_risk_score DESC
      LIMIT ?1
    `)
    .bind(limit)
    .all<CustomerHealthMetricRow>();

  let interventionsTriggered = 0;
  const metrics = (results ?? []).map(mapRowToCustomerHealthMetric);

  for (const metric of metrics) {
    if (metric.healthTier !== 'green') {
      const interventions = await executeAutomatedInterventions(db, metric);
      interventionsTriggered += interventions.length;
    }
  }

  logger.info('[retention-flywheel] Sweep batch completed', {
    evaluatedCount: metrics.length,
    interventionsTriggered,
  });

  return {
    evaluatedCount: metrics.length,
    interventionsTriggered,
  };
}
