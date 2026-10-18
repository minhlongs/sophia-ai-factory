/**
 * D1 query helpers for Bayesian prior distributions and MAB winning arms.
 * @module land/growth-v16/prior-script-db-queries
 */

import type { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

interface PriorRow {
  dimension_key: string;
  dimension_val: string;
  alpha: number;
  beta: number;
  sample_size: number;
}

interface WinningArmRow {
  hook_archetype?: string;
  variant_name?: string;
  conversion_count: number;
}

export interface ExtractedPriors {
  hookAlpha: number;
  hookBeta: number;
  retentionAlpha: number;
  retentionBeta: number;
  totalSamples: number;
  winningHookArchetype?: string;
}

export const DEFAULT_EXTRACTED_PRIORS: ExtractedPriors = {
  hookAlpha: 2.0,
  hookBeta: 2.0,
  retentionAlpha: 2.0,
  retentionBeta: 2.0,
  totalSamples: 0,
};

export async function fetchPriorsFromDb(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  userId: string
): Promise<ExtractedPriors> {
  const result: ExtractedPriors = { ...DEFAULT_EXTRACTED_PRIORS };

  try {
    const priors = await db
      .prepare(
        `SELECT dimension_key, dimension_val, alpha, beta, sample_size
         FROM growth_bayesian_priors
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT 10`
      )
      .bind(userId)
      .all<PriorRow>();

    for (const row of priors.results ?? []) {
      result.totalSamples += row.sample_size;
      if (row.dimension_key === 'hook') {
        result.hookAlpha = row.alpha;
        result.hookBeta = row.beta;
      } else if (row.dimension_key === 'retention' || row.dimension_key === 'overall') {
        result.retentionAlpha = row.alpha;
        result.retentionBeta = row.beta;
      }
    }

    const winningArm = await db
      .prepare(
        `SELECT name as variant_name, conversion_count
         FROM growth_bandit_arms
         ORDER BY conversion_count DESC, alpha_successes DESC
         LIMIT 1`
      )
      .first<WinningArmRow>();

    if (winningArm?.variant_name) {
      result.winningHookArchetype = winningArm.variant_name;
    }
  } catch (err) {
    logger.warn('Failed to query D1 priors for script context — falling back to defaults', {
      userId,
      error: err,
    });
  }

  return result;
}
