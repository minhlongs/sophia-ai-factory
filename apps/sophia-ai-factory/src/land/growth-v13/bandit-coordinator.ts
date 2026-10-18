/**
 * Land Layer: Growth Triad v13 D1 Coordinator
 * Manages atomic CAS and state transitions for MAB arms and Shapley touchpoints.
 * Layer: land/growth-v13 | Max LOC: < 200 | Zero :any
 * @module land/growth-v13/bandit-coordinator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { acquireCasLock, releaseCasLock } from '@/seed/db/atomic-cas-lock';
import { BanditExperiment } from '@/seed/types/growth-triad-v13';

export { insertShapleyTouchpoint } from './shapley-touchpoint-writer';

export async function acquireExperimentLock(
  experimentId: string,
  workerId: string
): Promise<boolean> {
  const res = await acquireCasLock(`bandit:experiment:${experimentId}`, workerId);
  return res.acquired;
}

export async function releaseExperimentLock(
  experimentId: string,
  workerId: string
): Promise<boolean> {
  return releaseCasLock(`bandit:experiment:${experimentId}`, workerId);
}

export async function createBanditExperiment(
  experiment: BanditExperiment
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for createBanditExperiment');
    return false;
  }
  const now = Date.now();

  try {
    const res = await db
      .prepare(
        `INSERT INTO growth_bandit_experiments (
          id, user_id, experiment_name, status, winning_arm_id, total_pulls, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .bind(
        experiment.id,
        experiment.userId,
        experiment.experimentName,
        experiment.status,
        experiment.winningArmId ?? null,
        experiment.totalPulls,
        now,
        now
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to create bandit experiment in D1', { error: err });
    return false;
  }
}

export async function recordArmPull(
  armId: string,
  converted: boolean
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for recordArmPull');
    return false;
  }
  const now = Date.now();
  const conversionInc = converted ? 1 : 0;
  const alphaInc = converted ? 1.0 : 0.0;
  const betaInc = converted ? 0.0 : 1.0;

  try {
    const res = await db
      .prepare(
        `UPDATE growth_bandit_arms
         SET pull_count = pull_count + 1,
             conversion_count = conversion_count + ?,
             alpha_successes = alpha_successes + ?,
             beta_failures = beta_failures + ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(conversionInc, alphaInc, betaInc, now, armId)
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to update arm pull stats', { armId, error: err });
    return false;
  }
}
