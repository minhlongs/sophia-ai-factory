/**
 * RaaS Permission Checker
 *
 * CRUD operations for RaaS licenses with permission enforcement.
 * Handles create, read, revoke, extend, and validation count tracking.
 *
 * @module raas/raas-permission-checker
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { Tier } from '@/types';
import type {
  RaasLicenseRow as RaasLicense,
  RaasLicenseInsert,
  RaasLicenseUpdate,
  Json,
} from '@/lib/supabase/types';
import type { LicenseSummary, LicenseListResponse, LicenseTier } from '@/lib/raas-schema';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

interface LicenseCreationParams {
  tier: Tier;
  nonce: string;
  keyHash: string;
  expiresAt: number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

// -------------------------------------------------------------------------
// License CRUD
// -------------------------------------------------------------------------

/**
 * Create a new license record
 */
export async function createLicense(params: LicenseCreationParams): Promise<RaasLicense> {
  const db = createServerClient();
  const createdAt = Math.floor(Date.now() / 1000);

  const licenseData: RaasLicenseInsert = {
    key_hash: params.keyHash,
    tier: params.tier as string,
    nonce: params.nonce,
    expires_at: params.expiresAt,
    created_at: createdAt,
    created_by: params.createdBy ?? null,
    metadata: (params.metadata ?? {}) as Json,
    is_revoked: false,
  };

  const { data, error } = await db.from('raas_licenses').insert(licenseData).select().single();

  if (error) {
    logger.error('Failed to create license in database', error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data as RaasLicense;
}

/**
 * Get license by nonce (returns null if not found)
 */
export async function getLicenseByNonce(nonce: string): Promise<RaasLicense | null> {
  const db = createServerClient();

  const { data, error } = await db.from('raas_licenses').select('*').eq('nonce', nonce).single();

  if (error && error.code !== 'PGRST116') {
    logger.error(`Failed to fetch license ${nonce}`, error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Get all licenses with pagination and optional filters
 */
export async function getLicenses(params: {
  tier?: Tier;
  search?: string;
  status?: 'active' | 'revoked' | 'expired';
  page?: number;
  limit?: number;
}): Promise<LicenseListResponse> {
  const db = createServerClient();
  const { tier, search, status, page = 1, limit = 20 } = params;

  let query = db.from('raas_licenses').select('*', { count: 'exact' });

  if (tier) query = query.eq('tier', tier);

  const now = Math.floor(Date.now() / 1000);
  if (status === 'revoked') {
    query = query.eq('is_revoked', true);
  } else if (status === 'active') {
    query = query.eq('is_revoked', false).or(`expires_at.is.null,expires_at.gt.${now}`);
  } else if (status === 'expired') {
    query = query.eq('is_revoked', false).lt('expires_at', now);
  }

  if (search) query = query.ilike('nonce', `%${search}%`);

  query = query.order('created_at', { ascending: false });

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error('Failed to fetch licenses', error);
    throw new Error(`Database error: ${error.message}`);
  }

  const licenses: LicenseSummary[] = (data || []).map((license: RaasLicense) => ({
    id: license.nonce,
    tier: license.tier as LicenseTier,
    createdAt: license.created_at,
    expiresAt: license.expires_at,
    isRevoked: license.is_revoked,
    revokedAt: license.revoked_at ?? undefined,
    validateCount: (license.metadata as { validateCount?: number })?.validateCount || 0,
    metadata: license.metadata,
  }));

  const total = count || 0;
  return { licenses, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Revoke a license by nonce
 */
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
    logger.error(`Failed to revoke license ${nonce}`, error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data as RaasLicense;
}

/**
 * Extend license expiration by N days
 */
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
    logger.error(`Failed to extend license ${nonce}`, error);
    throw new Error(`Database error: ${error.message}`);
  }

  logger.info(`License extended: ${nonce} by ${days} days`);
  return data as RaasLicense;
}

/**
 * Increment validation count in license metadata
 */
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
    logger.error(`Failed to increment validation count for ${nonce}`, error);
  }
}
