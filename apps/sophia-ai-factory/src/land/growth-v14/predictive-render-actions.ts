/**
 * Land Layer: Growth Triad v14 Authenticated Server Actions
 * Dispatches Kelly-budgeted predictive renders and provides telemetry queries.
 * Layer: land/growth-v14 | Max LOC: < 200 | Zero :any
 * @module land/growth-v14/predictive-render-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { inngest } from '@/seed/inngest/client';
import {
  createPredictiveRenderJob,
  getJobsForUser,
} from './predictive-render-coordinator';
import { PredictiveRenderJob } from '@/seed/types/growth-triad-v14';
import { calculateKellyAllocation } from '@/tree/growth-v14/kelly-allocator';

export interface GrowthV14ActionError {
  code: 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  message: string;
}

export interface ScheduleRenderInput {
  scriptId: string;
  deliberationScore: number;
  availableMcuBudget: number;
  /** Must come from persisted measured cohort data, never a hardcoded default. */
  projectedRoas: number;
  winProbability: number;
  measuredSampleSize: number;
  /** Cohort/window/report identifier that produced the two numbers above. */
  evidenceSource: string;
  mabArmId?: string;
}

/**
 * Calculates Kelly budget allocation, persists the job, and enqueues Inngest worker.
 */
export async function schedulePredictiveRenderAction(
  input: ScheduleRenderInput
): Promise<Result<{ jobId: string; allocatedMcu: number }, GrowthV14ActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  if (!input.scriptId || input.availableMcuBudget <= 0) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Valid scriptId and budget required' });
  }
  // No fabricated win rate / ROAS / cohort. An unmeasured input cannot justify
  // spending render budget, nor can an immature sample be called a winner.
  if (
    !Number.isFinite(input.winProbability) ||
    input.winProbability < 0 || input.winProbability > 1 ||
    !Number.isFinite(input.projectedRoas) || input.projectedRoas <= 0 ||
    !Number.isInteger(input.measuredSampleSize) || input.measuredSampleSize < 30 ||
    !input.evidenceSource.trim()
  ) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: 'Measured winProbability, projectedRoas, sampleSize >= 30 and evidenceSource are required',
    });
  }

  const kellyResult = calculateKellyAllocation(
    {
      winProbability: input.winProbability,
      projectedRoas: input.projectedRoas,
      halfKelly: true,
      minFraction: 0.05,
      maxFraction: 0.4,
    },
    input.availableMcuBudget
  );

  if (kellyResult.allocatedMcu <= 0) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: 'No approved positive-expectancy budget; render not scheduled',
    });
  }

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
    return failure({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Inngest dispatch failed',
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

  const jobs = await getJobsForUser(user.id, 20);
  return success(jobs);
}
