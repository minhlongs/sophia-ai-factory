/**
 * Land Layer: Growth Triad v13 Server Actions
 * Authenticated Server Actions for MAB experiments, deliberation requests, and Shapley telemetry.
 * Layer: land/growth-v13 | Max LOC: < 200 | Zero :any
 * @module land/growth-v13/flywheel-v13-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { inngest } from '@/seed/inngest/client';
import { createBanditExperiment } from './bandit-coordinator';
import { BanditExperiment } from '@/seed/types/growth-triad-v13';

export interface GrowthV13ActionError {
  code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  message: string;
}

export async function createBanditExperimentAction(
  experimentName: string,
  hooks: string[]
): Promise<Result<{ experimentId: string }, GrowthV13ActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  if (!experimentName || hooks.length < 2) {
    return failure({ code: 'VALIDATION_ERROR', message: 'At least 2 hooks required' });
  }

  const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const experiment: BanditExperiment = {
    id: experimentId,
    userId: user.id,
    experimentName,
    status: 'ACTIVE',
    totalPulls: 0,
    arms: hooks.map((hook, index) => ({
      id: `${experimentId}_arm_${index + 1}`,
      experimentId,
      hookText: hook,
      alphaSuccesses: 1.0,
      betaFailures: 1.0,
      pullCount: 0,
      conversionCount: 0,
      trafficWeight: Number((1.0 / hooks.length).toFixed(4)),
      status: 'ACTIVE',
    })),
    convergenceThreshold: 0.95,
    minPullsBeforeConvergence: 50,
  };

  try {
    const created = await createBanditExperiment(experiment);
    if (!created) {
      return failure({ code: 'INTERNAL_ERROR', message: 'Failed to record experiment in database' });
    }

    await inngest.send({
      name: 'growth/v13.bandit.evaluate',
      data: {
        experimentId,
        userId: user.id,
      },
    });

    return success({ experimentId });
  } catch {
    return failure({ code: 'INTERNAL_ERROR', message: 'Internal processing failure' });
  }
}

export async function requestCreativeDeliberationAction(
  scriptId: string,
  originalScript: string
): Promise<Result<{ status: string }, GrowthV13ActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  try {
    await inngest.send({
      name: 'growth/v13.deliberation.request',
      data: {
        scriptId,
        userId: user.id,
        originalScript,
      },
    });

    return success({ status: 'DELIBERATION_REQUESTED' });
  } catch {
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to queue deliberation review' });
  }
}
