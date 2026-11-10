/**
 * Land Layer: Growth Triad v14 Authenticated Server Actions
 * Dispatches Kelly-budgeted predictive renders and provides telemetry queries.
 * Layer: land/growth-v14
 * @module land/growth-v14/predictive-render-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { success, failure, type Result } from '@/seed/types/result';
import { inngest } from '@/seed/inngest/client';
import type { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';
import { logger } from '@/seed/utils/logger-utility';
import {
  createPredictiveRenderJob,
  getJobsForUser,
  updateJobStatusInD1,
} from './predictive-render-coordinator';
import { probeUserSparseDataFromD1 } from './predictive-render-sparse-probe';
import {
  validateAndAllocatePredictiveRender,
  type GrowthV14ActionError,
  type ScheduleRenderInput,
} from './predictive-render-validation';
import { evaluateSparseDataGrowthGate } from '@/tree/growth/sparse-data-growth-guard';

export type { GrowthV14ActionError, ScheduleRenderInput };

/**
 * Calculates Kelly budget allocation, persists the job, and enqueues Inngest worker.
 */
export async function schedulePredictiveRenderAction(
  input: ScheduleRenderInput,
): Promise<Result<{ jobId: string; allocatedMcu: number }, GrowthV14ActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
  if (!gate.ok) {
    return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
  }

  const probedSparseData = await probeUserSparseDataFromD1(user.id);
  if (probedSparseData) {
    const probedDecision = evaluateSparseDataGrowthGate(probedSparseData);
    if (!probedDecision.allowHalfKellyAllocation) {
      return failure({ code: 'SPARSE_DATA_HOLD', message: probedDecision.reason });
    }
  }

  const allocation = validateAndAllocatePredictiveRender(input);
  if (!allocation.ok) {
    return allocation;
  }

  const kellyResult = allocation.value;
  const jobId = `pred_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

  const job = await createPredictiveRenderJob({
    id: jobId,
    userId: user.id,
    scriptId: input.scriptId,
    mabArmId: input.mabArmId,
    deliberationScore: input.deliberationScore,
    kellyAllocationFraction: kellyResult.boundedFraction,
    allocatedMcu: kellyResult.allocatedMcu,
  });

  if (!job) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to record job in database' });
  }

  try {
    await inngest.send({
      name: 'growth/v14.render.schedule',
      data: {
        jobId,
        userId: user.id,
        scriptId: input.scriptId,
        allocatedMcu: kellyResult.allocatedMcu,
        deliberationScore: input.deliberationScore,
      },
    });
  } catch (error) {
    await updateJobStatusInD1(jobId, 'FAILED', 0, undefined, 'inngest_dispatch_failed');
    logger.error(
      '[predictive-render-actions] Inngest dispatch failed',
      error instanceof Error ? error : undefined,
    );
    return failure({
      code: 'INTERNAL_ERROR',
      message: 'Inngest dispatch failed',
    });
  }

  return success({ jobId, allocatedMcu: kellyResult.allocatedMcu });
}

/**
 * Retrieves the user's recent predictive render jobs for the growth cockpit.
 */
export async function getUserPredictiveJobsAction(): Promise<
  Result<PredictiveRenderJob[], GrowthV14ActionError>
> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
  if (!gate.ok) {
    return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
  }

  const jobs = await getJobsForUser(user.id, 20);
  return success(jobs);
}
