/**
 * A/B experiment creation and variant generation pipeline
 *
 * @module forest/ab/thumbnail/experiment-creator
 */

import { getD1 } from '@/seed/db/client';
import { createExperiment } from '@/forest/ab/experiment-store';
import { generateVariants } from '@/forest/ab/variant-generator';
import { logger } from '@/seed/utils/logger-utility';
import type { CreateAbExperimentOptions, CreateAbExperimentResult } from './types';

export async function createThumbnailAbExperiment(
  options: CreateAbExperimentOptions,
): Promise<CreateAbExperimentResult | null> {
  const {
    videoId,
    tenantId,
    originalCaption,
    locale,
    byokOpenRouterKey,
    offerId,
    bundleId,
  } = options;

  const db = await getD1();
  if (!db) {
    throw new Error('D1 database binding not available');
  }

  const existing = await db
    .prepare(
      'SELECT id FROM ab_experiments WHERE video_id = ? AND status = ? LIMIT 1',
    )
    .bind(videoId, 'active')
    .first<{ id: string }>();

  if (existing) {
    logger.info('[thumbnail-ab-runner] Active experiment exists, skipping', {
      videoId,
      experimentId: existing.id,
    });
    return null;
  }

  const variants = await generateVariants({
    originalCaption,
    locale: locale ?? 'en',
    byokOpenRouterKey,
  });

  const experimentId = await createExperiment({
    videoId,
    tenantId,
    variantACaption: variants.variantACaption,
    variantBCaption: variants.variantBCaption,
    variantAThumbUrl: undefined,
    variantBThumbUrl: undefined,
    offerId,
    bundleId,
  });

  return {
    experimentId,
    variants,
  };
}
