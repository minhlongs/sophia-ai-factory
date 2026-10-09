/**
 * @file agent-runtime.ts
 * @description Agent permissions, definitions, context, actions, results, and runtime runs.
 * @layer seed
 */

import type { AutonomyLevel } from './autonomy';
import type { CreativeIdentity } from './identity';
import type { CreativeMemory } from './memory-goals';
import type { ModelPolicy } from './ai-provider';

export interface AgentPermission {
  tool: string;
  scopes: string[];
  requiresApproval: boolean;
  maxCostCents?: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  permissions: AgentPermission[];
  defaultAutonomy: AutonomyLevel;
  maxRetries: number;
  timeoutMs: number;
  modelPolicy?: ModelPolicy;
}

export interface AgentContext {
  workspaceId: string;
  missionId?: string;
  projectId?: string;
  creativeIdentity?: CreativeIdentity;
  memory: CreativeMemory[];
  autonomyLevel: AutonomyLevel;
  budgetRemainingCents: number;
  correlationId: string;
  /** Action ids the human has explicitly approved for this run. */
  approvedActionIds?: string[];
  /**
   * Resolved per-mission-type autonomy policy. When undefined the executor
   * falls back to the legacy workspace-level autonomy gate (unchanged behavior).
   */
  effectivePolicy?: {
    /** Operator-facing tier: L0 manual · L1 assisted · L2 supervised · L3 full auto. */
    tier: 0 | 1 | 2 | 3;
    /** Canonical stored autonomy level (0-4) enforced by the executor gate. */
    storedLevel: AutonomyLevel;
    /** Whether the given action/tool requires human approval before execution. */
    requiresApproval: (actionType: string) => boolean;
    /** Per-run budget cap in cents; null = uncapped. */
    budgetCapCents: number | null;
    maxAutoRetries: number;
  };
}

export interface AgentDecision {
  type: string;
  reasoning: string;
  confidence: number;
  alternatives?: Array<{ description: string; score: number }>;
  requiresHumanApproval: boolean;
}

export interface AgentAction {
  type: string;
  tool: string;
  parameters: Record<string, unknown>;
  estimatedCostCents?: number;
  approvalRequired: boolean;
}

export interface AgentResult {
  success: boolean;
  output?: unknown;
  error?: { code: string; message: string };
  artifacts: string[]; // asset IDs created
  costCents: number;
  durationMs: number;
  provenanceRecordId?: string;
}

export interface AgentApproval {
  id: string;
  agentRunId: string;
  action: AgentAction;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string;
  reviewComment?: string;
  reviewedAt?: number;
}

export interface AgentRun {
  id: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  parentRunId?: string;
  input: Record<string, unknown>;
  decision?: AgentDecision;
  actions: AgentAction[];
  result?: AgentResult;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval';
  autonomyLevel: AutonomyLevel;
  startedAt?: number;
  finishedAt?: number;
  error?: { code: string; message: string };
}
