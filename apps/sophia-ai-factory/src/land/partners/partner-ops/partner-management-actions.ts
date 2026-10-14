/**
 * Partner Registration & Dashboard Server Actions
 *
 * Layer: land/partners/partner-ops
 *
 * @module land/partners/partner-ops/partner-management-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  registerPartner,
  getPartnerByUserId,
  getPartnerDashboardData,
} from '@/tree/partners/partner-service';
import type {
  PartnerProfile,
  PartnerDashboardData,
  PartnerActionError,
  RegisterPartnerActionInput,
} from './types';

/**
 * Register the authenticated user as an agency or reseller partner.
 */
export async function registerPartnerAction(
  input: RegisterPartnerActionInput,
): Promise<Result<PartnerProfile, PartnerActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required to register as partner' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partnerName = input.partnerName?.trim();
    if (!partnerName || partnerName.length < 2) {
      return failure({ code: 'INVALID_INPUT', message: 'Partner / Agency name must be at least 2 characters' });
    }

    const profile = await registerPartner(db, {
      userId: user.id,
      tenantId: `tenant_${user.id}`,
      partnerName,
      partnerType: input.partnerType || 'agency',
      referralCode: input.referralCode,
      payoutRail: input.payoutRail,
      payoutDestinationJson: input.payoutDestinationJson,
    });

    logger.info('Partner registered successfully', { partnerId: profile.id, userId: user.id });
    return success(profile);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to register partner', { error: error.message });
    return failure({ code: 'REGISTRATION_FAILED', message: error.message });
  }
}

/**
 * Retrieve the current partner dashboard metrics and history for the authenticated user.
 */
export async function getPartnerDashboardAction(): Promise<
  Result<PartnerDashboardData | null, PartnerActionError>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database binding unavailable' });
    }

    const partner = await getPartnerByUserId(db, user.id);
    if (!partner) {
      return success(null);
    }

    const dashboard = await getPartnerDashboardData(db, partner.id);
    return success(dashboard);
  } catch (err) {
    const error = toError(err);
    logger.error('Failed to fetch partner dashboard', { error: error.message });
    return failure({ code: 'DASHBOARD_FETCH_FAILED', message: error.message });
  }
}
