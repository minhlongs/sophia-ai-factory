/**
 * Multi-Agent Execution Schema types.
 * Defines roles, statuses, and data shapes for supervisor + worker agent coordination.
 */

/** Functional roles an agent can take in an execution session */
export type SOPAgentRole =
  | 'supervisor'
  | 'script_writer'
  | 'voice_generator'
  | 'video_producer'
  | 'publisher'
  | 'analyst';

/** Lifecycle state of a session or individual task assignment */
export type AgentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Top-level record grouping all agent task assignments for one SOP execution */
export interface AgentSession {
  id: string;
  executionId: string;
  supervisorAgent: string;
  status: AgentStatus;
  workerCount: number;
  completedCount: number;
  failedCount: number;
  config?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

/** Individual task handed to one worker agent within a session */
export interface AgentTaskAssignment {
  id: string;
  sessionId: string;
  agentRole: SOPAgentRole;
  stepIndex: number;
  status: AgentStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
  checkpointJson?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

/** Summary view returned alongside an AgentSession to avoid a second query */
export interface AgentSessionWithTasks extends AgentSession {
  tasks: AgentTaskAssignment[];
}
