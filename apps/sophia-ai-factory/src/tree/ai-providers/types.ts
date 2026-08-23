// DEPRECATED: tracked in DEPRECATION_REGISTRY (seed/types/deprecation-markers.ts, target 'tree/ai-providers') — removal eligible after 2026-09-06.
/**
 * Core types for the AI Provider abstraction layer.
 *
 * Defines the provider registry schema, request/response contracts,
 * and ID generation utilities used across all AI provider modules.
 *
 * @module tree/ai-providers/types
 */

import { CircuitState } from '@/seed/types/failure-kind'

// ── Provider Model Types ──────────────────────────────────────────────────────

export type AIModelType = 'text' | 'image' | 'video' | 'audio'

export type ProviderStatus = 'active' | 'inactive' | 'error'

export interface AIModel {
  readonly id: string
  readonly name: string
  readonly type: AIModelType
  /** Estimated cost per 1K tokens (text) or per generation (image/video/audio) in cents */
  readonly costPerUnit: number
}

export interface AIProvider {
  readonly id: string
  readonly workspaceId: string
  readonly name: string
  readonly type: AIModelType
  readonly models: readonly AIModel[]
  readonly status: ProviderStatus
  readonly circuitBreakerState: CircuitState
}

// ── Request / Response ────────────────────────────────────────────────────────

export interface AIRequest {
  readonly providerId: string
  readonly model: string
  readonly prompt: string
  readonly params?: Record<string, unknown>
  /** Hard budget cap in cents — caller refuses to pay more */
  readonly budgetCents: number
}

export interface AIResponse {
  readonly requestId: string
  readonly providerId: string
  readonly output: string
  readonly modelUsed: string
  readonly tokensIn: number
  readonly tokensOut: number
  readonly costCents: number
  readonly latencyMs: number
}

// ── Usage Tracking ────────────────────────────────────────────────────────────

export interface UsageRecord {
  readonly requestId: string
  readonly providerId: string
  readonly workspaceId: string
  readonly model: string
  readonly tokensIn: number
  readonly tokensOut: number
  readonly costCents: number
  readonly latencyMs: number
  readonly createdAt: number
}

export interface DateRange {
  readonly from: number
  readonly to: number
}

export interface UsageSummary {
  readonly providerId: string
  readonly totalRequests: number
  readonly totalTokensIn: number
  readonly totalTokensOut: number
  readonly totalCostCents: number
  readonly avgLatencyMs: number
}

// ── D1 Row Mapping ────────────────────────────────────────────────────────────

/** Raw D1 row shape (snake_case columns) */
export interface ProviderRow {
  id: string
  workspace_id: string
  name: string
  type: string
  models_json: string
  status: string
}

/** Raw D1 usage row */
export interface UsageRow {
  request_id: string
  provider_id: string
  workspace_id: string
  model: string
  tokens_in: number
  tokens_out: number
  cost_cents: number
  latency_ms: number
  created_at: number
}

// ── ID Generation ─────────────────────────────────────────────────────────────

let providerSeq = 0
let requestSeq = 0
let baseTs = Date.now()

/**
 * Generate a provider ID — `prv_<timestamp>_<seq>`.
 * Resets sequence when timestamp advances to avoid collisions.
 */
export function newProviderId(): string {
  const now = Date.now()
  if (now !== baseTs) {
    baseTs = now
    providerSeq = 0
  }
  providerSeq++
  return `prv_${now}_${providerSeq}`
}

/**
 * Generate a request ID — `req_<timestamp>_<seq>`.
 * Resets sequence when timestamp advances to avoid collisions.
 */
export function newAIRequestId(): string {
  const now = Date.now()
  if (now !== baseTs) {
    baseTs = now
    requestSeq = 0
  }
  requestSeq++
  return `req_${now}_${requestSeq}`
}
