/**
 * Land Layer: Growth Triad v14 Predictive Render Validation & Sparse-Data Guard
 * Validates measured cohort inputs, enforces Sparse-Data Hold, and allocates Half-Kelly MCU.
 * Layer: land/growth-v14
 * @module land/growth-v14/predictive-render-validation
 */

import { success, failure, type Result } from '@/seed/types/result';
import {
  calculateKellyAllocation,
  type KellyAllocationResult,
} from '@/tree/growth-v14/kelly-allocator';
import {
  evaluateSparseDataGrowthGate,
  type SparseDataGateInput,
} from '@/tree/growth/sparse-data-growth-guard';

export interface GrowthV14ActionError {
  code:
    | 'UNAUTHORIZED'
    | 'FEATURE_LOCKED'
    | 'SPARSE_DATA_HOLD'
    | 'VALIDATION_ERROR'
    | 'INTERNAL_ERROR';
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
  /** Optional channel telemetry density snapshot to enforce Track B Sparse-Data Hold. */
  sparseData?: SparseDataGateInput;
}

/**
 * Validates cohort evidence, checks Sparse-Data Hold when supplied, and computes Kelly budget.
 */
export function validateAndAllocatePredictiveRender(
  input: ScheduleRenderInput,
): Result<KellyAllocationResult, GrowthV14ActionError> {
  if (!input.scriptId || input.availableMcuBudget <= 0) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Valid scriptId and budget required' });
  }

  if (input.sparseData) {
    const sparseDecision = evaluateSparseDataGrowthGate(input.sparseData);
    if (!sparseDecision.allowHalfKellyAllocation) {
      return failure({
        code: 'SPARSE_DATA_HOLD',
        message: sparseDecision.reason,
      });
    }
  }

  if (
    !Number.isFinite(input.winProbability) ||
    input.winProbability < 0 ||
    input.winProbability > 1 ||
    !Number.isFinite(input.projectedRoas) ||
    input.projectedRoas <= 0 ||
    !Number.isInteger(input.measuredSampleSize) ||
    input.measuredSampleSize < 30 ||
    !input.evidenceSource.trim()
  ) {
    return failure({
      code: 'VALIDATION_ERROR',
      message:
        'Measured winProbability, projectedRoas, sampleSize >= 30 and evidenceSource are required',
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
    input.availableMcuBudget,
  );

  if (kellyResult.allocatedMcu <= 0) {
    return failure({
      code: 'VALIDATION_ERROR',
      message: 'No approved positive-expectancy budget; render not scheduled',
    });
  }

  return success(kellyResult);
}
