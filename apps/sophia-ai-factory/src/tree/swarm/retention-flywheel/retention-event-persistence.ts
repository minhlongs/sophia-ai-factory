/**
 * D1 Persistence Helper for Swarm Intervention Events
 *
 * @module tree/swarm/retention-flywheel/retention-event-persistence
 */

import type { D1Database } from '@/seed/db/client';
import type {
  SwarmInterventionType,
  SwarmInterventionEvent,
} from '@/seed/types/autonomous-swarm';

export interface InsertInterventionEventParams {
  eventId: string;
  customerId: string;
  triggerMetricId: string | null;
  swarmNodeId: string | null;
  interventionType: SwarmInterventionType;
  payload: Record<string, unknown>;
  churnRiskBefore: number;
  now: number;
}

export async function insertSwarmInterventionEvent(
  db: D1Database,
  params: InsertInterventionEventParams,
): Promise<SwarmInterventionEvent> {
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
      params.eventId,
      params.customerId,
      params.triggerMetricId,
      params.swarmNodeId,
      params.interventionType,
      JSON.stringify(params.payload),
      params.churnRiskBefore,
      params.now,
      params.now,
    )
    .run();

  return {
    id: params.eventId,
    customerId: params.customerId,
    triggerMetricId: params.triggerMetricId,
    swarmNodeId: params.swarmNodeId,
    interventionType: params.interventionType,
    status: 'applied',
    payload: params.payload,
    outcomeImpact: null,
    churnRiskBefore: params.churnRiskBefore,
    churnRiskAfter: null,
    resolvedAt: null,
    createdAt: params.now,
    updatedAt: params.now,
  };
}
