/**
 * Template preset types and constants.
 * @module seed/templates/preset-registry/types
 */

export type TemplateCategory =
  | 'educational'
  | 'marketing'
  | 'social'
  | 'brand';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export type TemplateTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface TemplatePreset {
  /** Stable public ID — safe to log, never rename. */
  id: string;
  /** Display label (English; localize at render time). */
  displayName: string;
  category: TemplateCategory;
  aspectRatio: AspectRatio;
  /** Recommended duration; renderer accepts overrides per project. */
  durationSec: number;
  /** Short descriptor for UI cards: 'crisp tutorial', 'punchy hook', etc. */
  vibe: string;
  /** Transitions JSON passed to the MoviePy renderer (string for D1 storage compat). */
  transitionsJson: string;
  /** Lowest tier that may select this preset. */
  minTier: TemplateTier;
  /** Public preview path (relative to PROD_URL). */
  samplePath: string;
  /**
   * Beginner-friendly flag. Top 5 simplest templates marked true.
   * UI may sort these to the top (e.g. ?beginnerFirst=true).
   */
  beginner?: boolean;
}

export const TIER_ORDER: Record<TemplateTier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

/** Default fade transition reused across most simple templates. */
export const FADE = JSON.stringify({ between: 'crossfade', durationMs: 350 });
/** Hard-cut feel for hooks + listicles. */
export const HARDCUT = JSON.stringify({ between: 'cut', durationMs: 0 });
/** Cinematic drift used by brand templates. */
export const DRIFT = JSON.stringify({
  between: 'crossfade',
  durationMs: 600,
  kenBurns: { zoom: 1.08, pan: 'auto' },
});
