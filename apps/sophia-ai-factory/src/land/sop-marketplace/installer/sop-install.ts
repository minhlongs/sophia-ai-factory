/**
 * SOP Marketplace Install Action
 * Layer: LAND (Business Workflow)
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getSopInstallLimit } from '@/seed/config/tiers';
import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getSopListing,
  createSopInstall as dbCreateSopInstall,
} from '@/seed/db/marketplace-ops';
import { captureSopInstalled } from '@/tree/signals/posthog-capture';
import type { InstallResult } from './types';
import {
  CREATOR_MARKETPLACE_V2_ENABLED,
  marketplaceTemporarilyUnavailableError,
} from '../availability';

export async function installSop(listingId: string): Promise<InstallResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }
    if (!CREATOR_MARKETPLACE_V2_ENABLED) {
      return failure(marketplaceTemporarilyUnavailableError());
    }

    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    const listing = await getSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'LISTING_NOT_FOUND', message: 'SOP listing not found' });
    }
    if (listing.status !== 'published') {
      return failure({ code: 'LISTING_NOT_PUBLISHED', message: 'SOP listing is not published' });
    }
    if (typeof listing.price_cents !== 'number' || listing.price_cents !== 0) {
      return failure({
        code: 'PAYMENT_REQUIRED',
        message: 'Paid SOP listings require a verified checkout order (currently disabled)',
      });
    }

    const existingRow = await d1
      .prepare(`SELECT COUNT(*) as count FROM sop_installs WHERE user_id = ? AND listing_id = ? AND status = 'active'`)
      .bind(user.id, listingId)
      .first<{ count: number }>();

    if (existingRow && existingRow.count > 0) {
      return failure({ code: 'ALREADY_INSTALLED', message: 'You have already installed this SOP' });
    }

    const tier = await resolveUserTier(user.id);
    const limit = getSopInstallLimit(tier);
    const activeCountRow = await d1
      .prepare(`SELECT COUNT(*) as count FROM sop_installs WHERE user_id = ? AND status = 'active'`)
      .bind(user.id)
      .first<{ count: number }>();

    const activeCount = activeCountRow?.count ?? 0;
    if (activeCount >= limit) {
      return failure({
        code: 'INSTALL_LIMIT_REACHED',
        message: `SOP install limit reached: ${activeCount}/${limit} active installs`,
      });
    }

    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';
    const licenseId = crypto.randomUUID();

    try {
      await dbCreateSopInstall(
        d1,
        { listing_id: listing.id, user_id: user.id, license_id: licenseId, price_cents: listing.price_cents, commission_id: null },
        tenantId
      );
    } catch (createErr) {
      const errStr = createErr instanceof Error ? createErr.message : String(createErr);
      if (errStr.includes('UNIQUE constraint failed') || errStr.includes('constraint')) {
        return failure({ code: 'ALREADY_INSTALLED', message: 'You have already installed this SOP' });
      }
      throw createErr;
    }

    captureSopInstalled({ distinctId: user.id, listingId: listing.id });
    logger.info('[InstallSop] SOP installed', { userId: user.id, listingId: listing.id, licenseId });
    return success({ licenseId });
  } catch (err) {
    logger.error('[InstallSop] Unexpected error', err instanceof Error ? err : new Error(String(err)));
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
