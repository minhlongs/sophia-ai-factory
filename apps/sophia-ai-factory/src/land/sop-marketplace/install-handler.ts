/**
 * SOP Installation Handler
 *
 * 'use server' module for installing and uninstalling SOPs from the Creator Marketplace.
 * Validates auth, listing status, duplicate installs, tier limits, and records
 * creator commission on successful install.
 *
 * @module land/sop-marketplace/install-handler
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { requireOrgMembership } from '@/seed/db/org-membership';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getSopInstallLimit } from '@/seed/config/tiers';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  getSopListing,
  createSopInstall as dbCreateSopInstall,
  getSopInstall as dbGetSopInstall,
} from '@/seed/db/marketplace-ops';
import { recordSopSaleCommission } from './commission-split'
import { captureSopInstalled } from '@/tree/signals/posthog-capture';

// ── Actions ─────────────────────────────────────────────────────────────

/**
 * Install an SOP from the Creator Marketplace.
 *
 * Flow: auth gate, listing lookup, published check, duplicate check,
 * tier limit check, commission recording, install creation.
 */
export async function installSop(
  listingId: string,
): Promise<
  Result<
    { licenseId: string },
    {
      code:
        | 'NOT_AUTHENTICATED'
        | 'LISTING_NOT_FOUND'
        | 'LISTING_NOT_PUBLISHED'
        | 'ALREADY_INSTALLED'
        | 'INSTALL_LIMIT_REACHED'
        | 'DB_ERROR';
      message: string;
    }
  >
> {
  try {
    // 1. Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // 2. Get database binding
    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // 3. Get listing
    const listing = await getSopListing(d1, listingId);
    if (!listing) {
      return failure({ code: 'LISTING_NOT_FOUND', message: 'SOP listing not found' });
    }

    // 4. Check listing status is 'published'
    if (listing.status !== 'published') {
      return failure({ code: 'LISTING_NOT_PUBLISHED', message: 'SOP listing is not published' });
    }

    // 5. Check user hasn't already installed this SOP
    const existingRow = await d1
      .prepare(
        `SELECT COUNT(*) as count FROM sop_installs
         WHERE user_id = ? AND listing_id = ? AND status = 'active'`,
      )
      .bind(user.id, listingId)
      .first<{ count: number }>();

    if (existingRow && existingRow.count > 0) {
      return failure({
        code: 'ALREADY_INSTALLED',
        message: 'You have already installed this SOP',
      });
    }

    // 6. Get user tier and check install limit
    const tier = await getUserTier(user.id);
    const limit = getSopInstallLimit(tier);

    const activeCountRow = await d1
      .prepare(
        `SELECT COUNT(*) as count FROM sop_installs
         WHERE user_id = ? AND status = 'active'`,
      )
      .bind(user.id)
      .first<{ count: number }>();

    const activeCount = activeCountRow?.count ?? 0;
    if (activeCount >= limit) {
      return failure({
        code: 'INSTALL_LIMIT_REACHED',
        message: `SOP install limit reached: ${activeCount}/${limit} active installs`,
      });
    }

    // 7. Resolve tenant from org membership
    const orgResult = await requireOrgMembership(user.id);
    const tenantId = orgResult.authorized ? orgResult.orgId : 'default';

    // 8. Generate license ID
    const licenseId = crypto.randomUUID();

    // 9. Record commission first (need the commission_ledger id for install record)
    const commissionId = await recordSopSaleCommission(d1, {
      creatorId: listing.creator_id,
      listingId: listing.id,
      templateId: listing.sop_template_id,
      licenseId,
      priceCents: listing.price_cents,
      paymentId: 'manual_' + licenseId,
    });

    // 10. Create the install record with commission reference
    await dbCreateSopInstall(
      d1,
      {
        listing_id: listing.id,
        user_id: user.id,
        license_id: licenseId,
        price_cents: listing.price_cents,
        commission_id: commissionId,
      },
      tenantId,
    );

    // Funnel tracking — fire-and-forget sop-installed event
    captureSopInstalled({ distinctId: user.id, listingId: listing.id })

    logger.info('[InstallSop] SOP installed', {
      userId: user.id,
      listingId: listing.id,
      licenseId,
    });

    return success({ licenseId });
  } catch (err) {
    logger.error(
      '[InstallSop] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}

/**
 * Uninstall an SOP license.
 *
 * Marks the install as 'uninstalled' with a timestamp.
 * Commission is NOT reversed (already earned by creator).
 */
export async function uninstallSop(
  licenseId: string,
): Promise<
  Result<
    { success: boolean },
    {
      code: 'NOT_AUTHENTICATED' | 'INSTALL_NOT_FOUND' | 'NOT_OWNER' | 'DB_ERROR';
      message: string;
    }
  >
> {
  try {
    // 1. Auth gate
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'NOT_AUTHENTICATED', message: 'Authentication required' });
    }

    // 2. Get database binding
    const d1 = await getD1();
    if (!d1) {
      return failure({ code: 'DB_ERROR', message: 'Database not available' });
    }

    // 3. Get install by license_id
    const install = await dbGetSopInstall(d1, licenseId);
    if (!install) {
      return failure({ code: 'INSTALL_NOT_FOUND', message: 'SOP install not found' });
    }

    // 4. Verify ownership
    if (install.user_id !== user.id) {
      return failure({ code: 'NOT_OWNER', message: 'You do not own this SOP install' });
    }

    // 5. Update status to 'uninstalled'
    const now = Math.floor(Date.now() / 1000);
    const updateResult = await d1
      .prepare(
        `UPDATE sop_installs SET status = 'uninstalled', uninstalled_at = ? WHERE license_id = ?`,
      )
      .bind(now, licenseId)
      .run();

    if (!updateResult.success) {
      throw new Error('Failed to uninstall SOP');
    }

    logger.info('[UninstallSop] SOP uninstalled', {
      userId: user.id,
      licenseId,
    });

    return success({ success: true });
  } catch (err) {
    logger.error(
      '[UninstallSop] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return failure({ code: 'DB_ERROR', message: 'An unexpected error occurred' });
  }
}
