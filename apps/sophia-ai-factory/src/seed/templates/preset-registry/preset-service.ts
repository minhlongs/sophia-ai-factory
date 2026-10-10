/**
 * Template preset query, filtering, and access control functions.
 * @module seed/templates/preset-registry/preset-service
 */

import {
  TIER_ORDER,
  type TemplatePreset,
  type TemplateTier,
  type TemplateCategory,
} from './types';
import { EDUCATIONAL_MARKETING_PRESETS } from './educational-marketing-presets';
import { SOCIAL_BRAND_PRESETS } from './social-brand-presets';

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  ...EDUCATIONAL_MARKETING_PRESETS,
  ...SOCIAL_BRAND_PRESETS,
] as const;

/** O(n) lookup; registry is small. Returns undefined when ID not found. */
export function getTemplatePreset(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find((preset) => preset.id === id);
}

/** Returns templates tagged beginner:true, sorted by durationSec ascending. */
export function listBeginnerTemplates(): TemplatePreset[] {
  return [...TEMPLATE_PRESETS]
    .filter((preset) => preset.beginner === true)
    .sort((a, b) => a.durationSec - b.durationSec);
}

export function canAccessTemplate(tier: TemplateTier, preset: TemplatePreset): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[preset.minTier];
}

/** Filter by tier; optional category narrows further. */
export function listTemplatesForTier(
  tier: TemplateTier,
  category?: TemplateCategory,
): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter(
    (preset) =>
      canAccessTemplate(tier, preset) &&
      (!category || preset.category === category),
  );
}
