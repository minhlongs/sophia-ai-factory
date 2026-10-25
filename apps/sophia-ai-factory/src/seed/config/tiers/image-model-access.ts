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

/**
 * Models a tier is offered in the customer's picker.
 *
 * Lists fal-ai models first (so the default selection is the synchronous fal
 * model) followed by the tier's MuAPI models, which execute using the
 * customer's own BYOK `'muapi'` key resolved without a platform fallback.
 */
export function selectableImageModelsForTier(tier: string): string[] {
  const muapi = TIER_ALLOWED_MODELS[tier] ?? TIER_ALLOWED_MODELS.BASIC;
  const fal = TIER_ALLOWED_FAL_MODELS[tier] ?? TIER_ALLOWED_FAL_MODELS.BASIC;
  return [...fal, ...muapi];
}
