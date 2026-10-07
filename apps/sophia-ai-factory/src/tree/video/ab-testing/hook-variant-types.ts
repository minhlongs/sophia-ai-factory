/**
 * Niche Video Hook Variant & A/B Testing Types
 *
 * Defines psychological hook angles, variant metadata, and telemetry structures
 * for maximizing short-form video retention and affiliate conversion rates.
 *
 * Layer: tree/video/ab-testing (Domain Reusable Logic)
 * @module tree/video/ab-testing/hook-variant-types
 */

export type HookPsychologicalAngle =
  | 'curiosity_gap'
  | 'loss_aversion'
  | 'shocking_stat'
  | 'instant_benefit'
  | 'social_proof';

export interface HookVariant {
  id: string;
  angle: HookPsychologicalAngle;
  headline: string;
  narration: string;
  visualPrompt: string;
  overlayText: string;
  estimatedRetentionScore: number;
}

export interface HookVariantPackage {
  planId: string;
  productName: string;
  niche: 'saas_global' | 'crypto_global';
  variants: HookVariant[];
  recommendedVariantId: string;
  generatedAt: string;
}

export interface HookPerformanceMetric {
  variantId: string;
  impressions: number;
  clicks: number;
  conversions: number;
  commissionCents: number;
  ctr: number;
  conversionRate: number;
  score: number;
}
