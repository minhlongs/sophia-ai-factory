/**
 * Land Layer: Growth Triad v16 Prior-to-Script Bridge
 * Bridges Bayesian prior distributions and MAB winning arms from D1
 * into generative script prompt parameters.
 * Layer: land/growth-v16 | Max LOC: < 200 | Zero :any
 * @module land/growth-v16/prior-script-bridge
 */

import { getD1 } from '@/seed/db/client';
import type { BayesianScriptContext, PriorScriptSteering } from '@/seed/types/growth-triad-v16';
import { derivePriorScriptSteering } from '@/tree/growth-v16/prior-script-steerer';
import { DEFAULT_EXTRACTED_PRIORS, fetchPriorsFromDb } from './prior-script-db-queries';

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
