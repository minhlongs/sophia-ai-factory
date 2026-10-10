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
import type {
  PartnerProfile,
  PartnerSubReseller,
  CascadeOverrideResult,
  ResellerHierarchyTreeResult,
} from '@/tree/partners/types';
import type { ResellerActionError, BindSubResellerActionInput } from './reseller-types';

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
