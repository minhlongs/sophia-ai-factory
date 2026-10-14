/**
 * Experiment Store - Write Operations
 *
 * Layer: forest/ab
 */

import { getD1 } from '@/seed/db/client';
import { generateShortId } from '@/forest/tracking/edge-link';
import { logger } from '@/seed/utils/logger-utility';
import type {
  CreateExperimentInput,
  ExperimentCounterUpdate,
  WinnerVariant,
} from '../ab-types';

/**
 * Create a new experiment row in D1.
 * Returns the created experiment ID.
 */
export async function createExperiment(input: CreateExperimentInput): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = generateShortId() + generateShortId(); // 16-char unique ID
  const now = new Date().toISOString();

  const contentType = input.contentType ?? 'thumbnail';
  await db
    .prepare(
      `INSERT INTO ab_experiments
         (id, video_id, tenant_id, content_type, variant_a_caption, variant_b_caption,
          variant_a_thumb_url, variant_b_thumb_url,
          impressions_a, impressions_b, conversions_a, conversions_b,
          winner, status, created_at, decided_at, offer_id, bundle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, NULL, 'active', ?, NULL, ?, ?)`
    )
    .bind(
      id,
      input.videoId,
      input.tenantId,
      contentType,
      input.variantACaption,
      input.variantBCaption,
      input.variantAThumbUrl ?? null,
      input.variantBThumbUrl ?? null,
      now,
      input.offerId ?? null,
      input.bundleId ?? null,
    )
    .run();

  logger.info('[experiment-store] created experiment', { id, videoId: input.videoId });
  return id;
}

/**
 * Increment a single counter (impression or conversion) for a variant.
 * Uses SQLite atomic increment to avoid race conditions.
 */
export async function incrementCounter(update: ExperimentCounterUpdate): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const col =
    update.variant === 'a'
      ? update.type === 'impression'
        ? 'impressions_a'
        : 'conversions_a'
      : update.type === 'impression'
        ? 'impressions_b'
        : 'conversions_b';

  await db
    .prepare(`UPDATE ab_experiments SET ${col} = ${col} + 1 WHERE id = ?`)
    .bind(update.experimentId)
    .run();
}

/**
 * Mark an experiment as decided, storing winner + timestamp.
 */
export async function markWinner(
  experimentId: string,
  winner: WinnerVariant,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE ab_experiments
       SET winner = ?, status = 'decided', decided_at = ?
       WHERE id = ?`
    )
    .bind(winner, now, experimentId)
    .run();

  logger.info('[experiment-store] winner decided', { experimentId, winner });
}
