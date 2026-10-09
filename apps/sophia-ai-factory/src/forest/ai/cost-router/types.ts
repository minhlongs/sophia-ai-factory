/**
 * Types and Configuration for Cost-Aware Router
 *
 * @module forest/ai/cost-router/types
 */

import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
} from '@/seed/ai/provider-interface';
import type { ProviderRegistry } from '@/seed/ai/provider-registry';
import type { Complexity } from '../llm-router';
import type { MultiProviderRouter } from '../multi-provider-router';
import type { BudgetMode } from '@/tree/budget';

/** User tier for cost limit enforcement. */
export type UserTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

/** Cost limits per user tier (USD per request). */
export const TIER_COST_LIMITS: Record<UserTier, number> = {
  BASIC: 0.05,
  PREMIUM: 0.50,
  ENTERPRISE: 2.00,
  MASTER: 10.00,
};

/** Options for cost-aware routing. */
export interface CostAwareRouterOptions {
  /** The underlying multi-provider router. */
  router: MultiProviderRouter;
  /** The provider registry for health + cost lookups. */
  registry: ProviderRegistry;
  /** User tier for cost limit enforcement. */
  userTier?: UserTier;
  /** Whether to enforce cost limits (skip expensive providers). */
  enforceCostLimits?: boolean;
  /** Whether to prefer cheaper providers when quality is equivalent. */
  preferCheaper?: boolean;
  /** Maximum cost ratio compared to the cheapest available option. */
  maxCostRatio?: number;
  /** Tenant ID for budget tracking (enables budget governance when provided). */
  tenantId?: string;
  /** Total budget ceiling in USD (requires tenantId). */
  budgetTotalUsd?: number;
  /** Budget mode: WARN | CAP | OBSERVE (requires tenantId). */
  budgetMode?: BudgetMode;
  /** Fraction of budget held back as reserve buffer (default 0.10). */
  budgetReservePct?: number;
}

/** Result of cost-aware routing decision. */
export interface CostAwareRouteDecision {
  /** Selected provider id. */
  providerId: ProviderId;
  /** Model to use. */
  model: string;
  /** Complexity classification. */
  complexity: Complexity;
  /** Whether a cheaper-than-preferred provider was selected. */
  usedCheaperAlternative: boolean;
  /** Estimated cost in USD. */
  estimatedCost: number;
  /** Whether the request would exceed the user's tier limit. */
  exceedsTierLimit: boolean;
  /** Reason for the routing decision. */
  reason: string;
}

/** Chain entry type used for health and capability lookups. */
export interface ProviderChainEntry {
  id: ProviderId;
  provider: {
    estimateCost: (messages: ChatMessage[], model: string, options?: ChatOptions) => number;
    getCapabilities: (model: string) => { maxOutputTokens: number };
  };
  health: { avgLatencyMs: number };
}
