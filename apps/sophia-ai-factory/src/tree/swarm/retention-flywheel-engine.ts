/**
 * Customer Retention Flywheel Engine & Real-Time Churn Prevention Daemon
 *
 * Layer: tree/swarm (Domain services & pure algorithms)
 * Dependencies: @/seed/types/autonomous-swarm, @/seed/db/client, @/seed/utils/logger-utility
 *
 * Implements:
 * - Real-time 4-factor churn risk scoring (0.0000 to 1.0000)
 * - 4-level health tiering (green, yellow, red, critical)
 * - Engagement trend direction analysis (improving, stable, declining, rapid_drop)
 * - Multi-tier automated intervention triggering (bonus credits, playbooks, CS escalation)
 * - 7-day anti-spam cooldown protection for interventions
 * - Batch retention sweep orchestration for high-volume customer bases
 *
 * @module tree/swarm/retention-flywheel-engine
 */

import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHealthMetric,
  CustomerHealthMetricRow,
  CustomerHealthTelemetryInput,
  HealthTier,
  TrendDirection,
  SwarmInterventionType,
  SwarmInterventionEvent,
} from '@/seed/types/autonomous-swarm';
import { mapRowToCustomerHealthMetric } from '@/seed/types/autonomous-swarm';
import { logger } from '@/seed/utils/logger-utility';

export const INTERVENTION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cooldown

function evaluateAgentPenalty(count: number, riskFactors: string[]): number {
  if (count >= 3) return 0.0;
  if (count >= 1) {
    riskFactors.push('low_active_agents_count');
    return 0.10;
  }
  riskFactors.push('zero_active_agents');
  return 0.25;
}

function evaluateVideoPenalty(count: number, riskFactors: string[]): number {
  if (count >= 10) return 0.0;
  if (count >= 5) {
    riskFactors.push('moderate_video_generation_drop');
    return 0.10;
  }
  if (count >= 1) {
    riskFactors.push('low_video_generation_velocity');
    return 0.20;
  }
  riskFactors.push('zero_video_generation');
  return 0.35;
}

function evaluateApiPenalty(requests: number, errors: number, riskFactors: string[]): number {
  const errorRate = requests > 0 ? errors / requests : 0.0;
  if (errorRate <= 0.01) return 0.0;
  if (errorRate <= 0.05) {
    riskFactors.push('elevated_api_error_rate_1_to_5_pct');
    return 0.10;
  }
  riskFactors.push('critical_api_error_spike_above_5_pct');
  return 0.20;
}

function evaluateRecencyPenalty(logins7d: number, riskFactors: string[]): number {
  if (logins7d >= 4) return 0.0;
  if (logins7d >= 1) {
    riskFactors.push('low_login_frequency_under_4x');
    return 0.08;
  }
  riskFactors.push('zero_logins_in_7d');
  return 0.20;
}

function resolveHealthTier(score: number): HealthTier {
  if (score >= 0.75) return 'critical';
  if (score >= 0.50) return 'red';
  if (score >= 0.25) return 'yellow';
  return 'green';
}

function resolveTrendDirection(current: number, previous?: number | null): TrendDirection {
  if (previous === undefined || previous === null) return 'stable';
  const delta = current - previous;
  if (delta <= -0.10) return 'improving';
  if (delta >= 0.25) return 'rapid_drop';
  if (delta >= 0.10) return 'declining';
  return 'stable';
}

/**
 * Pure 4-factor churn score calculator.
 * Returns { churnRiskScore, healthTier, riskFactors, trendDirection }.
 */
export function calculateChurnRisk(telemetry: CustomerHealthTelemetryInput): {
  churnRiskScore: number;
  healthTier: HealthTier;
  riskFactors: string[];
  trendDirection: TrendDirection;
} {
  const riskFactors: string[] = [];

  const agentPenalty = evaluateAgentPenalty(telemetry.activeAgentsCount, riskFactors);
  const videoPenalty = evaluateVideoPenalty(telemetry.videoGenerationCount, riskFactors);
  const apiPenalty = evaluateApiPenalty(telemetry.apiRequestCount, telemetry.apiErrorCount, riskFactors);
  const recencyPenalty = evaluateRecencyPenalty(telemetry.loginFrequency7d, riskFactors);

  const rawScore = agentPenalty + videoPenalty + apiPenalty + recencyPenalty;
  const churnRiskScore = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(4));
  const healthTier = resolveHealthTier(churnRiskScore);
  const trendDirection = resolveTrendDirection(churnRiskScore, telemetry.previousChurnRiskScore);

  return {
    churnRiskScore,
    healthTier,
    riskFactors,
    trendDirection,
  };
}

/**
 * Pure function: Evaluates full health metric for a given customer telemetry input.
 */
export function evaluateCustomerHealth(
  telemetry: CustomerHealthTelemetryInput,
  now: number = Date.now()
): CustomerHealthMetric {
  const { churnRiskScore, healthTier, riskFactors, trendDirection } = calculateChurnRisk(telemetry);
  const errorRate = telemetry.apiRequestCount > 0
    ? Number((telemetry.apiErrorCount / telemetry.apiRequestCount).toFixed(4))
    : 0.0;

  const metricId = `chm_${telemetry.customerId}_${now}_${Math.random().toString(16).slice(2, 8)}`;

  return {
    id: metricId,
    customerId: telemetry.customerId,
    orgId: telemetry.orgId ?? null,
    periodStart: now - 30 * 24 * 60 * 60 * 1000,
    periodEnd: now,
    activeAgentsCount: telemetry.activeAgentsCount,
    videoGenerationCount: telemetry.videoGenerationCount,
    apiRequestCount: telemetry.apiRequestCount,
    apiErrorCount: telemetry.apiErrorCount,
    apiErrorRate: errorRate,
    loginFrequency7d: telemetry.loginFrequency7d,
    mcuConsumptionRate: telemetry.mcuConsumptionRate,
    npsScore: telemetry.npsScore ?? null,
    churnRiskScore,
    healthTier,
    trendDirection,
    riskFactors,
    lastActivityAt: telemetry.lastActivityAt ?? now,
    evaluatedAt: now,
    createdAt: now,
  };
}

/**
 * Persists evaluated customer health metric into D1 database.
 */
export async function recordCustomerHealth(
  db: D1Database,
  telemetry: CustomerHealthTelemetryInput
): Promise<CustomerHealthMetric> {
  // Fetch previous risk score for accurate trend analysis
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
 * Checks if an intervention of a specific type has already been triggered
 * for the customer within the cooldown window (default: 7 days).
 */
export async function isInterventionInCooldown(
  db: D1Database,
  customerId: string,
  interventionType: SwarmInterventionType,
  cooldownMs: number = INTERVENTION_COOLDOWN_MS
): Promise<boolean> {
  const cutoff = Date.now() - cooldownMs;
  const row = await db
    .prepare(`
      SELECT id FROM swarm_intervention_events
      WHERE customer_id = ?1
        AND intervention_type = ?2
        AND created_at >= ?3
        AND status NOT IN ('failed', 'rejected')
      LIMIT 1
    `)
    .bind(customerId, interventionType, cutoff)
    .first<{ id: string }>();

  return Boolean(row);
}

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

  const candidateActions: Array<{
    type: SwarmInterventionType;
    payload: Record<string, unknown>;
  }> = [];

  // Determine needed interventions based on health metrics
  if (metric.healthTier === 'critical') {
    candidateActions.push({
      type: 'cs_escalation',
      payload: { priority: 'P1', reason: 'Critical churn risk >= 0.75', riskFactors: metric.riskFactors },
    });
    candidateActions.push({
      type: 'bonus_credits',
      payload: { creditAmountMcu: 10_000, grantReason: 'Retention intervention credit grant' },
    });
  } else if (metric.healthTier === 'red') {
    candidateActions.push({
      type: 'bonus_credits',
      payload: { creditAmountMcu: 5_000, grantReason: 'Tier red win-back grant' },
    });
    candidateActions.push({
      type: 'feature_reengagement',
      payload: { suggestedFeatures: ['apac_dubbing', 'creator_marketplace', 'bulk_syndication'] },
    });
  } else if (metric.healthTier === 'yellow') {
    candidateActions.push({
      type: 'onboarding_guide',
      payload: { playbookSlug: 'video-automation-mastery', language: 'bilingual' },
    });
  }

  // Specialized check: API error spike regardless of tier
  if (metric.apiErrorRate > 0.05) {
    candidateActions.push({
      type: 'automated_health_check',
      payload: { errorRatePct: Number((metric.apiErrorRate * 100).toFixed(2)), diagnosticRef: 'api_edge_remediation' },
    });
  }

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
  const now = Date.now();
  const latestMetric = await getCustomerHealthSummary(db, input.customerId);
  const churnRiskBefore = latestMetric ? latestMetric.churnRiskScore : 0.5;

  const eventId = `sie_man_${input.customerId}_${Math.random().toString(16).slice(2, 10)}`;
  const payload = input.payload ?? {};

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
      latestMetric ? latestMetric.id : null,
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
    triggerMetricId: latestMetric ? latestMetric.id : null,
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
 * Runs a high-throughput retention sweep batch over customer health records.
 */
export async function runRetentionSweepBatch(
  db: D1Database,
  limit: number = 50
): Promise<{ evaluatedCount: number; interventionsTriggered: number }> {
  // Query distinct customers with latest metrics
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
