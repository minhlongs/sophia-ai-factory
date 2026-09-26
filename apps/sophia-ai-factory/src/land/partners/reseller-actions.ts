/**
 * Server Actions for Enterprise Reseller Federation & License Quota Pooling
 *
 * Implements authenticated Server Actions with Cloudflare D1 persistence,
 * multi-tier cascade override calculations, license pools, and quota allocations.
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/partners/*
 *
 * @module land/partners/reseller-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  bindSubReseller,
  getResellerHierarchyTree,
  calculateCascadeOverride,
} from '@/tree/partners/reseller-hierarchy';
import {
  createLicensePool,
  allocatePoolQuota,
  recordMcuConsumption,
  getLicensePoolById,
  getPartnerLicensePools,
} from '@/tree/partners/license-pooling';
import type {
  PartnerProfile,
  PartnerSubReseller,
  PartnerLicensePool,
  CascadeOverrideResult,
  ResellerHierarchyTreeResult,
  AllocateLicensePoolResult,
  RecordMcuConsumptionResult,
} from '@/tree/partners/types';

export interface ResellerActionError {
  code: string;
  message: string;
}

export interface BindSubResellerActionInput {
  masterPartnerId: string;
  subPartnerId: string;
  agreementRef?: string | null;
}

export interface CreateLicensePoolActionInput {
  partnerId: string;
  poolName: string;
  seats: number;
  mcuCredits: number;
  unitPriceCents: number;
  autoTopupEnabled?: boolean;
  autoTopupThresholdMcu?: number;
  autoTopupAmountMcu?: number;
  periodStart?: number;
  periodEnd?: number;
  autoRenew?: boolean;
}

export interface AllocatePoolQuotaActionInput {
  poolId: string;
  subaccountId: string;
  seats: number;
  mcuCredits: number;
}

export interface RecordMcuConsumptionActionInput {
  poolId: string;
  subaccountId: string;
  mcuConsumed: number;
}

/**
 * Binds a Sub-Agency to an authenticated Master Agency.
 */
export async function bindSubResellerAction(
  input: BindSubResellerActionInput,
): Promise<Result<PartnerSubReseller, ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to manage reseller hierarchy' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const masterPartnerId = input.masterPartnerId?.trim();
    const subPartnerId = input.subPartnerId?.trim();

    if (!masterPartnerId || !subPartnerId) {
      return failure({ code: 'INVALID_INPUT', message: 'Master partner ID and Sub partner ID are required' });
    }

    // Verify authenticated user owns the master partner profile or is admin
    const master = await db
      .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
      .bind(masterPartnerId)
      .first<PartnerProfile>();

    if (!master) {
      return failure({ code: 'NOT_FOUND', message: 'Master partner profile not found' });
    }

    if (master.user_id !== user.id) {
      return failure({ code: 'FORBIDDEN', message: 'Only the master agency owner can bind sub-agencies' });
    }

    const bindResult = await bindSubReseller(db, masterPartnerId, subPartnerId, input.agreementRef);

    if (!bindResult.success || !bindResult.binding) {
      return failure({
        code: bindResult.error ?? 'BIND_FAILED',
        message: `Failed to bind sub-reseller: ${bindResult.error ?? 'Unknown error'}`,
      });
    }

    logger.info('Bound sub-reseller successfully', {
      masterPartnerId,
      subPartnerId,
      bindingId: bindResult.binding.id,
    });

    return success(bindResult.binding);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to bind sub-reseller', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * Retrieves the full reseller hierarchy tree for an authenticated Master Agency.
 */
export async function getResellerHierarchyTreeAction(
  masterPartnerId: string,
): Promise<Result<ResellerHierarchyTreeResult, ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view hierarchy' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const trimmedId = masterPartnerId?.trim();
    if (!trimmedId) {
      return failure({ code: 'INVALID_INPUT', message: 'Master partner ID is required' });
    }

    const master = await db
      .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
      .bind(trimmedId)
      .first<PartnerProfile>();

    if (!master) {
      return failure({ code: 'NOT_FOUND', message: 'Master partner profile not found' });
    }

    if (master.user_id !== user.id) {
      return failure({ code: 'FORBIDDEN', message: 'Access denied to master partner hierarchy' });
    }

    const tree = await getResellerHierarchyTree(db, trimmedId);
    return success(tree);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to get reseller hierarchy tree', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}

/**
 * Calculates the cascade commission override with zero penny leakage.
 */
export async function calculateCascadeOverrideAction(
  mrrCents: number,
  subTierRatePct: number,
  hasActiveMaster: boolean,
  masterPartnerId?: string | null,
): Promise<Result<CascadeOverrideResult, ResellerActionError>> {
  try {
    const result = calculateCascadeOverride(mrrCents, subTierRatePct, hasActiveMaster, masterPartnerId);
    return success(result);
  } catch (rawError) {
    const err = toError(rawError);
    return failure({ code: 'CALCULATION_ERROR', message: err.message });
  }
}

/**
 * Creates a bulk license and MCU quota pool for an agency.
 */
export async function createLicensePoolAction(
  input: CreateLicensePoolActionInput,
): Promise<Result<PartnerLicensePool, ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to create license pools' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await db
      .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
      .bind(input.partnerId)
      .first<PartnerProfile>();

    if (!partner) {
      return failure({ code: 'NOT_FOUND', message: 'Partner profile not found' });
    }

    if (partner.user_id !== user.id) {
      return failure({ code: 'FORBIDDEN', message: 'Only partner owner can create license pools' });
    }

    const result = await createLicensePool(
      db,
      input.partnerId,
      input.poolName,
      input.seats,
      input.mcuCredits,
      input.unitPriceCents,
      {
        autoTopupEnabled: input.autoTopupEnabled,
        autoTopupThresholdMcu: input.autoTopupThresholdMcu,
        autoTopupAmountMcu: input.autoTopupAmountMcu,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        autoRenew: input.autoRenew,
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
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to allocate quota' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    // Verify user owns the partner owning the pool
    const pool = await getLicensePoolById(db, input.poolId);
    if (!pool) {
      return failure({ code: 'NOT_FOUND', message: 'License pool not found' });
    }

    const partner = await db
      .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
      .bind(pool.partner_id)
      .first<PartnerProfile>();

    if (!partner || partner.user_id !== user.id) {
      return failure({ code: 'FORBIDDEN', message: 'Access denied to allocate from this pool' });
    }

    const result = await allocatePoolQuota(
      db,
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

/**
 * Retrieves all license pools for an authenticated partner.
 */
export async function getPartnerLicensePoolsAction(
  partnerId: string,
): Promise<Result<PartnerLicensePool[], ResellerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to view license pools' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await db
      .prepare('SELECT id, user_id FROM partner_profiles WHERE id = ?')
      .bind(partnerId)
      .first<PartnerProfile>();

    if (!partner || partner.user_id !== user.id) {
      return failure({ code: 'FORBIDDEN', message: 'Access denied to partner license pools' });
    }

    const pools = await getPartnerLicensePools(db, partnerId);
    return success(pools);
  } catch (rawError) {
    const err = toError(rawError);
    logger.error('Failed to list partner license pools', { error: err.message });
    return failure({ code: 'INTERNAL_ERROR', message: err.message });
  }
}
