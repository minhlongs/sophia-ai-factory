/**
 * Autonomous Swarm Edge Healing & Circuit Breaker Contracts
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/swarm-healing-types
 */

import type { SwarmRegion } from './swarm-node-types';

export {
  mapRowToHealingIncident,
  type InboundLeadPayload,
  type QualificationResult,
  type SwarmActionError,
} from './swarm-healing-mappers';

export const EDGE_HEALING_ACTIONS = [
  'circuit_breaker_trip',
  'route_reroute',
  'degraded_node_isolation',
  'daemon_restart',
  'capacity_shedding',
  'rate_limit_throttle',
] as const;
export type EdgeHealingAction = (typeof EDGE_HEALING_ACTIONS)[number];

export const HEALING_INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type HealingIncidentSeverity = (typeof HEALING_INCIDENT_SEVERITIES)[number];

export const HEALING_INCIDENT_STATUSES = [
  'investigating',
  'executed',
  'recovered',
  'failed',
  'escalated_to_ops',
] as const;
export type HealingIncidentStatus = (typeof HEALING_INCIDENT_STATUSES)[number];

export const CIRCUIT_BREAKER_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export type CircuitBreakerState = (typeof CIRCUIT_BREAKER_STATES)[number];

export interface EdgeHealingIncidentRow {
  id: string;
  incident_code: string;
  node_id: string;
  target_region: SwarmRegion;
  healing_action: EdgeHealingAction;
  trigger_reason: string;
  severity: HealingIncidentSeverity;
  previous_state: string;
  remediated_state: string;
  failover_target_node_id: string | null;
  execution_duration_ms: number;
  automated_recovery: number; // 0 | 1
  status: HealingIncidentStatus;
  metadata_json: string;
  detected_at: number;
  recovered_at: number | null;
  created_at: number;
}

export interface EdgeHealingIncident {
  id: string;
  incidentCode: string;
  nodeId: string;
  targetRegion: SwarmRegion;
  healingAction: EdgeHealingAction;
  triggerReason: string;
  severity: HealingIncidentSeverity;
  previousState: string;
  remediatedState: string;
  failoverTargetNodeId: string | null;
  executionDurationMs: number;
  automatedRecovery: boolean;
  status: HealingIncidentStatus;
  metadata: Record<string, unknown>;
  detectedAt: number;
  recoveredAt: number | null;
  createdAt: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownPeriodMs: number;
  probeSuccessThreshold: number;
}
