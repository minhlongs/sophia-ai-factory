'use server';

import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  bindSubReseller,
  getResellerHierarchyTree,
  calculateCascadeOverride,
} from '@/tree/partners/reseller-hierarchy';
import type {
  PartnerSubReseller,
  CascadeOverrideResult,
  ResellerHierarchyTreeResult,
} from '@/tree/partners/types';
import type { ResellerActionError, BindSubResellerActionInput } from './reseller-types';
import { verifyMasterPartnerOwnership } from './tier-manager-helpers';

/**
 * Binds a Sub-Agency to an authenticated Master Agency.
 */
export async function bindSubResellerAction(
  input: BindSubResellerActionInput,
): Promise<Result<PartnerSubReseller, ResellerActionError>> {
  try {
    const subPartnerId = input.subPartnerId?.trim();
    const verified = await verifyMasterPartnerOwnership(
      subPartnerId ? input.masterPartnerId : undefined,
      {
        unauthorizedMessage: 'Authentication required to manage reseller hierarchy',
        invalidInputMessage: 'Master partner ID and Sub partner ID are required',
        forbiddenMessage: 'Only the master agency owner can bind sub-agencies',
      },
    );
    if (!verified.ok) return verified;

    const { db, masterPartnerId } = verified.value;
    const bindResult = await bindSubReseller(db, masterPartnerId, subPartnerId!, input.agreementRef);

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
    const verified = await verifyMasterPartnerOwnership(masterPartnerId, {
      unauthorizedMessage: 'Authentication required to view hierarchy',
      invalidInputMessage: 'Master partner ID is required',
      forbiddenMessage: 'Access denied to master partner hierarchy',
    });
    if (!verified.ok) return verified;

    const tree = await getResellerHierarchyTree(verified.value.db, verified.value.masterPartnerId);
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
