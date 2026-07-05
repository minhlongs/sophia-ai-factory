/**
 * Thumbnail A/B Runner — Core logic for creating A/B experiments
 *
 * Creates experiments for video thumbnails by generating 2 caption/thumbnail
 * prompt variants via variant-generator and persisting via experiment-store.
 *
 * This module exports pure business logic (no Inngest dependency) so it can be
 * called directly from mission handlers, video pipeline steps, or cron schedules.
 *
 * @module forest/ab/thumbnail-ab-runner
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { createExperiment } from '@/forest/ab/experiment-store';
import { generateVariants } from '@/forest/ab/variant-generator';
import type { GeneratedVariants } from '@/forest/ab/variant-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Query: videos needing A/B experiments
// ---------------------------------------------------------------------------

export interface VideoNeedingExperiment {
  videoId: string;
  tenantId: string;
  title: string;
}

/**
 * Find completed videos with a thumbnail that have:
 * 1. No active experiment
 * 2. No experiment that was already won (winner a or b)
 *
 * Used by the 2-hour cron to discover stragglers not covered by the
 * event-driven pipeline.
 */
export async function findVideosNeedingExperiments(
  limit = 20,
): Promise<VideoNeedingExperiment[]> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  const { results } = await db
    .prepare(
      `SELECT v.id AS video_id, v.user_id AS tenant_id, v.title
       FROM videos v
       WHERE v.status = 'completed'
         AND v.thumbnail_url IS NOT NULL
         AND v.title IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM ab_experiments e
           WHERE e.video_id = v.id
             AND e.status = 'active'
         )
         AND NOT EXISTS (
           SELECT 1 FROM ab_experiments e
           WHERE e.video_id = v.id
             AND e.winner IN ('a', 'b')
         )
       ORDER BY v.created_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ video_id: string; tenant_id: string; title: string }>();

  return (results ?? []).map((row) => ({
    videoId: row.video_id,
    tenantId: row.tenant_id,
    title: row.title,
  }));
}

// ---------------------------------------------------------------------------
// Core: create experiment for a single video
// ---------------------------------------------------------------------------

/**
 * Create an A/B experiment for a video thumbnail.
 *
 * Generates 2 caption/thumbnail prompt variants via the LLM variant-generator
 * (or deterministic fallback when no BYOK key is available), then persists
 * the experiment via experiment-store.
 *
 * Returns null when an active experiment already exists for this video
 * (idempotency guard).
 */
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

  // Idempotency: skip if active experiment already exists
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

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

  // Generate caption + thumbnail prompt variants
  const variants = await generateVariants({
    originalCaption,
    locale: locale ?? 'en',
    byokOpenRouterKey,
  });

  // Persist the experiment
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

  logger.info('[thumbnail-ab-runner] A/B experiment created', {
    experimentId,
    videoId,
    usedLlm: variants.usedLlm,
  });

  return { experimentId, variants };
}

// ---------------------------------------------------------------------------
// Select winning thumbnail for a video (called from winner-picker cron)
// ---------------------------------------------------------------------------

/**
 * Update a video's thumbnail_url to the winning variant's thumbnail URL.
 *
 * Only applies when:
 * - The winner is 'a' or 'b'
 * - The winning variant has a non-null thumbnail_url
 */
export async function selectWinningThumbnail(
  videoId: string,
  winner: 'a' | 'b',
  variantThumbUrl: string | null,
): Promise<boolean> {
  if (!variantThumbUrl) {
    logger.info('[thumbnail-ab-runner] No variant thumbnail URL to select', {
      videoId,
      winner,
    });
    return false;
  }

  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  await db
    .prepare('UPDATE videos SET thumbnail_url = ? WHERE id = ?')
    .bind(variantThumbUrl, videoId)
    .run();

  logger.info('[thumbnail-ab-runner] Winning thumbnail selected', {
    videoId,
    winner,
    thumbnailUrl: variantThumbUrl.slice(0, 60),
  });

  return true;
}
