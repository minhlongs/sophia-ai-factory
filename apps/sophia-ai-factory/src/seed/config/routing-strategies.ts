/**
 * RouterStrategy domain — types, constants, and the strategy interface.
 *
 * Seed layer: pure data + types. No DB, no env, no BYOK. Concrete strategy
 * implementations live in forest/quota/routing-strategy.ts and consume these
 * primitives. Modeled on OmniRoute's routerStrategy pattern, simplified for
 * Sophia's video generation pipeline (5 task types, 4 providers).
 */

import { z } from 'zod';
import type { Tier } from '@/seed/types';

/** Kind of video production step a routing decision is made for. */
export const VIDEO_TASK_TYPES = ['scripting', 'tts', 'visual', 'compose', 'publish'] as const;
export type VideoTaskType = (typeof VIDEO_TASK_TYPES)[number];
export const VideoTaskTypeSchema = z.enum(VIDEO_TASK_TYPES);

/** AI providers the routing layer can dispatch to. */
export const VIDEO_PROVIDERS = ['openrouter', 'elevenlabs', 'd-id', 'heygen'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];
export const VideoProviderSchema = z.enum(VIDEO_PROVIDERS);

/** Registered routing strategies. */
export const STRATEGY_NAMES = ['priority', 'cost-optimized', 'least-used'] as const;
export type StrategyName = (typeof STRATEGY_NAMES)[number];
export const StrategyNameSchema = z.enum(STRATEGY_NAMES);

/** Default strategy when none is configured — matches current behavior. */
export const DEFAULT_STRATEGY: StrategyName = 'priority';

/** Per-tier default strategy when the user has not set a preference. */
export const TIER_DEFAULT_STRATEGY: Record<Tier, StrategyName> = {
  BASIC: 'priority',
  PREMIUM: 'cost-optimized',
  ENTERPRISE: 'least-used',
  MASTER: 'least-used',
};

/** Priority order per task type — first available provider wins under 'priority'. */
export const PROVIDER_PRIORITY: Record<VideoTaskType, readonly VideoProvider[]> = {
  scripting: ['openrouter'],
  tts: ['elevenlabs', 'openrouter'],
  visual: ['heygen', 'd-id'],
  compose: ['heygen', 'd-id'],
  publish: ['heygen', 'd-id'],
};

/**
 * Estimated USD cost per unit of work (per-1K-tokens for openrouter,
 * per-character for elevenlabs, per-second for video providers). Providers
 * not priced for a task are absent — the cost strategy treats them as
 * unserved and never picks them.
 */
export const PROVIDER_COST_PER_UNIT: Record<VideoProvider, Partial<Record<VideoTaskType, number>>> = {
  openrouter: { scripting: 0.002 },
  elevenlabs: { tts: 0.0003 },
  'd-id': { visual: 0.015, compose: 0.015 },
  heygen: { visual: 0.02, compose: 0.02 },
};

/** Default model to request per provider, matching the existing provider clients. */
export const PROVIDER_DEFAULT_MODEL: Record<VideoProvider, string> = {
  openrouter: 'openai/gpt-4o-mini',
  elevenlabs: 'elevenlabs-multilingual-v2',
  'd-id': 'd-id-studio',
  heygen: 'v2',
};

/** Env var used as the platform fallback when the user has no BYOK key. */
export const PROVIDER_ENV_FALLBACK: Record<VideoProvider, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
  'd-id': 'DID_API_KEY',
  heygen: 'HEYGEN_API_KEY',
};

/** A single provider under consideration for a routing decision. */
export const ProviderCandidateSchema = z.object({
  provider: VideoProviderSchema,
  model: z.string(),
  /** True when the user provided their own key (platform fallback otherwise). */
  hasUserKey: z.boolean(),
  costPerUnit: z.number(),
  healthScore: z.number().min(0).max(1),
  quotaRemaining: z.number().int().min(0),
  /** Job count for the current window — drives the least-used strategy. */
  usageCount: z.number().int().min(0),
  estimatedCost: z.number().min(0),
});
export type ProviderCandidate = z.infer<typeof ProviderCandidateSchema>;

/** Task-scoped inputs a strategy may use to rank providers. */
export const RoutingContextSchema = z.object({
  taskType: VideoTaskTypeSchema,
  estimatedInputTokens: z.number().int().min(0).optional(),
});
export type RoutingContext = z.infer<typeof RoutingContextSchema>;

/** Result of a routing decision — the provider/model a step should call. */
export const RoutingDecisionSchema = z.object({
  provider: VideoProviderSchema,
  model: z.string(),
  strategy: StrategyNameSchema,
  reason: z.string(),
  candidatesConsidered: z.number().int().min(0),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

/**
 * A strategy ranks an already-built provider pool and returns one decision.
 * Strategies stay pure and synchronous: async work (BYOK key resolution,
 * quota checks) happens in buildProviderPool before select() is called.
 */
export interface RouterStrategy {
  readonly name: StrategyName;
  readonly description: string;
  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision;
}
