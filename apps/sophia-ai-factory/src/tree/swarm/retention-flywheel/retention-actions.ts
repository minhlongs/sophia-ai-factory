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
import { insertSwarmInterventionEvent } from './retention-event-persistence';

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
    const createdEvent = await insertSwarmInterventionEvent(db, {
      eventId,
      customerId: metric.customerId,
      triggerMetricId: metric.id,
      swarmNodeId: swarmNodeId ?? null,
      interventionType: action.type,
      payload: action.payload,
      churnRiskBefore: metric.churnRiskScore,
      now,
    });

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

  return insertSwarmInterventionEvent(db, {
    eventId,
    customerId: input.customerId,
    triggerMetricId: input.triggerMetricId ?? null,
    swarmNodeId: input.swarmNodeId ?? null,
    interventionType: input.interventionType,
    payload: input.payload ?? {},
    churnRiskBefore: input.churnRiskBefore ?? 0.5,
    now,
  });
}
