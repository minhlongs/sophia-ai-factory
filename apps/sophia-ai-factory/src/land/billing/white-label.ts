/**
 * Server Actions for white-label branding provisioning (MASTER-tier only).
 *
 * Wraps the tree-layer org-branding-repo with auth and org permission checks.
 * All functions return Result<T, E> — no thrown exceptions across action boundaries.
 *
 * @module land/billing/white-label
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { getOrgBranding, upsertOrgBranding } from '@/tree/branding/org-branding-repo';
import { checkOrgPermission } from '@/seed/db/org-membership-ext';
import type { OrgBrandingRow, OrgBrandingInput } from '@/tree/branding/org-branding-repo';

// Re-export types for consumers
export type { OrgBrandingRow, OrgBrandingInput };

/**
 * Update white-label branding for an organization.
 * Requires the current user to have 'org:branding' permission in the org.
 */
export async function updateWhiteLabelBranding(
  orgId: string,
  branding: OrgBrandingInput,
): Promise<Result<{ success: boolean }, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const permissionResult = await checkOrgPermission(db, orgId, user.id, 'org:branding');
    if (!permissionResult.ok) {
      return failure({ code: 'PERMISSION_CHECK_FAILED', message: permissionResult.error.message });
    }

    if (!permissionResult.value) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have permission to manage branding for this organization' });
    }

    await upsertOrgBranding(db, orgId, branding);

    logger.info('[WhiteLabel] Branding updated', { orgId, userId: user.id });
    return success({ success: true });
  } catch (err) {
    const error = toError(err);
    logger.error('[WhiteLabel] updateWhiteLabelBranding failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Get white-label branding for an organization.
 * Requires the current user to have 'org:branding' permission in the org.
 */
export async function getWhiteLabelBranding(
  orgId: string,
): Promise<Result<OrgBrandingRow | null, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    }

    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database not available' });
    }

    const permissionResult = await checkOrgPermission(db, orgId, user.id, 'org:branding');
    if (!permissionResult.ok) {
      return failure({ code: 'PERMISSION_CHECK_FAILED', message: permissionResult.error.message });
    }

    if (!permissionResult.value) {
      return failure({ code: 'FORBIDDEN', message: 'You do not have permission to view branding for this organization' });
    }

    const branding = await getOrgBranding(db, orgId);
    return success(branding);
  } catch (err) {
    const error = toError(err);
    logger.error('[WhiteLabel] getWhiteLabelBranding failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}
