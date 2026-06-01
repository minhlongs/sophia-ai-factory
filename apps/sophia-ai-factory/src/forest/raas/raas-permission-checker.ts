/**
 * RaaS Permission Checker — revoke, extend, and validation count operations
 * Create/read/list CRUD lives in raas-license-crud.ts
 *
 * @module raas/raas-permission-checker
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  RaasLicenseRow as RaasLicense,
  RaasLicenseUpdate,
} from '@/land/supabase/types';
import { getLicenseByNonce } from './raas-license-crud';

export type { LicenseCreationParams } from './raas-license-crud';
export { createLicense, getLicenseByNonce, getLicenses } from './raas-license-crud';

/** Revoke a license by nonce */
export async function revokeLicense(nonce: string, revokedBy?: string): Promise<RaasLicense> {
  const db = createServerClient();
  const revokedAt = Math.floor(Date.now() / 1000);

  const existingLicense = await getLicenseByNonce(nonce);
  if (!existingLicense) {
    throw new Error(`License not found: ${nonce}`);
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

/** Extend license expiration by N days */
export async function extendLicense(nonce: string, days: number, extendedBy?: string): Promise<RaasLicense> {
  const db = createServerClient();

  const existingLicense = await getLicenseByNonce(nonce);
  if (!existingLicense) throw new Error(`License not found: ${nonce}`);
  if (existingLicense.is_revoked) throw new Error(`Cannot extend revoked license: ${nonce}`);

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
