/**
 * Agent Governance YAML (AGY) Schema & Engine Types
 *
 * Seed Layer: Core type definitions, interfaces, and contracts for declarative
 * agent governance, autonomy gatekeeping (L0-L4), compute quota enforcement,
 * permission matching, and immutable evaluation audit ledgers.
 *
 * @module seed/types/agent-governance
 */

export type {
  PolicyEvaluationRequest,
  PolicyEvaluationVerdict,
  AuditLedgerRecord,
  FleetGovernanceYaml,
} from './agent-governance-evaluation-types';

/**
 * Autonomy Level hierarchy:
 * - L0: Manual (Zero autonomy; human must approve all actions)
 * - L1: Assisted (Read/draft only; mutations require confirmation)
 * - L2: Semi-Autonomous (Routine tasks automated; sensitive actions guarded)
 * - L3: Autonomous (Full execution within bounds; auto-escalates on thresholds)
 * - L4: Sovereign (Supervisor authority up to hard tenant quota)
 */
export type AutonomyLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

/**
 * Action taken when escalation is triggered.
 */
export type EscalationAction =
  | 'halt'
  | 'request_approval'
  | 'escalate_human'
  | 'degrade_gracefully';

/**
 * Escalation policy configuration.
 */
export interface EscalationPolicy {
  onQuotaExceeded: 'halt' | 'request_approval';
  onDisallowedAction: 'halt' | 'escalate_human';
}

/**
 * Agent specification inside AGY document.
 */
export interface AgentSpec {
  id: string;
  name: string;
  role: string;
  maxAutonomyLevel: AutonomyLevel;
}

/**
 * Compute limits allocated to the agent.
 */
export interface ComputeLimits {
  maxTokensPerRun: number;
  maxComputeUnitsMcu: number;
}

/**
 * Permission rule set with allow/deny glob patterns.
 * Invariant: Deny rules ALWAYS take precedence over allow rules.
 */
export interface PermissionRules {
  allow: string[];
  deny: string[];
}

/**
 * Complete declarative Agent Governance YAML (AGY) document structure.
 */
export interface AgentGovernanceYaml {
  schemaVersion: string;
  agent: AgentSpec;
  compute: ComputeLimits;
  permissions: PermissionRules;
  escalation: EscalationPolicy;
}
