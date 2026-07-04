/**
 * RaaS Permission Checker — revoke, extend, and validation count operations
 * Create/read/list CRUD lives in raas-license-crud.ts
 *
 * @module raas/raas-permission-checker
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { requireManagerRole } from '@/seed/db/org-membership';
import type {
  RaasLicenseRow as RaasLicense,
  RaasLicenseUpdate,
} from '@/tree/database/supabase-types';
import { getLicenseByNonce } from './raas-license-crud';

export type { LicenseCreationParams } from './raas-license-crud';
export { createLicense, getLicenseByNonce, getLicenses } from './raas-license-crud';

/**
 * Resolve the org_id for a license by looking up the license owner's org membership.
 */
async function getLicenseOrgId(nonce: string): Promise<string | null> {
  const db = createServerClient();
  const license = await getLicenseByNonce(nonce);
  if (!license?.user_id) return null;

  const { data: membership } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', license.user_id)
    .maybeSingle();

  return (membership as { org_id: string } | null)?.org_id ?? null;
}

/**
 * Verify that a user has admin/owner access to the license's org.
 * Throws if the user lacks permission.
 */
async function requireLicenseAdmin(nonce: string, userId: string): Promise<void> {
  if (!userId) throw new Error('Authentication required');

  const result = await requireManagerRole(userId);
  if (!result.authorized) {
    throw new Error(result.error);
  }

  // Verify the user is in the same org as the license owner
  const licenseOrgId = await getLicenseOrgId(nonce);
  if (licenseOrgId && result.orgId !== licenseOrgId) {
    throw new Error('Forbidden: user does not belong to the license owner organization');
  }
}

/** Revoke a license by nonce (owner/admin only) */
export async function revokeLicense(nonce: string, revokedBy?: string): Promise<RaasLicense> {
  const db = createServerClient();
  const revokedAt = Math.floor(Date.now() / 1000);

  const existingLicense = await getLicenseByNonce(nonce);
  if (!existingLicense) {
    throw new Error(`License not found: ${nonce}`);
  }

  // Role check: only owner/admin can revoke
  if (revokedBy) {
    await requireLicenseAdmin(nonce, revokedBy);
  }

  const updateData: RaasLicenseUpdate = {
    is_revoked: true,
    revoked_at: revokedAt,
    revoked_by: revokedBy ?? null,
  };

  const { data, error } = await db.from('raas_licenses').update(updateData).eq('nonce', nonce).select().single();

  if (error) {
    logger.error(`Failed to revoke license ${nonce}`, toError(error));
    throw new Error(`Database error: ${error.message}`);
  }

  return data as unknown as RaasLicense;
}

/** Extend license expiration by N days (owner/admin only) */
export async function extendLicense(nonce: string, days: number, extendedBy?: string): Promise<RaasLicense> {
  const db = createServerClient();

  const existingLicense = await getLicenseByNonce(nonce);
  if (!existingLicense) throw new Error(`License not found: ${nonce}`);
  if (existingLicense.is_revoked) throw new Error(`Cannot extend revoked license: ${nonce}`);

  // Role check: only owner/admin can extend
  if (extendedBy) {
    await requireLicenseAdmin(nonce, extendedBy);
  }

  const now = Math.floor(Date.now() / 1000);
  const currentExpiresAt = existingLicense.expires_at ?? now;
  const newExpiresAt = currentExpiresAt + (days * 24 * 60 * 60);

  const { data, error } = await db
    .from('raas_licenses')
    .update({ expires_at: newExpiresAt } as RaasLicenseUpdate)
    .eq('nonce', nonce)
    .select()
    .single();

  if (error) {
    logger.error(`Failed to extend license ${nonce}`, toError(error));
    throw new Error(`Database error: ${error.message}`);
  }

  logger.info(`License extended: ${nonce} by ${days} days (by ${extendedBy ?? 'system'})`);
  return data as unknown as RaasLicense;
}

/** Increment validation count in license metadata */
export async function incrementValidationCount(nonce: string): Promise<void> {
  const db = createServerClient();
  const license = await getLicenseByNonce(nonce);

  if (!license) {
    logger.warn(`Cannot increment validation count - license ${nonce} not found`);
    return;
  }

  const currentMetadata = (license.metadata as { validateCount?: number }) ?? {};
  const newCount = (currentMetadata.validateCount ?? 0) + 1;

  const { error } = await db
    .from('raas_licenses')
    .update({ metadata: { ...currentMetadata, validateCount: newCount } })
    .eq('nonce', nonce);

  if (error) {
    logger.error(`Failed to increment validation count for ${nonce}`, toError(error));
  }
}
