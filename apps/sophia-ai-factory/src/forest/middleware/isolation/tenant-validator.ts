/**
 * Tenant extraction and validation helpers for AGY Tenant Isolation
 * @module forest/middleware/isolation/tenant-validator
 */

import type { NextRequest } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { resolveAgencySlugFromHostname } from '@/tree/agy/domain-router';
import {
  verifyTenantTokenSignature,
  validateTokenPermissions,
} from '@/tree/agy/tenant-token-engine';

/**
 * Extracts raw tenant token from Authorization header or custom headers
 */
export function extractTenantToken(request: NextRequest | Request): string | null {
  const headers = request.headers;

  // 1. Check x-tenant-token
  const customHeader = headers.get('x-tenant-token');
  if (customHeader) return customHeader.trim();

  // 2. Check Authorization Bearer
  const authHeader = headers.get('authorization');
  if (authHeader) {
    const trimmed = authHeader.trim();
    if (/^bearer\s+agy_tok_/i.test(trimmed)) {
      return trimmed.replace(/^bearer\s+/i, '').trim();
    }
  }

  return null;
}

/**
 * Extracts effective agency identifier or slug from headers or hostname
 */
export function extractAgencyIdentifier(request: NextRequest | Request): {
  agencyId: string | null;
  agencySlug: string | null;
} {
  const headers = request.headers;

  const agencyId =
    headers.get('x-agency-id') ||
    headers.get('x-raas-agency-id') ||
    null;

  let agencySlug = headers.get('x-agency-slug');

  if (!agencySlug) {
    const hostHeader = headers.get('x-forwarded-host') || headers.get('host');
    if (hostHeader) {
      agencySlug = resolveAgencySlugFromHostname(hostHeader);
    }
  }

  return { agencyId, agencySlug };
}

export interface TokenValidationResult {
  valid: boolean;
  status?: number;
  reason?: string;
  errorCode?: string;
  verifiedAgencyId?: string;
  tokenPermissions?: string[];
}

/**
 * Validates cryptographic tenant token signature and permissions.
 */
export async function validateTokenCredentials(
  tokenString: string | null,
  requireToken: boolean,
  secret: string,
  nowMs: number,
  requiredPermission?: string
): Promise<TokenValidationResult> {
  if (!tokenString) {
    if (requireToken) {
      return {
        valid: false,
        status: 401,
        reason: 'Tenant token required for this route',
        errorCode: 'MISSING_TENANT_TOKEN',
      };
    }
    return { valid: true };
  }

  const currentTimeSec = Math.floor(nowMs / 1000);
  const verification = await verifyTenantTokenSignature(tokenString, secret, currentTimeSec);

  if (!verification.valid) {
    if (verification.errorCode === 'EXPIRED') {
      return {
        valid: false,
        status: 401,
        reason: verification.reason || 'Tenant token expired',
        errorCode: 'TENANT_TOKEN_EXPIRED',
      };
    }
    return {
      valid: false,
      status: 403,
      reason: verification.reason || 'Invalid tenant token signature',
      errorCode: 'INVALID_TENANT_TOKEN',
    };
  }

  const permissions = verification.payload?.permissions ?? [];
  if (requiredPermission && !validateTokenPermissions(permissions, requiredPermission)) {
    return {
      valid: false,
      status: 403,
      reason: `Insufficient tenant token permissions for ${requiredPermission}`,
      errorCode: 'INSUFFICIENT_PERMISSIONS',
    };
  }

  return {
    valid: true,
    verifiedAgencyId: verification.payload?.agencyId,
    tokenPermissions: permissions,
  };
}

/**
 * Checks for cross-tenant access conflicts between token claims, headers, and query parameters.
 */
export function checkCrossTenantConflict(
  verifiedAgencyId: string | undefined,
  headerAgencyId: string | null,
  pathname: string,
  queryAgencyId: string | null,
  targetAgencyId: string | null
): { allowed: boolean; status?: number; reason?: string; errorCode?: string } {
  if (verifiedAgencyId && headerAgencyId && verifiedAgencyId !== headerAgencyId) {
    logger.warn('[AGY Tenant Isolation] Cross-tenant access attempted', {
      tokenAgency: verifiedAgencyId,
      headerAgency: headerAgencyId,
      path: pathname,
    });
    return {
      allowed: false,
      status: 403,
      reason: 'Cross-tenant access denied: Token agency does not match target agency',
      errorCode: 'CROSS_TENANT_ACCESS_DENIED',
    };
  }

  if (targetAgencyId && queryAgencyId && targetAgencyId !== queryAgencyId) {
    return {
      allowed: false,
      status: 403,
      reason: 'Cross-tenant access denied: Target parameter does not match active agency',
      errorCode: 'CROSS_TENANT_ACCESS_DENIED',
    };
  }

  return { allowed: true };
}
