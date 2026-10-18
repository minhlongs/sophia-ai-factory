/**
 * Retention Flywheel Sweep & Manual Intervention Helpers
 *
 * @module tree/swarm/retention-flywheel/flywheel-sweep
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHealthMetric,
  CustomerHealthMetricRow,
  SwarmInterventionType,
  SwarmInterventionEvent,
} from '@/seed/types/autonomous-swarm';
import { mapRowToCustomerHealthMetric } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import {
  executeAutomatedInterventions,
  recordManualInterventionEvent,
} from './retention-actions';

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
