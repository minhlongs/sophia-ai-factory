/**
 * Types for thumbnail A/B runner
 *
 * @module forest/ab/thumbnail/types
 */

import type { GeneratedVariants } from '@/forest/ab/variant-generator';

export interface CreateAbExperimentOptions {
  /** D1 video row ID. */
  videoId: string;
  /** Tenant / user ID. */
  tenantId: string;
  /** Source caption or video title to generate A/B variants from. */
  originalCaption: string;
  /** Target locale for captions. */
  locale?: 'en' | 'vi';
  /** BYOK OpenRouter key. Falls back to deterministic variants when absent. */
  byokOpenRouterKey?: string;
  /** Optional affiliate offer ID for metadata. */
  offerId?: string;
  /** Optional bundle ID for metadata. */
  bundleId?: string;
}

export interface CreateAbExperimentResult {
  experimentId: string;
  variants: GeneratedVariants;
}

export interface VideoNeedingExperiment {
  videoId: string;
  tenantId: string;
  title: string;
}
