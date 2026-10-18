/**
 * Model routing, provider adapter, and mission orchestrator contracts.
 *
 * @module seed/types/creative-economy/interfaces-agents-routing
 */

import type {
  AIProvider,
  ModelInfo,
  ModelPolicy,
  ModelRequest,
  ModelResponse,
  Mission,
  CreativeMissionStatus,
} from '@/seed/types/creative-domain'
import type { Result } from '@/seed/types/result'
import type { MissionId } from './ids'

// ─── IModelRouter ────────────────────────────────────────────────────────────

export interface RouteRequest {
  capability: string
  policy: ModelPolicy
  prompt: string
  images?: string[]
  parameters: Record<string, unknown>
  workspaceId: string
}

export interface IModelRouter {
  /** Select the best provider+model for a request. */
  route(request: RouteRequest): Promise<Result<{ provider: AIProvider; model: ModelInfo }, Error>>
  /** Execute a routed request and return the response. */
  complete(request: RouteRequest): Promise<Result<ModelResponse, Error>>
  /** List all known providers. */
  providers(): Promise<Result<AIProvider[], Error>>
  /** Health-check a provider (probe a trivial completion). */
  health(providerId: string): Promise<Result<boolean, Error>>
}

// ─── IProviderAdapter ────────────────────────────────────────────────────────

export interface IProviderAdapter {
  readonly providerId: string
  /** List models exposed by this provider. */
  models(): Promise<Result<ModelInfo[], Error>>
  /** Execute a completion against this provider directly. */
  complete(request: ModelRequest): Promise<Result<ModelResponse, Error>>
  /** Validate that the provider's credentials are usable. */
  validate(): Promise<Result<boolean, Error>>
}

// ─── IMissionOrchestrator ───────────────────────────────────────────────────

export interface MissionTransition {
  from: CreativeMissionStatus
  to: CreativeMissionStatus
  actorId: string
  reason?: string
  at?: number
}

export interface IMissionOrchestrator {
  create(mission: Omit<Mission, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currentPhase' | 'spentCents'>): Promise<Result<MissionId, Error>>
  get(id: MissionId): Promise<Result<Mission, Error>>
  list(workspaceId: string, status?: CreativeMissionStatus): Promise<Result<Mission[], Error>>
  /** Transition the mission through the canonical state machine. */
  transition(id: MissionId, to: CreativeMissionStatus, actorId: string, reason?: string): Promise<Result<Mission, Error>>
  /** Allowed next states from the current state. */
  allowedTransitions(id: MissionId): Promise<Result<CreativeMissionStatus[], Error>>
  /** Pause a running mission (canonical has a `paused` state). */
  pause(id: MissionId, actorId: string, reason?: string): Promise<Result<Mission, Error>>
  /** Resume a paused mission back to `running`. */
  resume(id: MissionId, actorId: string, reason?: string): Promise<Result<Mission, Error>>
  /** Record a state transition as a provenance + event side effect. */
  recordTransition(transition: MissionTransition): Promise<Result<boolean, Error>>
}
