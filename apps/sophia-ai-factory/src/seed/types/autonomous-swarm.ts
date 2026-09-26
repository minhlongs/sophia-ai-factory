/**
 * Pure Domain Contracts, Interfaces and Row Mappers: Autonomous Swarm & Retention Flywheel
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * Covers:
 * - Edge Swarm Nodes & Regional Topology
 * - Real-Time Customer Health & 4-Factor Churn Scoring
 * - Autonomous Churn Intervention Events
 * - Edge Self-Healing Incidents & 3-State Circuit Breaker
 * - Zero :any rule strictly enforced
 *
 * @module seed/types/autonomous-swarm
 */

// ── Swarm Node Contracts ───────────────────────────────────────────────────

export const SWARM_REGIONS = ['apac', 'us', 'eu', 'global'] as const;
export type SwarmRegion = (typeof SWARM_REGIONS)[number];

export const SWARM_NODE_ROLES = [
  'sales_qualifier',
  'retention_flywheel',
  'edge_healer',
  'coordinator',
  'general_worker',
] as const;
export type SwarmNodeRole = (typeof SWARM_NODE_ROLES)[number];

export const SWARM_NODE_STATUSES = [
  'active',
  'degraded',
  'isolated',
  'draining',
  'offline',
] as const;
export type SwarmNodeStatus = (typeof SWARM_NODE_STATUSES)[number];

export interface AutonomousSwarmNodeRow {
  id: string;
  node_name: string;
  region: SwarmRegion;
  role: SwarmNodeRole;
  status: SwarmNodeStatus;
  endpoint_url: string | null;
  last_heartbeat_at: number;
  cpu_load_pct: number;
  memory_load_pct: number;
  active_tasks: number;
  max_concurrency: number;
  is_healthy: number; // 0 | 1
  capabilities_json: string;
  metadata_json: string;
  registered_at: number;
  updated_at: number;
}

export interface SwarmNode {
  id: string;
  nodeName: string;
  region: SwarmRegion;
  role: SwarmNodeRole;
  status: SwarmNodeStatus;
  endpointUrl: string | null;
  lastHeartbeatAt: number;
  cpuLoadPct: number;
  memoryLoadPct: number;
  activeTasks: number;
  maxConcurrency: number;
  isHealthy: boolean;
  capabilities: string[];
  metadata: Record<string, unknown>;
  registeredAt: number;
  updatedAt: number;
}

export interface RegisterSwarmNodeInput {
  id?: string;
  nodeName: string;
  region: SwarmRegion;
  role: SwarmNodeRole;
  endpointUrl?: string | null;
  maxConcurrency?: number;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface HeartbeatTelemetryInput {
  nodeId: string;
  cpuLoadPct: number;
  memoryLoadPct: number;
  activeTasks: number;
  isHealthy?: boolean;
}

export interface SwarmClusterTopology {
  totalNodes: number;
  activeNodesCount: number;
  degradedNodesCount: number;
  isolatedNodesCount: number;
  coordinatorNodeId: string | null;
  regionalDistribution: Record<SwarmRegion, number>;
  nodes: SwarmNode[];
}

export interface SwarmTaskRequest {
  taskId?: string;
  taskType: 'lead_qualification' | 'retention_sweep' | 'health_telemetry_probe' | 'edge_healing_action';
  payload: Record<string, unknown>;
  preferredRegion?: SwarmRegion;
  requiredRole: SwarmNodeRole;
}

export interface SwarmTaskAssignment {
  taskId: string;
  assignedNodeId: string;
  endpointUrl: string | null;
  assignedAt: number;
  status: 'dispatched' | 'rejected_overload' | 'no_healthy_nodes';
}

// ── Customer Health & Churn Retention Contracts ──────────────────────────

export const HEALTH_TIERS = ['green', 'yellow', 'red', 'critical'] as const;
export type HealthTier = (typeof HEALTH_TIERS)[number];

export const TREND_DIRECTIONS = ['improving', 'stable', 'declining', 'rapid_drop'] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

export interface CustomerHealthMetricRow {
  id: string;
  customer_id: string;
  org_id: string | null;
  period_start: number;
  period_end: number;
  active_agents_count: number;
  video_generation_count: number;
  api_request_count: number;
  api_error_count: number;
  api_error_rate: number;
  login_frequency_7d: number;
  mcu_consumption_rate: number;
  nps_score: number | null;
  churn_risk_score: number;
  health_tier: HealthTier;
  trend_direction: TrendDirection;
  risk_factors_json: string;
  last_activity_at: number | null;
  evaluated_at: number;
  created_at: number;
}

export interface CustomerHealthMetric {
  id: string;
  customerId: string;
  orgId: string | null;
  periodStart: number;
  periodEnd: number;
  activeAgentsCount: number;
  videoGenerationCount: number;
  apiRequestCount: number;
  apiErrorCount: number;
  apiErrorRate: number;
  loginFrequency7d: number;
  mcuConsumptionRate: number;
  npsScore: number | null;
  churnRiskScore: number;
  healthTier: HealthTier;
  trendDirection: TrendDirection;
  riskFactors: string[];
  lastActivityAt: number | null;
  evaluatedAt: number;
  createdAt: number;
}

export interface CustomerHealthTelemetryInput {
  customerId: string;
  orgId?: string | null;
  activeAgentsCount: number;
  videoGenerationCount: number;
  apiRequestCount: number;
  apiErrorCount: number;
  loginFrequency7d: number;
  mcuConsumptionRate: number;
  lastActivityAt?: number | null;
  npsScore?: number | null;
  previousChurnRiskScore?: number | null;
}

// ── Swarm Interventions Contracts ──────────────────────────────────────────

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

// ── Edge Healing Incidents & Circuit Breaker Contracts ───────────────────

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
  failureThreshold: number; // e.g. 3 consecutive failures or 15% error rate
  cooldownPeriodMs: number; // e.g. 30,000ms before HALF_OPEN
  probeSuccessThreshold: number; // e.g. 1 probe success to close
}

// ── Inbound Lead & BANT Qualification Contracts ──────────────────────────

export interface InboundLeadPayload {
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  leadTitle?: string;
  companyName: string;
  companyDomain: string;
  leadSource?: string;
  dealValueEstimateCents?: number;
  requestedMcuMonthly?: number;
  timeframe?: string;
  notes?: string;
}

export interface QualificationResult {
  dealId: string;
  bantScore: number; // 0 to 100
  pipelineTier: 'hot' | 'warm' | 'cold';
  dealStage: string;
  assignedAgentRole: string;
  proposalContent?: string;
  meetingPrepBrief?: string;
  autoQualified: boolean;
  scoringFactors: {
    budgetScore: number;
    authorityScore: number;
    needScore: number;
    timelineScore: number;
  };
}

export interface SwarmActionError {
  code: string;
  message: string;
}

// ── Row Mappers ──────────────────────────────────────────────────────────

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function mapRowToSwarmNode(row: AutonomousSwarmNodeRow): SwarmNode {
  return {
    id: row.id,
    nodeName: row.node_name,
    region: row.region,
    role: row.role,
    status: row.status,
    endpointUrl: row.endpoint_url,
    lastHeartbeatAt: row.last_heartbeat_at,
    cpuLoadPct: row.cpu_load_pct,
    memoryLoadPct: row.memory_load_pct,
    activeTasks: row.active_tasks,
    maxConcurrency: row.max_concurrency,
    isHealthy: row.is_healthy === 1,
    capabilities: safeParseJson<string[]>(row.capabilities_json, []),
    metadata: safeParseJson<Record<string, unknown>>(row.metadata_json, {}),
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToCustomerHealthMetric(row: CustomerHealthMetricRow): CustomerHealthMetric {
  return {
    id: row.id,
    customerId: row.customer_id,
    orgId: row.org_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    activeAgentsCount: row.active_agents_count,
    videoGenerationCount: row.video_generation_count,
    apiRequestCount: row.api_request_count,
    apiErrorCount: row.api_error_count,
    apiErrorRate: row.api_error_rate,
    loginFrequency7d: row.login_frequency_7d,
    mcuConsumptionRate: row.mcu_consumption_rate,
    npsScore: row.nps_score,
    churnRiskScore: row.churn_risk_score,
    healthTier: row.health_tier,
    trendDirection: row.trend_direction,
    riskFactors: safeParseJson<string[]>(row.risk_factors_json, []),
    lastActivityAt: row.last_activity_at,
    evaluatedAt: row.evaluated_at,
    createdAt: row.created_at,
  };
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

export function mapRowToHealingIncident(row: EdgeHealingIncidentRow): EdgeHealingIncident {
  return {
    id: row.id,
    incidentCode: row.incident_code,
    nodeId: row.node_id,
    targetRegion: row.target_region,
    healingAction: row.healing_action,
    triggerReason: row.trigger_reason,
    severity: row.severity,
    previousState: row.previous_state,
    remediatedState: row.remediated_state,
    failoverTargetNodeId: row.failover_target_node_id,
    executionDurationMs: row.execution_duration_ms,
    automatedRecovery: row.automated_recovery === 1,
    status: row.status,
    metadata: safeParseJson<Record<string, unknown>>(row.metadata_json, {}),
    detectedAt: row.detected_at,
    recoveredAt: row.recovered_at,
    createdAt: row.created_at,
  };
}
