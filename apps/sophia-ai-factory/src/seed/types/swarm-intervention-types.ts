/**
 * Autonomous Swarm Intervention Contracts & Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/swarm-intervention-types
 */

export const SWARM_INTERVENTION_TYPES = [
  'bonus_credits',
  'onboarding_guide',
  'cs_escalation',
  'discount_offer',
  'feature_reengagement',
  'automated_health_check',
] as const;
export type SwarmInterventionType = (typeof SWARM_INTERVENTION_TYPES)[number];

export const SWARM_INTERVENTION_STATUSES = [
  'triggered',
  'in_progress',
  'applied',
  'acknowledged',
  'failed',
  'rejected',
] as const;
export type SwarmInterventionStatus = (typeof SWARM_INTERVENTION_STATUSES)[number];

export const INTERVENTION_OUTCOME_IMPACTS = [
  'churn_prevented',
  'no_response',
  'upgraded',
  'unresolved',
] as const;
export type InterventionOutcomeImpact = (typeof INTERVENTION_OUTCOME_IMPACTS)[number];

export interface SwarmInterventionEventRow {
  id: string;
  customer_id: string;
  trigger_metric_id: string | null;
  swarm_node_id: string | null;
  intervention_type: SwarmInterventionType;
  status: SwarmInterventionStatus;
  payload_json: string;
  outcome_impact: InterventionOutcomeImpact | null;
  churn_risk_before: number;
  churn_risk_after: number | null;
  resolved_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface SwarmInterventionEvent {
  id: string;
  customerId: string;
  triggerMetricId: string | null;
  swarmNodeId: string | null;
  interventionType: SwarmInterventionType;
  status: SwarmInterventionStatus;
  payload: Record<string, unknown>;
  outcomeImpact: InterventionOutcomeImpact | null;
  churnRiskBefore: number;
  churnRiskAfter: number | null;
  resolvedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapRowToInterventionEvent(row: SwarmInterventionEventRow): SwarmInterventionEvent {
  return {
    id: row.id,
    customerId: row.customer_id,
    triggerMetricId: row.trigger_metric_id,
    swarmNodeId: row.swarm_node_id,
    interventionType: row.intervention_type,
    status: row.status,
    payload: safeParseJson<Record<string, unknown>>(row.payload_json, {}),
    outcomeImpact: row.outcome_impact,
    churnRiskBefore: row.churn_risk_before,
    churnRiskAfter: row.churn_risk_after,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
