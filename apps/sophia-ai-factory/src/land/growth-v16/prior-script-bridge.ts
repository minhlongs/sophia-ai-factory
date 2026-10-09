/**
 * Land Layer: Growth Triad v16 Prior-to-Script Bridge
 * Bridges Bayesian prior distributions and MAB winning arms from D1
 * into generative script prompt parameters.
 * Layer: land/growth-v16 | Max LOC: < 200 | Zero :any
 * @module land/growth-v16/prior-script-bridge
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { BayesianScriptContext, PriorScriptSteering } from '@/seed/types/growth-triad-v16';
import { derivePriorScriptSteering } from '@/tree/growth-v16/prior-script-steerer';

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

interface ExtractedPriors {
  hookAlpha: number;
  hookBeta: number;
  retentionAlpha: number;
  retentionBeta: number;
  totalSamples: number;
  winningHookArchetype?: string;
}

const DEFAULT_EXTRACTED_PRIORS: ExtractedPriors = {
  hookAlpha: 2.0,
  hookBeta: 2.0,
  retentionAlpha: 2.0,
  retentionBeta: 2.0,
  totalSamples: 0,
};

async function fetchPriorsFromDb(db: NonNullable<Awaited<ReturnType<typeof getD1>>>, userId: string): Promise<ExtractedPriors> {
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

/**
 * Builds the Bayesian script optimization context for a specific user and topic.
 * Falls back to uninformative priors if no empirical data has been collected yet.
 */
export async function buildBayesianScriptContext(
  userId: string,
  topic: string,
  audience: string
): Promise<BayesianScriptContext> {
  const db = await getD1();
  const priors = db ? await fetchPriorsFromDb(db, userId) : DEFAULT_EXTRACTED_PRIORS;

  const metrics = derivePriorScriptSteering({
    hookAlpha: priors.hookAlpha,
    hookBeta: priors.hookBeta,
    retentionAlpha: priors.retentionAlpha,
    retentionBeta: priors.retentionBeta,
    sampleSize: priors.totalSamples,
    winningHookArchetype: priors.winningHookArchetype,
  });

  return {
    userId,
    topic,
    audience,
    priors: {
      hookAlpha: priors.hookAlpha,
      hookBeta: priors.hookBeta,
      expectedHookRetention: metrics.expectedHookRetention,
      retentionAlpha: priors.retentionAlpha,
      retentionBeta: priors.retentionBeta,
      expectedOverallRetention: metrics.expectedOverallRetention,
      sampleSize: priors.totalSamples,
    },
    steering: metrics.steering,
  };
}

/**
 * Returns prompt steering options directly for generation calls.
 */
export async function getScriptSteeringForUser(
  userId: string,
  topic: string,
  audience: string
): Promise<PriorScriptSteering> {
  const context = await buildBayesianScriptContext(userId, topic, audience);
  return context.steering;
}
