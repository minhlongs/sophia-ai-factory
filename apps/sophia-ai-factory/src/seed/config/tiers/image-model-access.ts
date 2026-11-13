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
import { TIER_RANK, type Tier } from '@/seed/types';

/**
 * True only for a canonical tier name checked as an own property of `TIER_RANK`,
 * so unrecognised strings, non-strings, and inherited `Object.prototype` keys
 * (`'__proto__'`, `'constructor'`, `'toString'`, `'valueOf'`, `'hasOwnProperty'`)
 * never resolve to a tier's model list.
 */
export function isKnownImageTier(tier: unknown): tier is Tier {
  return typeof tier === 'string' && Object.hasOwn(TIER_RANK, tier);
}

/**
 * Formats an untrusted tier value for refusal messages without invoking
 * user-defined `toString` / `valueOf` hooks on arbitrary objects.
 */
export function describeImageTier(tier: unknown): string {
  if (typeof tier === 'string') return tier.slice(0, 64);
  if (typeof tier === 'symbol') return tier.toString().slice(0, 64);
  if (
    tier === null ||
    tier === undefined ||
    typeof tier === 'number' ||
    typeof tier === 'bigint' ||
    typeof tier === 'boolean'
  ) {
    return String(tier).slice(0, 64);
  }
  return typeof tier;
}

/** MuAPI-hosted models permitted per tier. */
export const TIER_ALLOWED_MODELS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  BASIC: Object.freeze(['flux-schnell']),
  PREMIUM: Object.freeze(['flux-schnell', 'flux-dev', 'hidream']),
  ENTERPRISE: Object.freeze([...SUPPORTED_IMAGE_MODELS]),
  MASTER: Object.freeze([...SUPPORTED_IMAGE_MODELS]),
});

/** fal.ai-hosted models permitted per tier. */
export const TIER_ALLOWED_FAL_MODELS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  BASIC: Object.freeze(['fal-ai/flux-schnell']),
  PREMIUM: Object.freeze(['fal-ai/flux-schnell']),
  ENTERPRISE: Object.freeze(['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro']),
  MASTER: Object.freeze(['fal-ai/flux-schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro']),
});

/** Every image model a tier may request, regardless of hosting provider. */
export function allowedImageModelsForTier(tier: string): string[] {
  if (!isKnownImageTier(tier)) {
    return [];
  }
  const muapi = TIER_ALLOWED_MODELS[tier] ?? [];
  const fal = TIER_ALLOWED_FAL_MODELS[tier] ?? [];
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
  if (!isKnownImageTier(tier)) {
    return [];
  }
  const muapi = TIER_ALLOWED_MODELS[tier] ?? [];
  const fal = TIER_ALLOWED_FAL_MODELS[tier] ?? [];
  return [...fal, ...muapi];
}
