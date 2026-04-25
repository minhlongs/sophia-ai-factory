/**
 * RaaS License CRUD — create, read, list operations
 * Mutation operations (revoke, extend, increment) live in raas-permission-checker.ts
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { Tier } from '@/types';
import type {
  RaasLicenseRow as RaasLicense,
  RaasLicenseInsert,
  Json,
} from '@/lib/supabase/types';
import type { LicenseSummary, LicenseListResponse, LicenseTier } from '@/lib/raas-schema';

export interface LicenseCreationParams {
  tier: Tier;
  nonce: string;
  keyHash: string;
  expiresAt: number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

/** Create a new license record */
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

/** Get license by nonce — returns null if not found */
export async function getLicenseByNonce(nonce: string): Promise<RaasLicense | null> {
  const db = createServerClient();
  const { data, error } = await db.from('raas_licenses').select('*').eq('nonce', nonce).single();

  if (error && error.code !== 'PGRST116') {
    logger.error(`Failed to fetch license ${nonce}`, error);
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/** Get all licenses with pagination and optional filters */
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
