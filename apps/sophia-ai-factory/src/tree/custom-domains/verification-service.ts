/**
 * Cloudflare for SaaS Custom Hostname Verification Service.
 *
 * Layer: tree (Domain reusable logic)
 * Dependencies: @/seed/*
 *
 * Handles Cloudflare API communication, status transitions,
 * ownership TXT and SSL DCV record parsing, and D1 persistence.
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  CustomDomainRecord,
  CustomDomainRow,
  DomainVerificationResult,
  CustomDomainError,
  CustomDomainSslStatus,
  CustomDomainVerificationStatus,
  VerificationRecord,
  CloudflareCustomHostnameResult,
  CloudflareApiResponse,
} from '@/seed/types/custom-domains';

export const DEFAULT_CNAME_TARGET = 'cname.sophia.agencyos.network';

// ── Hostname Validation ───────────────────────────────────────────────────────

export const HOSTNAME_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
export const FORBIDDEN_DOMAINS = new Set([
  'sophia.agencyos.network',
  'agencyos.network',
  'localhost',
  'workers.dev',
  'pages.dev',
]);

export function validateHostname(hostname: string): Result<string, CustomDomainError> {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized || normalized.length < 4 || normalized.length > 253) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Hostname length must be between 4 and 253 characters',
    });
  }

  // Check forbidden/reserved platform domains first so reserved names like localhost fail with appropriate error
  for (const forbidden of FORBIDDEN_DOMAINS) {
    if (normalized === forbidden || normalized.endsWith(`.${forbidden}`)) {
      return failure({
        code: 'INVALID_HOSTNAME',
        message: 'Cannot register root platform domains or internal reserved hostnames',
      });
    }
  }

  if (!HOSTNAME_REGEX.test(normalized)) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Invalid hostname format. Must be a valid Fully Qualified Domain Name (e.g., portal.myagency.com)',
    });
  }

  // Enforce TLD rules (at least 2 alphabetic characters, non-numeric)
  const tld = normalized.slice(normalized.lastIndexOf('.') + 1);
  if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Invalid hostname format. Must be a valid Fully Qualified Domain Name (e.g., portal.myagency.com)',
    });
  }

  return success(normalized);
}

// ── Environment Helpers ───────────────────────────────────────────────────────

function getCloudflareCredentials(): { zoneId: string | null; apiToken: string | null } {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];
  
  const zoneId = (process.env.CLOUDFLARE_ZONE_ID || env?.CLOUDFLARE_ZONE_ID || ctx?.env?.CLOUDFLARE_ZONE_ID) as string | undefined;
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || ctx?.env?.CLOUDFLARE_API_TOKEN) as string | undefined;

  return {
    zoneId: zoneId ?? null,
    apiToken: apiToken ?? null,
  };
}

// ── Record Parsers ────────────────────────────────────────────────────────────

export function parseOwnershipVerification(
  cfResult: CloudflareCustomHostnameResult,
): VerificationRecord | null {
  if (cfResult.ownership_verification?.name && cfResult.ownership_verification?.value) {
    return {
      type: 'txt',
      name: cfResult.ownership_verification.name,
      value: cfResult.ownership_verification.value,
    };
  }
  return null;
}

export function parseSslDcvVerification(
  cfResult: CloudflareCustomHostnameResult,
): VerificationRecord | null {
  const ssl = cfResult.ssl;
  if (!ssl) return null;

  // 1. Check validation_records array (most complete source from Cloudflare)
  if (ssl.validation_records && ssl.validation_records.length > 0) {
    const record = ssl.validation_records[0];
    if (record.txt_name && record.txt_value) {
      return { type: 'txt', name: record.txt_name, value: record.txt_value };
    }
    if (record.cname_name && record.cname_target) {
      return { type: 'cname', name: record.cname_name, value: record.cname_target };
    }
  }

  // 2. Fallback to top-level txt properties
  if (ssl.txt_name && ssl.txt_value) {
    return { type: 'txt', name: ssl.txt_name, value: ssl.txt_value };
  }

  return null;
}

export function parseVerificationErrors(
  cfResult: CloudflareCustomHostnameResult,
): string[] {
  const errors: string[] = [];
  if (Array.isArray(cfResult.verification_errors)) {
    for (const err of cfResult.verification_errors) {
      if (typeof err === 'string' && err.trim()) errors.push(err.trim());
    }
  }
  return errors;
}

// ── State Transition Logic ────────────────────────────────────────────────────

export function evaluateStatusTransitions(
  cfResult: CloudflareCustomHostnameResult,
): {
  sslStatus: CustomDomainSslStatus;
  verificationStatus: CustomDomainVerificationStatus;
  cnameVerified: boolean;
  active: boolean;
  errors: string[];
} {
  const errors = parseVerificationErrors(cfResult);
  const rawSslStatus = cfResult.ssl?.status;
  const cfHostStatus = cfResult.status;

  let sslStatus: CustomDomainSslStatus = 'pending_validation';
  let verificationStatus: CustomDomainVerificationStatus = 'pending';
  let cnameVerified = cfHostStatus === 'active';
  let active = false;

  if (cfHostStatus === 'blocked' || rawSslStatus === 'error' || rawSslStatus === 'timed_out' || rawSslStatus === 'revoked') {
    sslStatus = rawSslStatus === 'revoked' ? 'revoked' : 'error';
    verificationStatus = rawSslStatus === 'revoked' ? 'revoked' : 'failed';
    if (errors.length === 0) {
      errors.push(
        cfHostStatus === 'blocked'
          ? 'Hostname is blocked by Cloudflare'
          : `SSL validation failed with status: ${rawSslStatus}`
      );
    }
  } else if (rawSslStatus === 'active' && cfHostStatus === 'active') {
    sslStatus = 'active';
    verificationStatus = 'active';
    cnameVerified = true;
    active = true;
  } else if (rawSslStatus === 'pending_deployment') {
    sslStatus = 'pending_deployment';
    verificationStatus = 'verified';
  } else {
    sslStatus = 'pending_validation';
    verificationStatus = 'pending';
  }

  return {
    sslStatus,
    verificationStatus,
    cnameVerified,
    active,
    errors,
  };
}

// ── Cloudflare API Client ─────────────────────────────────────────────────────

export async function createCloudflareCustomHostname(
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  // Test / Mock mode fallback when external credentials are not present
  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Operating in mock mode (credentials absent)', { hostname });
    const mockId = 'mock_cf_' + Math.random().toString(36).substring(2, 15);
    const mockResult: CloudflareCustomHostnameResult = {
      id: mockId,
      hostname,
      status: 'pending',
      verification_errors: [],
      ownership_verification: {
        type: 'txt',
        name: `_cf-custom-hostname.${hostname}`,
        value: `mock_ownership_${mockId}`,
      },
      ssl: {
        id: mockId,
        type: 'dv',
        method: 'txt',
        status: 'pending_validation',
        txt_name: `_acme-challenge.${hostname}`,
        txt_value: `mock_dcv_${mockId}`,
        validation_records: [
          {
            status: 'pending',
            txt_name: `_acme-challenge.${hostname}`,
            txt_value: `mock_dcv_${mockId}`,
          },
        ],
      },
    };
    return success(mockResult);
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
            http2: 'on',
          },
        },
      }),
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareCustomHostnameResult>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare creation failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] createCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

export async function fetchCloudflareCustomHostname(
  cfCustomHostnameId: string,
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  // Test / Mock mode fallback
  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock status check', { cfCustomHostnameId, hostname });
    const isMockActive = hostname.includes('active-test');
    const isMockError = hostname.includes('error-test');
    const mockResult: CloudflareCustomHostnameResult = {
      id: cfCustomHostnameId,
      hostname,
      status: isMockActive ? 'active' : isMockError ? 'blocked' : 'pending',
      verification_errors: isMockError ? ['CA verification timeout'] : [],
      ownership_verification: {
        type: 'txt',
        name: `_cf-custom-hostname.${hostname}`,
        value: 'mock_ownership_verified',
      },
      ssl: {
        id: cfCustomHostnameId,
        type: 'dv',
        method: 'txt',
        status: isMockActive ? 'active' : isMockError ? 'error' : 'pending_validation',
        txt_name: `_acme-challenge.${hostname}`,
        txt_value: 'mock_dcv_token',
      },
    };
    return success(mockResult);
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareCustomHostnameResult>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare status check failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] fetchCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

export async function deleteCloudflareCustomHostname(
  cfCustomHostnameId: string,
): Promise<Result<{ id: string }, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock deletion', { cfCustomHostnameId });
    return success({ id: cfCustomHostnameId });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<{ id: string }>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare deletion failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] deleteCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

// ── D1 Data Access Layer ──────────────────────────────────────────────────────

export function mapRowToCustomDomainRecord(row: CustomDomainRow): CustomDomainRecord {
  let verificationErrors: string[] = [];
  try {
    verificationErrors = JSON.parse(row.verification_errors || '[]');
  } catch {
    verificationErrors = [];
  }

  let ownershipVerification: VerificationRecord | null = null;
  try {
    const parsed = JSON.parse(row.ownership_verification || '{}');
    if (parsed && parsed.name && parsed.value) ownershipVerification = parsed;
  } catch {
    ownershipVerification = null;
  }

  let sslVerification: VerificationRecord | null = null;
  try {
    const parsed = JSON.parse(row.ssl_verification || '{}');
    if (parsed && parsed.name && parsed.value) sslVerification = parsed;
  } catch {
    sslVerification = null;
  }

  return {
    id: row.id,
    org_id: row.org_id,
    hostname: row.hostname,
    cf_custom_hostname_id: row.cf_custom_hostname_id,
    ssl_status: row.ssl_status as CustomDomainSslStatus,
    verification_status: (row.verification_status as CustomDomainVerificationStatus) ?? 'pending',
    verification_errors: verificationErrors,
    ownership_verification: ownershipVerification,
    ssl_verification: sslVerification,
    cname_target: row.cname_target || DEFAULT_CNAME_TARGET,
    cname_verified: row.cname_verified === 1,
    active: row.active === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCustomDomainById(
  db: D1Database,
  id: string,
): Promise<CustomDomainRecord | null> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<CustomDomainRow>();

  return row ? mapRowToCustomDomainRecord(row) : null;
}

export async function getCustomDomainByHostname(
  db: D1Database,
  hostname: string,
): Promise<CustomDomainRecord | null> {
  const row = await db
    .prepare('SELECT * FROM custom_domains WHERE hostname = ?1 LIMIT 1')
    .bind(hostname.toLowerCase())
    .first<CustomDomainRow>();

  return row ? mapRowToCustomDomainRecord(row) : null;
}

export async function listCustomDomainsByOrg(
  db: D1Database,
  orgId: string,
): Promise<CustomDomainRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM custom_domains WHERE org_id = ?1 ORDER BY created_at DESC')
    .bind(orgId)
    .all<CustomDomainRow>();

  return (results ?? []).map(mapRowToCustomDomainRecord);
}

// ── Interface Contracts (PROJECT.md:60-64) ────────────────────────────────────

/**
 * Register a custom domain record and Cloudflare custom hostname.
 */
export async function registerCustomDomain(
  db: D1Database,
  orgId: string,
  hostname: string,
): Promise<CustomDomainRecord> {
  const normalized = hostname.trim().toLowerCase();

  // Call Cloudflare SaaS API
  const cfRes = await createCloudflareCustomHostname(normalized);
  if (!cfRes.ok) {
    throw new Error(`Cloudflare custom hostname creation failed: ${cfRes.error.message}`);
  }

  const cfData = cfRes.value;
  const ownership = parseOwnershipVerification(cfData);
  const sslDcv = parseSslDcvVerification(cfData);
  const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

  const domainId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO custom_domains (
        id, org_id, hostname, cf_custom_hostname_id, ssl_status, verification_status,
        verification_errors, ownership_verification, ssl_verification,
        cname_target, cname_verified, active, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
    )
    .bind(
      domainId,
      orgId,
      normalized,
      cfData.id,
      sslStatus,
      verificationStatus,
      JSON.stringify(errors),
      JSON.stringify(ownership ?? {}),
      JSON.stringify(sslDcv ?? {}),
      DEFAULT_CNAME_TARGET,
      cnameVerified ? 1 : 0,
      active ? 1 : 0,
      now,
      now,
    )
    .run();

  const created = await getCustomDomainById(db, domainId);
  if (!created) {
    throw new Error('Failed to retrieve newly inserted custom domain');
  }

  return created;
}

/**
 * Verify custom domain status against Cloudflare and persist updates to D1.
 */
export async function verifyCustomDomainStatus(
  db: D1Database,
  domainId: string,
): Promise<DomainVerificationResult> {
  const domain = await getCustomDomainById(db, domainId);
  if (!domain) {
    throw new Error(`Custom domain not found: ${domainId}`);
  }

  if (!domain.cf_custom_hostname_id) {
    throw new Error(`Custom domain ${domainId} missing Cloudflare Custom Hostname ID`);
  }

  const cfRes = await fetchCloudflareCustomHostname(domain.cf_custom_hostname_id, domain.hostname);
  if (!cfRes.ok) {
    throw new Error(`Cloudflare status check failed: ${cfRes.error.message}`);
  }

  const cfData = cfRes.value;
  const ownership = parseOwnershipVerification(cfData);
  const sslDcv = parseSslDcvVerification(cfData);
  const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `UPDATE custom_domains SET
        ssl_status = ?1,
        verification_status = ?2,
        verification_errors = ?3,
        ownership_verification = ?4,
        ssl_verification = ?5,
        cname_verified = ?6,
        active = ?7,
        updated_at = ?8
      WHERE id = ?9`,
    )
    .bind(
      sslStatus,
      verificationStatus,
      JSON.stringify(errors),
      JSON.stringify(ownership ?? {}),
      JSON.stringify(sslDcv ?? {}),
      cnameVerified ? 1 : 0,
      active ? 1 : 0,
      now,
      domainId,
    )
    .run();

  return {
    domainId,
    hostname: domain.hostname,
    sslStatus,
    verificationStatus,
    cnameVerified,
    active,
    ownershipVerification: ownership,
    sslVerification: sslDcv,
    errors,
    cnameTarget: domain.cname_target,
  };
}
