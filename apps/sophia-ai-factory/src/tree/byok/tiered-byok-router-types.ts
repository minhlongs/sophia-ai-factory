/**
 * Contracts and pricing baselines for the Tiered BYOK Model Router.
 *
 * Routes structured JSON extraction and QA validation tasks to compact models
 * while reserving frontier models (with prompt-caching hints) for creative
 * scriptwriting and multi-step tool agents.
 *
 * @module tree/byok/tiered-byok-router-types
 */

import type { KeyBudgetState, KeyCapability } from './validation-receipt-types';

/** Task complexity classification used to choose compact vs frontier routing. */
export type ByokTaskComplexity =
  | 'json_extraction'
  | 'qa_validation'
  | 'creative_script'
  | 'tool_agent';

/** Resulting tier after evaluating feature flag and 3-layer resilience state. */
export type ByokTierUsed = 'compact' | 'frontier' | 'direct_fallback';

/** Ephemeral prompt-caching hint attached to cacheable frontier system prompts. */
export type PromptCacheHint = 'ephemeral';

export type RouteSelectionReason =
  | 'router_disabled'
  | 'circuit_breaker_open'
  | 'key_cooldown_active'
  | 'primary_selected'
  | 'primary_locked_out_fallback'
  | 'all_candidates_locked_out';

export const COMPACT_PRIMARY_MODEL = 'openai/gpt-4o-mini';
export const COMPACT_FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';
export const FRONTIER_PRIMARY_MODEL = 'anthropic/claude-sonnet-4.5';
export const FRONTIER_FALLBACK_MODEL = 'openai/gpt-4o';

/** Default cooldown applied to an individual throttled or failing model. */
export const DEFAULT_MODEL_LOCKOUT_MS = 60_000;

/**
 * Blended USD cost per 1M tokens (weighted input + output) on OpenRouter,
 * used to compute estimated cost savings vs a single frontier baseline.
 */
export const BLENDED_COST_PER_1M_USD: Readonly<Record<string, number>> = {
  [FRONTIER_PRIMARY_MODEL]: 6.0,
  [FRONTIER_FALLBACK_MODEL]: 3.75,
  [COMPACT_PRIMARY_MODEL]: 0.3,
  [COMPACT_FALLBACK_MODEL]: 0.18,
};

export interface SelectTieredByokRouteInput {
  readonly taskKind: ByokTaskComplexity;
  /** Caller-requested baseline model (used for frontier or rollback fallback). */
  readonly baselineModel?: string;
  /** Upstream provider key for circuit breaker state (defaults to 'openrouter'). */
  readonly provider?: string;
  /** Tenant or key identifier scoping circuit breaker and model lockouts. */
  readonly keyRef?: string;
  /** Optional key budget state inspected for active connection cooldown. */
  readonly budget?: KeyBudgetState;
  /** Whether the system prompt qualifies for ephemeral prompt caching. */
  readonly systemPromptCacheable?: boolean;
  /** Current unix timestamp in seconds (defaults to current wall clock). */
  readonly nowUnix?: number;
  /** Current epoch timestamp in milliseconds (defaults to current wall clock). */
  readonly nowMs?: number;
  /** Optional override for `process.env.ENABLE_TIERED_BYOK_ROUTER`. */
  readonly envFlag?: string;
}

export interface TieredByokRouteSelection {
  readonly model: string;
  readonly fallbackModel: string | null;
  readonly tierUsed: ByokTierUsed;
  readonly reason: RouteSelectionReason;
  /** False when circuit breaker, key cooldown, or dual lockout blocks execution. */
  readonly resilientAllowed: boolean;
  /** Estimated percentage token cost reduction vs single frontier model (0-99). */
  readonly estimatedSavingsPct: number;
  readonly cacheControl?: PromptCacheHint;
}

export type ToolChoiceValue =
  | string
  | { readonly type: string; readonly function?: { readonly name: string } };

export interface SanitizeToolChoiceInput<TTool> {
  readonly tools?: readonly TTool[];
  readonly toolChoice?: ToolChoiceValue;
  readonly capabilities: readonly KeyCapability[];
  /** When true, strips tools/tool_choice instead of refusing unsupported keys. */
  readonly allowToolStrip?: boolean;
}

export interface SanitizedToolPayload<TTool> {
  readonly tools: readonly TTool[] | undefined;
  readonly toolChoice: ToolChoiceValue | undefined;
  readonly stripped: boolean;
}

export interface ToolChoiceRefusalError {
  readonly code: 'TOOL_CALL_UNSUPPORTED';
  readonly message: string;
  readonly message_vi: string;
}
