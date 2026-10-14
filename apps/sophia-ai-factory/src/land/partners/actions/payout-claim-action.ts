'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  createLicensePool,
  allocatePoolQuota,
  recordMcuConsumption,
} from '@/tree/partners/license-pooling';
import type {
  PartnerLicensePool,
  AllocateLicensePoolResult,
  RecordMcuConsumptionResult,
} from '@/tree/partners/types';
import type {
  ResellerActionError,
  CreateLicensePoolActionInput,
  AllocatePoolQuotaActionInput,
  RecordMcuConsumptionActionInput,
} from './reseller-types';
import {
  verifyPartnerOwnerAccess,
  verifyPoolOwnerAccess,
} from './payout-claim-helpers';

/**
 * Creates a bulk license and MCU quota pool for an agency.
 */
export async function createLicensePoolAction(
  input: CreateLicensePoolActionInput,
): Promise<Result<PartnerLicensePool, ResellerActionError>> {
  try {
    const auth = await verifyPartnerOwnerAccess(
      input.partnerId,
      'Authentication required to create license pools',
      'Only partner owner can create license pools',
    );
    if (!auth.ok) return auth.result;

    const result = await createLicensePool(
      auth.db, input.partnerId, input.poolName, input.seats, input.mcuCredits, input.unitPriceCents,
      {
        autoTopupEnabled: input.autoTopupEnabled, autoTopupThresholdMcu: input.autoTopupThresholdMcu,
        autoTopupAmountMcu: input.autoTopupAmountMcu, periodStart: input.periodStart,
        periodEnd: input.periodEnd, autoRenew: input.autoRenew,
      },
    );

    if (!result.success || !result.pool) {
      return failure({
        code: result.error ?? 'CREATE_FAILED',
        message: `Failed to create license pool: ${result.error ?? 'Unknown error'}`,
      });
    }

    logger.info('Created license pool', { poolId: result.pool.id, partnerId: input.partnerId });
    return success(result.pool);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to create license pool', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * Allocates seats and MCU quota from a pool to a subaccount.
 */
export async function allocatePoolQuotaAction(
  input: AllocatePoolQuotaActionInput,
): Promise<Result<AllocateLicensePoolResult, ResellerActionError>> {
  try {
    const auth = await verifyPoolOwnerAccess(input.poolId);
    if (!auth.ok) return auth.result;

    const result = await allocatePoolQuota(
      auth.db,
      input.poolId,
      input.subaccountId,
      input.seats,
      input.mcuCredits,
    );

    if (!result.success) {
      return failure({
        code: result.error ?? 'ALLOCATION_FAILED',
        message: `Failed to allocate quota: ${result.error ?? 'Insufficient capacity'}`,
      });
    }

    logger.info('Allocated license pool quota', {
      poolId: input.poolId,
      subaccountId: input.subaccountId,
      seats: input.seats,
      mcuCredits: input.mcuCredits,
    });

    return success(result);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to allocate pool quota', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * Records MCU consumption for a subaccount drawing from a pool.
 */
export async function recordMcuConsumptionAction(
  input: RecordMcuConsumptionActionInput,
): Promise<Result<RecordMcuConsumptionResult, ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to record consumption' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const result = await recordMcuConsumption(
      db,
      input.poolId,
      input.subaccountId,
      input.mcuConsumed,
    );

    if (!result.success) {
      return failure({
        code: result.error ?? 'CONSUMPTION_FAILED',
        message: `Failed to record consumption: ${result.error ?? 'Overdraft prevented'}`,
      });
    }

    return success(result);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to record MCU consumption', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}
