/**
 * Experiment Store — CRUD for ab_experiments D1 table
 *
 * All reads/writes for A/B experiments go through here.
 * Uses getD1() (synchronous binding) for parameterized queries — no injection risk.
 *
 * @module forest/ab/experiment-store
 */

import { getD1 } from '@/seed/db/client';
import { generateShortId } from '@/land/tracking/edge-link';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AbExperiment,
  AbExperimentRow,
  CreateExperimentInput,
  ExperimentCounterUpdate,
  WinnerVariant,
} from './ab-types';

// ---------------------------------------------------------------------------
// Row → domain mapper
// ---------------------------------------------------------------------------

function rowToExperiment(row: AbExperimentRow): AbExperiment {
  return {
    id: row.id,
    videoId: row.video_id,
    tenantId: row.tenant_id,
    variantACaption: row.variant_a_caption,
    variantBCaption: row.variant_b_caption,
    variantAThumbUrl: row.variant_a_thumb_url,
    variantBThumbUrl: row.variant_b_thumb_url,
    impressionsA: row.impressions_a,
    impressionsB: row.impressions_b,
    conversionsA: row.conversions_a,
    conversionsB: row.conversions_b,
    winner: row.winner,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    offerId: row.offer_id,
    bundleId: row.bundle_id,
  };
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Create a new experiment row in D1.
 * Returns the created experiment ID.
 */
export async function createExperiment(input: CreateExperimentInput): Promise<string> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = generateShortId() + generateShortId(); // 16-char unique ID
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO ab_experiments
         (id, video_id, tenant_id, variant_a_caption, variant_b_caption,
          variant_a_thumb_url, variant_b_thumb_url,
          impressions_a, impressions_b, conversions_a, conversions_b,
          winner, status, created_at, decided_at, offer_id, bundle_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, NULL, 'active', ?, NULL, ?, ?)`
    )
    .bind(
      id,
      input.videoId,
      input.tenantId,
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
  const db = getD1();
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
  const db = getD1();
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

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/** Fetch a single experiment by ID. */
export async function getExperiment(id: string): Promise<AbExperiment | null> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare('SELECT * FROM ab_experiments WHERE id = ? LIMIT 1')
    .bind(id)
    .first<AbExperimentRow>();

  return row ? rowToExperiment(row) : null;
}

/** Fetch all active experiments for a tenant. */
export async function getActiveExperiments(tenantId: string): Promise<AbExperiment[]> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE tenant_id = ? AND status = 'active'
       ORDER BY created_at DESC`
    )
    .bind(tenantId)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}

/** Fetch all experiments for a tenant (all statuses). */
export async function getAllExperiments(
  tenantId: string,
  limit = 50,
): Promise<AbExperiment[]> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(tenantId, limit)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}

/**
 * Fetch active experiments that have been running for at least `minAgeHours`.
 * Used by the winner-picker cron to find experiments ready for evaluation.
 */
export async function getActiveExperimentsOlderThan(
  minAgeHours: number,
): Promise<AbExperiment[]> {
  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');
  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000).toISOString();

  const { results } = await db
    .prepare(
      `SELECT * FROM ab_experiments
       WHERE status = 'active' AND created_at <= ?
       ORDER BY created_at ASC`
    )
    .bind(cutoff)
    .all<AbExperimentRow>();

  return (results ?? []).map(rowToExperiment);
}
