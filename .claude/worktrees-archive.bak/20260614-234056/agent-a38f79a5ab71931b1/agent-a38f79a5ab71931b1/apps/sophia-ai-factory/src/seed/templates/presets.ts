/**
 * Video template presets registry.
 *
 * 20+ default templates ship in code (no DB seed required) so every tenant has
 * an instant catalog on day one. Per-tenant *custom* templates live in the
 * `video_templates` D1 table (see `src/seed/db/migrations/20260501_video_templates.sql`)
 * and are merged with this registry at read time by callers.
 *
 * Adding a preset:
 *   1. Pick a stable kebab-case `id` (never rename).
 *   2. Append to TEMPLATE_PRESETS preserving category groupings.
 *   3. Optionally drop a 5-second sample at `public/templates/{id}.mp4`.
 *
 * @module seed/templates/presets
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

const TIER_ORDER: Record<TemplateTier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

/** Default fade transition reused across most simple templates. */
const FADE = JSON.stringify({ between: 'crossfade', durationMs: 350 });
/** Hard-cut feel for hooks + listicles. */
const HARDCUT = JSON.stringify({ between: 'cut', durationMs: 0 });
/** Cinematic drift used by brand templates. */
const DRIFT = JSON.stringify({
  between: 'crossfade',
  durationMs: 600,
  kenBurns: { zoom: 1.08, pan: 'auto' },
});

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  // ── Educational ───────────────────────────────────────────────────────────
  {
    id: 'edu-tutorial-16x9',
    displayName: 'Tutorial walkthrough',
    category: 'educational',
    aspectRatio: '16:9',
    durationSec: 60,
    vibe: 'crisp tutorial',
    transitionsJson: FADE,
    minTier: 'BASIC',
    samplePath: '/templates/edu-tutorial-16x9.mp4',
    beginner: true,
  },
  {
    id: 'edu-explainer-16x9',
    displayName: 'Explainer breakdown',
    category: 'educational',
    aspectRatio: '16:9',
    durationSec: 90,
    vibe: 'patient teacher',
    transitionsJson: FADE,
    minTier: 'BASIC',
    samplePath: '/templates/edu-explainer-16x9.mp4',
  },
  {
    id: 'edu-howto-9x16',
    displayName: 'How-to short',
    category: 'educational',
    aspectRatio: '9:16',
    durationSec: 45,
    vibe: 'fast how-to',
    transitionsJson: HARDCUT,
    minTier: 'BASIC',
    samplePath: '/templates/edu-howto-9x16.mp4',
  },
  {
    id: 'edu-course-snippet-1x1',
    displayName: 'Course snippet',
    category: 'educational',
    aspectRatio: '1:1',
    durationSec: 30,
    vibe: 'micro-lesson',
    transitionsJson: FADE,
    minTier: 'PREMIUM',
    samplePath: '/templates/edu-course-snippet-1x1.mp4',
  },
  {
    id: 'edu-faq-16x9',
    displayName: 'FAQ rapid-fire',
    category: 'educational',
    aspectRatio: '16:9',
    durationSec: 60,
    vibe: 'quick answers',
    transitionsJson: HARDCUT,
    minTier: 'PREMIUM',
    samplePath: '/templates/edu-faq-16x9.mp4',
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  {
    id: 'mkt-product-launch-16x9',
    displayName: 'Product launch',
    category: 'marketing',
    aspectRatio: '16:9',
    durationSec: 60,
    vibe: 'hype reveal',
    transitionsJson: DRIFT,
    minTier: 'BASIC',
    samplePath: '/templates/mkt-product-launch-16x9.mp4',
  },
  {
    id: 'mkt-promo-flash-9x16',
    displayName: 'Promo flash',
    category: 'marketing',
    aspectRatio: '9:16',
    durationSec: 15,
    vibe: 'punchy promo',
    transitionsJson: HARDCUT,
    minTier: 'BASIC',
    samplePath: '/templates/mkt-promo-flash-9x16.mp4',
    beginner: true,
  },
  {
    id: 'mkt-testimonial-16x9',
    displayName: 'Customer testimonial',
    category: 'marketing',
    aspectRatio: '16:9',
    durationSec: 45,
    vibe: 'authentic voice',
    transitionsJson: FADE,
    minTier: 'PREMIUM',
    samplePath: '/templates/mkt-testimonial-16x9.mp4',
  },
  {
    id: 'mkt-case-study-16x9',
    displayName: 'Case study highlight',
    category: 'marketing',
    aspectRatio: '16:9',
    durationSec: 90,
    vibe: 'data-led story',
    transitionsJson: DRIFT,
    minTier: 'ENTERPRISE',
    samplePath: '/templates/mkt-case-study-16x9.mp4',
  },
  {
    id: 'mkt-demo-1x1',
    displayName: 'Product demo',
    category: 'marketing',
    aspectRatio: '1:1',
    durationSec: 30,
    vibe: 'feature showcase',
    transitionsJson: FADE,
    minTier: 'PREMIUM',
    samplePath: '/templates/mkt-demo-1x1.mp4',
  },

  // ── Social ────────────────────────────────────────────────────────────────
  {
    id: 'social-listicle-9x16',
    displayName: 'Listicle countdown',
    category: 'social',
    aspectRatio: '9:16',
    durationSec: 45,
    vibe: 'top-N list',
    transitionsJson: HARDCUT,
    minTier: 'BASIC',
    samplePath: '/templates/social-listicle-9x16.mp4',
  },
  {
    id: 'social-hook-question-9x16',
    displayName: 'Hook question',
    category: 'social',
    aspectRatio: '9:16',
    durationSec: 20,
    vibe: 'thumb-stopping hook',
    transitionsJson: HARDCUT,
    minTier: 'BASIC',
    samplePath: '/templates/social-hook-question-9x16.mp4',
    beginner: true,
  },
  {
    id: 'social-story-arc-9x16',
    displayName: 'Story arc',
    category: 'social',
    aspectRatio: '9:16',
    durationSec: 60,
    vibe: 'narrative reel',
    transitionsJson: FADE,
    minTier: 'PREMIUM',
    samplePath: '/templates/social-story-arc-9x16.mp4',
  },
  {
    id: 'social-before-after-9x16',
    displayName: 'Before / after',
    category: 'social',
    aspectRatio: '9:16',
    durationSec: 30,
    vibe: 'transformation',
    transitionsJson: HARDCUT,
    minTier: 'BASIC',
    samplePath: '/templates/social-before-after-9x16.mp4',
    beginner: true,
  },
  {
    id: 'social-poll-4x5',
    displayName: 'Poll or vote',
    category: 'social',
    aspectRatio: '4:5',
    durationSec: 20,
    vibe: 'engagement bait',
    transitionsJson: HARDCUT,
    minTier: 'PREMIUM',
    samplePath: '/templates/social-poll-4x5.mp4',
  },

  // ── Brand ─────────────────────────────────────────────────────────────────
  {
    id: 'brand-intro-bumper-16x9',
    displayName: 'Intro bumper',
    category: 'brand',
    aspectRatio: '16:9',
    durationSec: 5,
    vibe: 'bold intro',
    transitionsJson: HARDCUT,
    minTier: 'BASIC',
    samplePath: '/templates/brand-intro-bumper-16x9.mp4',
    beginner: true,
  },
  {
    id: 'brand-outro-cta-16x9',
    displayName: 'Outro + CTA',
    category: 'brand',
    aspectRatio: '16:9',
    durationSec: 8,
    vibe: 'call-to-action',
    transitionsJson: FADE,
    minTier: 'BASIC',
    samplePath: '/templates/brand-outro-cta-16x9.mp4',
  },
  {
    id: 'brand-story-16x9',
    displayName: 'Brand story',
    category: 'brand',
    aspectRatio: '16:9',
    durationSec: 90,
    vibe: 'mission narrative',
    transitionsJson: DRIFT,
    minTier: 'PREMIUM',
    samplePath: '/templates/brand-story-16x9.mp4',
  },
  {
    id: 'brand-employee-spotlight-1x1',
    displayName: 'Employee spotlight',
    category: 'brand',
    aspectRatio: '1:1',
    durationSec: 45,
    vibe: 'human face',
    transitionsJson: FADE,
    minTier: 'PREMIUM',
    samplePath: '/templates/brand-employee-spotlight-1x1.mp4',
  },
  {
    id: 'brand-anniversary-16x9',
    displayName: 'Anniversary recap',
    category: 'brand',
    aspectRatio: '16:9',
    durationSec: 60,
    vibe: 'celebration',
    transitionsJson: DRIFT,
    minTier: 'ENTERPRISE',
    samplePath: '/templates/brand-anniversary-16x9.mp4',
  },
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
