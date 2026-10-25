/**
 * Tier → image model access maps.
 *
 * Single source of truth for which image models a tier may request. Values
 * were previously duplicated across the generate action, the MuAPI handler
 * and the fal handler, where they could drift apart and change which models
 * a tier silently lost access to.
 *
 * @module seed/config/tiers/image-model-access
 */

import { SUPPORTED_IMAGE_MODELS } from '@/seed/config/tiers/supported-image-models';

/** MuAPI-hosted models permitted per tier. */
export const TIER_ALLOWED_MODELS: Record<string, string[]> = {
  BASIC: ['flux-schnell'],
  PREMIUM: ['flux-schnell', 'flux-dev', 'hidream'],
  ENTERPRISE: [...SUPPORTED_IMAGE_MODELS],
  MASTER: [...SUPPORTED_IMAGE_MODELS],
};

/** fal.ai-hosted models permitted per tier. */
export const TIER_ALLOWED_FAL_MODELS: Record<string, string[]> = {
  BASIC: ['fal-ai/flux-schnell'],
  PREMIUM: ['fal-ai/flux-schnell'],
  ENTERPRISE: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
  MASTER: ['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro'],
};

/** Every image model a tier may request, regardless of hosting provider. */
export function allowedImageModelsForTier(tier: string): string[] {
  const muapi = TIER_ALLOWED_MODELS[tier] ?? TIER_ALLOWED_MODELS.BASIC;
  const fal = TIER_ALLOWED_FAL_MODELS[tier] ?? TIER_ALLOWED_FAL_MODELS.BASIC;
  return [...muapi, ...fal];
}

/** Prefix shared by every provider-metered (cost-owned) image model. */
const FAL_MODEL_PREFIX = 'fal-ai/';

/**
 * Models a tier may actually be offered in the customer's picker.
 *
 * Deliberately narrower than {@link allowedImageModelsForTier}: the access map
 * records entitlement, while this records what the workspace offers. MuAPI ids
 * are excluded because that submission path spends real money with no cost
 * owner, so offering them lets a customer start work nobody pays for. The
 * excluded models stay in the access map, so the branch can be re-enabled by
 * changing this one filter once a cost owner is decided.
 */
export function selectableImageModelsForTier(tier: string): string[] {
  return allowedImageModelsForTier(tier).filter((id) => id.startsWith(FAL_MODEL_PREFIX));
}
