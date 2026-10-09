/**
 * Agent Run & Approval Types
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/mission/agent-repo/types
 */

export interface AgentRunRecord {
  id: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_approval';
  phase: 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  errorMessage?: string;
  autonomyLevel: number;
  totalCostCents: number;
  totalTokens: number;
  retryCount: number;
  parentRunId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentLogEntry {
  id: string;
  runId: string;
  phase: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface CreateAgentRunInput {
  id: string;
  agentId: string;
  workspaceId: string;
  missionId?: string;
  autonomyLevel: number;
  inputJson?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentRunInput {
  status?: AgentRunRecord['status'];
  phase?: AgentRunRecord['phase'];
  outputJson?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  errorMessage?: string;
  totalCostCents?: number;
  totalTokens?: number;
  retryCount?: number;
  startedAt?: number;
  endedAt?: number;
}

export interface CreateApprovalInput {
  id: string;
  agentRunId: string;
  actionId: string;
  actionType: string;
  actionSummary: string;
  estimatedCostCents?: number;
  timeoutAt?: number;
}

export interface PendingApprovalRecord {
  id: string;
  agentRunId: string;
  actionId: string;
  actionType: string;
  actionSummary: string;
  estimatedCostCents: number | null;
  status: string;
  createdAt: number;
  timeoutAt: number;
  agentId: string;
  missionId: string | null;
}

export interface ExpiredApproval {
  id: string;
  agentRunId: string;
}
