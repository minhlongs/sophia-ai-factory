/**
 * Thumbnail A/B Hook — Integration point for video pipeline
 *
 * Convenience wrapper called after a video thumbnail is generated.
 * Triggers A/B experiment creation without requiring the caller to know
 * about variant-generator or experiment-store internals.
 *
 * Usage (from a mission handler or Inngest step):
 *   import { triggerThumbnailAbTest } from '@/forest/ab/thumbnail-ab-hook';
 *   await triggerThumbnailAbTest({
 *     videoId: '...',
 *     tenantId: userId,
 *     title: videoTitle,
 *     byokOpenRouterKey: openRouterKey,
 *   });
 *
 * @module forest/ab/thumbnail-ab-hook
 */

import { logger } from '@/seed/utils/logger-utility';
import { createThumbnailAbExperiment } from '@/forest/ab/thumbnail-ab-runner';
import type { CreateAbExperimentResult } from '@/forest/ab/thumbnail-ab-runner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriggerAbTestInput {
  /** D1 video row ID. */
  videoId: string;
  /** User / tenant ID. */
  tenantId: string;
  /** Video title used as the source caption for A/B variants. */
  title: string;
  /** BYOK OpenRouter key. Falls back to deterministic variants when absent. */
  byokOpenRouterKey?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Trigger A/B experiment creation after a video thumbnail is generated.
 *
 * Returns the experiment result when created, or null when an active
 * experiment already exists for this video (idempotency).
 *
 * Safe to call multiple times for the same video — the second call
 * returns null without side effects.
 */
export async function triggerThumbnailAbTest(
  input: TriggerAbTestInput,
): Promise<CreateAbExperimentResult | null> {
  const { videoId, tenantId, title, byokOpenRouterKey } = input;

  if (!title || title.trim().length === 0) {
    logger.warn('[thumbnail-ab-hook] Empty title, skipping AB test', {
      videoId,
    });
    return null;
  }

  const result = await createThumbnailAbExperiment({
    videoId,
    tenantId,
    originalCaption: title.trim(),
    byokOpenRouterKey,
  });

  if (result) {
    logger.info('[thumbnail-ab-hook] AB test triggered after thumbnail generation', {
      videoId,
      experimentId: result.experimentId,
      usedLlm: result.variants.usedLlm,
    });
  }

  return result;
}
