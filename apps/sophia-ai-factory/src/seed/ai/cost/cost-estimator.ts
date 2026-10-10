/**
 * @module seed/ai/cost/cost-estimator
 * Public cost estimation interface and tracker.
 * Layer rule: seed only.
 */

import type { ChatMessage, ProviderId } from '../provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import type { CostEstimate, CostKind, ModelPricing } from './types';
import {
  MODEL_PRICING,
  PROVIDER_COST_KIND,
  resolvePricing,
  inferProvider,
} from './rate-card-table';
import { countMessageTokens } from './token-calculator';

/**
 * Estimate the USD cost for a chat completion request.
 */
export function estimateCost(
  messages: ChatMessage[],
  model: string,
  options?: { maxTokens?: number; providerId?: ProviderId },
): number {
  const providerId = options?.providerId ?? inferProvider(model);
  const pricing = resolvePricing(model, providerId);

  if (!pricing) {
    logger.warn('[CostEstimator] No pricing found for model', undefined, {
      model,
      providerId,
    });
    return 0;
  }

  switch (pricing.type) {
    case 'text': {
      const inputTokens = countMessageTokens(messages);
      const maxTokens = options?.maxTokens ?? Math.ceil(inputTokens * 0.5);
      const outputTokens = Math.min(maxTokens, 4096);
      const cost = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
      return Math.round(cost * 1_000_000) / 1_000_000;
    }

    case 'tts': {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
      const chars = lastUserMsg?.content.length ?? 0;
      const cost = chars * pricing.perChar;
      return Math.round(cost * 1_000_000) / 1_000_000;
    }

    case 'video': {
      const duration = (options?.maxTokens ?? 5) as number;
      const cost = duration * pricing.perSecond;
      return Math.round(cost * 1_000_000) / 1_000_000;
    }

    default:
      return 0;
  }
}

/**
 * Get the pricing entry for a model (for display / audit).
 */
export function getModelPricing(model: string, providerId: ProviderId): ModelPricing | undefined {
  return resolvePricing(model, providerId);
}

/**
 * Get all known model IDs for a provider.
 */
export function getModelsForProvider(providerId: ProviderId): string[] {
  const prefix = providerId === 'fish-speech' ? 'fish-speech/' : `${providerId}/`;
  return Object.keys(MODEL_PRICING).filter((id) => {
    if (providerId === 'anthropic') {
      return !id.includes('/') && id.startsWith('claude');
    }
    return id.startsWith(prefix);
  });
}

/**
 * Get the cost kind for a provider/model combination.
 */
export function getModelCostKind(
  providerId: ProviderId,
  _model?: string,
): CostKind {
  return PROVIDER_COST_KIND[providerId] ?? 'unknown';
}

/**
 * Estimate cost with economic honesty metadata.
 */
export function estimateCostV2(
  messages: ChatMessage[],
  model: string,
  options?: { maxTokens?: number; providerId?: ProviderId },
): CostEstimate {
  const providerId = options?.providerId ?? inferProvider(model);
  const kind = getModelCostKind(providerId, model);

  if (kind === 'unknown') {
    return { usd: 0, kind: 'unknown' };
  }

  if (kind === 'unmetered') {
    return { usd: 0, kind: 'unmetered' };
  }

  const usd = estimateCost(messages, model, options);
  return { usd, kind: 'metered' };
}
