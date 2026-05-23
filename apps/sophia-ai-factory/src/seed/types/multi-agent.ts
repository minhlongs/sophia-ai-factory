/**
 * Multi-Agent Execution Schema types.
 * Defines roles, statuses, and data shapes for supervisor + worker agent coordination.
 *
 * Layer: seed (foundational — no business logic, no side effects)
 */

/**
 * Functional roles an agent can take in an execution session.
 * - supervisor: orchestrates the session, dispatches workers
 * - script_writer: generates content scripts
 * - voice_generator: produces audio/voice-over assets
 * - video_producer: assembles video from assets
 * - publisher: distributes finished content to platforms
 * - analyst: evaluates results and surfaces insights
 */
export type AgentRole =
  | 'supervisor'
  | 'script_writer'
  | 'voice_generator'
  | 'video_producer'
  | 'publisher'
  | 'analyst'

/**
 * Lifecycle state of a session or individual task assignment.
 */
export type AgentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Top-level record grouping all agent task assignments for one SOP execution.
 */
export interface AgentSession {
  id: string
  executionId: string
  supervisorAgent: string
  status: AgentStatus
  workerCount: number
  completedCount: number
  failedCount: number
  /** Arbitrary JSON config forwarded to workers (e.g., model IDs, feature flags) */
  config?: Record<string, unknown>
  /** Unix epoch seconds — set when session transitions to 'running' */
  startedAt?: number
  /** Unix epoch seconds — set when all workers are settled */
  completedAt?: number
  createdAt: number
}

/**
 * Individual task handed to one worker agent within a session.
 */
export interface AgentTaskAssignment {
  id: string
  sessionId: string
  agentRole: AgentRole
  /** Ordinal position within the session's SOP step list */
  stepIndex: number
  status: AgentStatus
  /** Structured input forwarded to the agent at dispatch time */
  input?: Record<string, unknown>
  /** Structured output produced by the agent on success */
  output?: Record<string, unknown>
  /** Human-readable error description on failure */
  errorMessage?: string
  startedAt?: number
  completedAt?: number
  createdAt: number
}

/**
 * Summary view returned alongside an AgentSession to avoid a second query.
 */
export interface AgentSessionWithTasks extends AgentSession {
  tasks: AgentTaskAssignment[]
}
