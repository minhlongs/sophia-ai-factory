/**
 * Interventions Automated and Manual Execution Actions
 *
 * @module tree/swarm/retention-flywheel/retention-actions
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHealthMetric,
  SwarmInterventionType,
  SwarmInterventionEvent,
} from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';
import { isInterventionInCooldown, resolveCandidateActions } from './cooldown-resolver';

/**
 * Executes automated interventions based on evaluated customer health tier.
 */
export async function executeAutomatedInterventions(
  db: D1Database,
  metric: CustomerHealthMetric,
  swarmNodeId?: string
): Promise<SwarmInterventionEvent[]> {
  const triggeredEvents: SwarmInterventionEvent[] = [];
  const now = Date.now();
  const candidateActions = resolveCandidateActions(metric);

  for (const action of candidateActions) {
    const inCooldown = await isInterventionInCooldown(db, metric.customerId, action.type);
    if (inCooldown) {
      logger.info('[retention-flywheel] Intervention in cooldown, skipping', {
        customerId: metric.customerId,
        type: action.type,
      });
      continue;
    }

    const eventId = `sie_${metric.customerId}_${action.type}_${Math.random().toString(16).slice(2, 10)}`;

    await db
      .prepare(`
        INSERT INTO swarm_intervention_events (
          id, customer_id, trigger_metric_id, swarm_node_id,
          intervention_type, status, payload_json, outcome_impact,
          churn_risk_before, churn_risk_after, resolved_at,
          created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, 'applied', ?6, NULL, ?7, NULL, NULL, ?8, ?9)
      `)
      .bind(
        eventId,
        metric.customerId,
        metric.id,
        swarmNodeId ?? null,
        action.type,
        JSON.stringify(action.payload),
        metric.churnRiskScore,
        now,
        now
      )
      .run();

    const createdEvent: SwarmInterventionEvent = {
      id: eventId,
      customerId: metric.customerId,
      triggerMetricId: metric.id,
      swarmNodeId: swarmNodeId ?? null,
      interventionType: action.type,
      status: 'applied',
      payload: action.payload,
      outcomeImpact: null,
      churnRiskBefore: metric.churnRiskScore,
      churnRiskAfter: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    triggeredEvents.push(createdEvent);
    logger.info('[retention-flywheel] Intervention event created', {
      eventId,
      customerId: metric.customerId,
      type: action.type,
    });
  }

  return triggeredEvents;
}

/**
 * Records a manual intervention event in D1.
 */
export async function recordManualInterventionEvent(
  db: D1Database,
  input: {
    customerId: string;
    interventionType: SwarmInterventionType;
    payload?: Record<string, unknown>;
    swarmNodeId?: string;
    churnRiskBefore?: number;
    triggerMetricId?: string | null;
  }
): Promise<SwarmInterventionEvent> {
  const now = Date.now();
  const eventId = `sie_man_${input.customerId}_${Math.random().toString(16).slice(2, 10)}`;
  const payload = input.payload ?? {};
  const churnRiskBefore = input.churnRiskBefore ?? 0.5;

  await db
    .prepare(`
      INSERT INTO swarm_intervention_events (
        id, customer_id, trigger_metric_id, swarm_node_id,
        intervention_type, status, payload_json, outcome_impact,
        churn_risk_before, churn_risk_after, resolved_at,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, 'applied', ?6, NULL, ?7, NULL, NULL, ?8, ?9)
    `)
    .bind(
      eventId,
      input.customerId,
      input.triggerMetricId ?? null,
      input.swarmNodeId ?? null,
      input.interventionType,
      JSON.stringify(payload),
      churnRiskBefore,
      now,
      now
    )
    .run();

  return {
    id: eventId,
    customerId: input.customerId,
    triggerMetricId: input.triggerMetricId ?? null,
    swarmNodeId: input.swarmNodeId ?? null,
    interventionType: input.interventionType,
    status: 'applied',
    payload,
    outcomeImpact: null,
    churnRiskBefore,
    churnRiskAfter: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
