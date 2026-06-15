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
  /** JSON-serialized checkpoint state for resume-from-failure */
  checkpointJson?: Record<string, unknown>
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

// ---------------------------------------------------------------------------
// Typed Prompt Contracts — Phase 03
// ---------------------------------------------------------------------------

/** Base fields common to all agent prompt contracts */
export interface PromptContractBase {
  objective: string
  outputFormat: 'json' | 'markdown' | 'text' | 'structured'
  maxTokens?: number
  escalationRules?: string[]
}

/** script_writer: generates content scripts */
export interface ScriptWriterContract extends PromptContractBase {
  topic: string
  tone: 'professional' | 'casual' | 'educational' | 'entertaining'
  targetLength: 'short' | 'medium' | 'long'
}

/** voice_generator: produces audio/voice-over assets */
export interface VoiceGeneratorContract extends PromptContractBase {
  voiceId: string
  language: string
  scriptText: string
}

/** video_producer: assembles video from assets */
export interface VideoProducerContract extends PromptContractBase {
  audioUrl: string
  visualStyle: string
  duration?: number
}

/** publisher: distributes finished content to platforms */
export interface PublisherContract extends PromptContractBase {
  platforms: string[]
  scheduledAt?: string
  metadata?: Record<string, unknown>
}

/** analyst: evaluates results and surfaces insights */
export interface AnalystContract extends PromptContractBase {
  metrics: string[]
  timeRange: { start: string; end: string }
  compareWith?: string
}

/** supervisor: orchestrates the session, dispatches workers */
export interface SupervisorContract extends PromptContractBase {
  pipeline: AgentRole[]
  config?: Record<string, unknown>
}

/** Union of all typed prompt contracts */
export type PromptContract =
  | ScriptWriterContract
  | VoiceGeneratorContract
  | VideoProducerContract
  | PublisherContract
  | AnalystContract
  | SupervisorContract

// ---------------------------------------------------------------------------
// Bounded Iteration Guards — Phase 04
// ---------------------------------------------------------------------------

export interface IterationLimits {
  maxRetriesPerSubtask: number
  maxTotalIterations: number
}

export const DEFAULT_ITERATION_LIMITS: IterationLimits = {
  maxRetriesPerSubtask: 5,
  maxTotalIterations: 20,
}

export interface IterationBudgetCheck {
  canProceed: boolean
  remaining: number
  reason?: string
}

// ---------------------------------------------------------------------------
// Solo Company Orchestrator types — defined in solo-company-types.ts
// ---------------------------------------------------------------------------
export type {
  SoloCompanyRole,
  UnifiedAgentRole,
  AgentThought,
  SoloCompanyConfig,
  FeedbackSignal,
} from './solo-company-types'
export { DEFAULT_SOLO_COMPANY_CONFIG } from './solo-company-types'
