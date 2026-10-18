/**
 * Agent Governance Policy Evaluation & Audit Ledger Types
 *
 * @module seed/types/agent-governance-evaluation-types
 */

import type {
  AutonomyLevel,
  EscalationPolicy,
  PermissionRules,
} from './agent-governance';

/**
 * Inbound request to evaluate an action against an agent's governance policy.
 */
export interface PolicyEvaluationRequest {
  agencyId: string;
  agentId: string;
  action: string;
  requestedAutonomy: AutonomyLevel;
  requestedComputeUnits: number;
  metadata?: Record<string, unknown>;
}

/**
 * Outcome verdict resulting from policy evaluation.
 */
export interface PolicyEvaluationVerdict {
  allowed: boolean;
  reason: string;
  requiredAutonomy: AutonomyLevel;
  escalationTriggered: boolean;
  evaluationSha256: string;
}

/**
 * Stored audit record in agy_policy_audit_ledger table.
 */
export interface AuditLedgerRecord {
  id: string;
  agencyId: string;
  agentId: string;
  action: string;
  requestedAutonomy: AutonomyLevel;
  maxAutonomy?: AutonomyLevel | null;
  requiredAutonomy?: AutonomyLevel | null;
  requestedCompute: number;
  requestedComputeUnits?: number;
  allowed: boolean;
  reason: string;
  escalationTriggered: boolean;
  evaluationSha256: string;
  metadataJson?: string;
  createdAt: number;
}

/**
 * Multi-agent AGY document variant (supporting fleet documents).
 */
export interface FleetGovernanceYaml {
  version: string;
  agencyId: string;
  name: string;
  description?: string;
  agents: Record<string, {
    role: string;
    autonomyLevel: AutonomyLevel;
    capabilities?: string[];
    permissions: PermissionRules;
    costLimits: {
      maxMcuPerRun: number;
      maxMcuDaily?: number;
      maxTokensPerCall?: number;
      maxTotalTokens?: number;
      maxExecutionTimeSeconds?: number;
    };
    escalationPolicy: EscalationPolicy;
  }>;
}
