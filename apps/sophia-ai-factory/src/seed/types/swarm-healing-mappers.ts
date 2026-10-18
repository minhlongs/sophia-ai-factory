/**
 * Autonomous Swarm Edge Healing Row Mappers & Lead Qualification Contracts
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 *
 * @module seed/types/swarm-healing-mappers
 */

import type { EdgeHealingIncident, EdgeHealingIncidentRow } from './swarm-healing-types';

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
  bantScore: number;
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

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
