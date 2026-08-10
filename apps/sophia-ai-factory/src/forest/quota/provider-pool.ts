/**
 * Provider pool builder — resolves which AI providers a user can actually use.
 *
 * Forest layer. A provider enters the pool only when the user has a usable
 * key: their own BYOK key (encrypted at rest) or the platform fallback env
 * var. The pool is enriched with cost, quota, and usage data so every
 * strategy (priority / cost-optimized / least-used) stays a pure sort over
 * the same candidates.
 *
 * Quota is read-only here (no slot reservation) — the Inngest caller owns
 * the hard quota gate via reserveVideoSlot.
 */

import {
  PROVIDER_COST_PER_UNIT,
  PROVIDER_DEFAULT_MODEL,
  PROVIDER_ENV_FALLBACK,
  PROVIDER_PRIORITY,
  type ProviderCandidate,
  type RoutingContext,
  type VideoProvider,
  type VideoTaskType,
} from '@/seed/config/routing-strategies';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkVideoQuota } from '@/forest/quota/video-quota';
import { getUserApiKey } from '@/tree/byok/user-api-key-store';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { getSharedRegistry } from '@/forest/ai/provider-factory';
import { getCircuitState } from '@/seed/utils/circuit-breaker';

/** Cost used for providers not priced for a task — the cost strategy never picks them. */
const UNSERVED_TASK_COST = 1_000_000;

/** Estimated USD cost per unit of work for a provider on a task. */
export function getProviderCost(provider: VideoProvider, taskType: VideoTaskType): number {
  return PROVIDER_COST_PER_UNIT[provider][taskType] ?? UNSERVED_TASK_COST;
}

/**
 * Estimated USD cost of running the task on a provider. Scripting is
 * token-proportional (cost is per 1K tokens); the other tasks use a fixed
 * unit estimate because no per-job unit count is known at routing time.
 */
export function estimateTaskCost(
  provider: VideoProvider,
  taskType: VideoTaskType,
  estimatedInputTokens?: number,
): number {
  const costPerUnit = getProviderCost(provider, taskType);
  if (taskType === 'scripting') {
    return (costPerUnit / 1000) * (estimatedInputTokens ?? 1000);
  }
  return costPerUnit;
}

/**
 * Build the candidate pool for a user and task. Only providers the user has
 * a usable key for (BYOK or platform fallback) are considered.
 */
export async function buildProviderPool(
  userId: string,
  context: RoutingContext,
): Promise<ProviderCandidate[]> {
  const tier = await getUserTier(userId);
  const quota = await checkVideoQuota(userId, tier);
  const candidates: ProviderCandidate[] = [];

  // Get shared registry for health scores (circuit breaker state)
  const registry = getSharedRegistry();

  // Map video provider IDs to registry ProviderIds for health lookup
  const providerHealthMap: Record<VideoProvider, 'openrouter' | 'elevenlabs' | 'anthropic' | 'wan' | 'fish-speech' | undefined> = {
    openrouter: 'openrouter',
    elevenlabs: 'elevenlabs',
    'd-id': undefined,
    heygen: undefined,
  };

  for (const provider of PROVIDER_PRIORITY[context.taskType]) {
    const envKey = process.env[PROVIDER_ENV_FALLBACK[provider]];
    const resolvedKey = await resolveUserApiKey(userId, provider, envKey);
    if (!resolvedKey) continue;

    // Distinguish user-owned keys (BYOK) from platform fallback for audit.
    const userKey = await getUserApiKey(userId, provider);

    // Get health score from circuit breaker (HeyGen) or provider registry (others)
    // HeyGen uses KV-backed circuit breaker: closed=1.0, half-open=0.5, open=0.1
    let healthScore = 1;
    if (provider === 'heygen') {
      const circuitStatus = await getCircuitState();
      switch (circuitStatus.state) {
        case 'closed':
          healthScore = 1.0;
          break;
        case 'half-open':
          healthScore = 0.5;
          break;
        case 'open':
          healthScore = 0.1;
          break;
      }
    } else {
      const registryProviderId = providerHealthMap[provider];
      if (registryProviderId) {
        const health = registry.getHealth(registryProviderId);
        if (health) {
          // Healthy = 1.0, in cooldown = 0.5, unhealthy = 0.1
          if (health.healthy) {
            healthScore = 1;
          } else if (health.inCooldown) {
            healthScore = 0.5;
          } else {
            healthScore = 0.1;
          }
        }
      }
    }

    candidates.push({
      provider,
      model: PROVIDER_DEFAULT_MODEL[provider],
      hasUserKey: userKey !== null,
      costPerUnit: getProviderCost(provider, context.taskType),
      healthScore,
      quotaRemaining: Math.max(0, quota.limit - quota.used),
      usageCount: quota.used,
      estimatedCost: estimateTaskCost(provider, context.taskType, context.estimatedInputTokens),
    });
  }

  return candidates;
}
