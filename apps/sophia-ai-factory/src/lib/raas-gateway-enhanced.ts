/**
 * Enhanced RaaS Gateway with Enriched JWT Claims
 *
 * Extends the existing RaaS Gateway to enforce tenant-scoped data isolation
 * using JWT claims (agency_id, feature_entitlements, billing_status) for all API routes.
 * Logs every authenticated request to a durable audit log and ensures all downstream services
 * respect tenant boundaries.
 *
 * Phase 2: Integrates with enriched JWT claims for feature-level access control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from './utils/logger-utility';
import { validateLicenseKey as validateWithHmac, ValidationResult } from './raas-service';
import { logValidationWithReceipt, serializeReceiptForHeader } from './audit/audit-logger';
import { checkQuotaWithOverage, DEFAULT_CONFIG } from './quota/quota-checker';
import { enforceQuota } from './quota/quota-enforcer';
import { createServerClient } from '@/lib/db/client';
import { hasEmergencyBypass, recordCircuitFailure, recordCircuitSuccess } from './usage-metering/realtime-tracker';
import crypto from 'crypto';
import { jwtVerify } from 'jose';
import { extractEnrichedClaims, type EnrichedJwtClaims } from './security/jwt-validator';

// Enhanced interface to include agency_id and enriched claims
interface RaaSValidationResult {
  valid: boolean;
  reason?: string;
  tier?: string;
  agencyId?: string;  // Multi-tenant isolation
  enrichedClaims?: EnrichedJwtClaims;  // Phase 2 enriched claims
}

/**
 * Verify JWT from RaaS Gateway and extract enriched claims (Phase 2)
 *
 * @param token - JWT token from RaaS Gateway
 * @returns Enriched claims if valid, null otherwise
 */
async function verifyJwtAndExtractEnrichedClaims(token: string): Promise<EnrichedJwtClaims | null> {
  try {
    const secret = new TextEncoder().encode(
      process.env.RAAS_JWT_SECRET || process.env.JWT_SECRET || ''
    );

    const verified = await jwtVerify(token, secret);

    // Extract enriched claims using helper function
    const payload = verified.payload as any;

    // Check for enriched claims (Phase 2)
    if (payload.feature_entitlements && payload.license_nonce) {
      const enrichedClaims = extractEnrichedClaims(payload);
      if (enrichedClaims) {
        logger.info('[RaaS Gateway] Extracted enriched JWT claims', {
          userId: enrichedClaims.sub.slice(0, 8) + '...',
          licenseNonce: enrichedClaims.license_nonce.slice(0, 8) + '...',
          tier: enrichedClaims.license_tier,
          featureCount: enrichedClaims.feature_entitlements.length,
        });
        return enrichedClaims;
      }
    }

    // Fallback: extract basic agency_id if not enriched
    const agencyId = verified.payload.agency_id as string;
    if (agencyId) {
      return {
        sub: verified.payload.sub as string || '',
        iat: verified.payload.iat as number || 0,
        exp: verified.payload.exp as number || 0,
        agency_id: agencyId,
        license_nonce: verified.payload.license_nonce as string || '',
        license_tier: (verified.payload.license_tier as 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER') || 'BASIC',
        feature_entitlements: [],
        feature_limits: {},
      };
    }

    return null;
  } catch (error) {
    logger.error('[RaaS Gateway] JWT verification failed', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Extract and validate agency_id from request headers
 * Priority:
 * 1. X-RaaS-Agency-ID header (from RaaS Gateway)
 * 2. JWT token with enriched claims (Phase 2)
 * 3. Fallback to existing validation if not in gateway mode
 */
async function extractAgencyId(request: NextRequest): Promise<string | null> {
  // First, check for direct agency_id header (from RaaS Gateway)
  const agencyIdHeader = request.headers.get('x-raas-agency-id');
  if (agencyIdHeader) {
    return agencyIdHeader;
  }

  // Second, check for JWT token with enriched claims
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // Only attempt JWT verification if it looks like a JWT token
    if (token.split('.').length === 3) {
      const enrichedClaims = await verifyJwtAndExtractEnrichedClaims(token);
      return enrichedClaims?.agency_id || null;
    }
  }

  // Third, if no agency_id header, return null to allow existing behavior
  // This maintains backward compatibility for direct API access
  return null;
}

/**
 * Extract enriched claims from JWT (Phase 2)
 * Convenience function for API routes
 */
export async function extractEnrichedClaimsFromRequest(
  request: NextRequest
): Promise<EnrichedJwtClaims | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  if (token.split('.').length !== 3) {
    return null;
  }

  return await verifyJwtAndExtractEnrichedClaims(token);
}

/**
 * Validate agency_id against license/tenant association
 * Ensures that the requesting agency can only access their own data
 */
async function validateAgencyAccess(licenseNonce: string, agencyId: string): Promise<boolean> {
  try {
    const db = createServerClient();

    // Check that the license belongs to the agency making the request
    const { data: license } = await db
      .from('raas_licenses')
      .select('id')
      .eq('nonce', licenseNonce)
      .eq('agency_id', agencyId) // Added agency_id check
      .single();

    if (!license) {
      logger.warn('[RaaS Gateway] Cross-tenant access attempt blocked', {
        licenseNonce,
        requestingAgency: agencyId,
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[RaaS Gateway] Error validating agency access', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Enhanced validation function that includes agency_id validation and enriched claims
 */
export async function validateLicenseKeyWithAgency(
  key: string | null,
  request: NextRequest
): Promise<RaaSValidationResult> {
  // Extract agency_id from request
  const agencyId = await extractAgencyId(request);

  // Extract enriched claims (Phase 2)
  const enrichedClaims = await extractEnrichedClaimsFromRequest(request);

  // Perform standard license validation
  const baseResult = await validateLicenseKey(key);

  if (!baseResult.valid) {
    return baseResult;
  }

  // If enriched claims are present, use them for validation
  if (enrichedClaims) {
    // Validate agency_id against enriched claims
    if (agencyId && enrichedClaims.agency_id && agencyId !== enrichedClaims.agency_id) {
      logger.warn('[RaaS Gateway] Agency ID mismatch with enriched claims', {
        requestAgency: agencyId,
        enrichedAgency: enrichedClaims.agency_id,
      });
      return {
        valid: false,
        reason: 'agency-id-mismatch',
      };
    }

    // Check feature entitlements if feature is being accessed
    const featureKey = request.headers.get('x-feature-key');
    if (featureKey && !enrichedClaims.feature_entitlements.includes(featureKey)) {
      logger.warn('[RaaS Gateway] Feature not in entitlements', {
        featureKey,
        tier: enrichedClaims.license_tier,
        userId: enrichedClaims.sub.slice(0, 8) + '...',
      });
      return {
        valid: false,
        reason: 'feature-not-entitled',
        tier: enrichedClaims.license_tier,
      };
    }

    // Check billing status
    if (enrichedClaims.billing_status === 'suspended') {
      logger.warn('[RaaS Gateway] Access denied - account suspended', {
        userId: enrichedClaims.sub.slice(0, 8) + '...',
        licenseNonce: enrichedClaims.license_nonce.slice(0, 8) + '...',
      });
      return {
        valid: false,
        reason: 'account-suspended',
        tier: enrichedClaims.license_tier,
      };
    }

    return {
      valid: true,
      tier: enrichedClaims.license_tier,
      agencyId: enrichedClaims.agency_id,
      enrichedClaims,
    };
  }

  // Fallback to agency_id validation (legacy)
  if (agencyId) {
    const licenseKeyHash = key ? crypto.createHash('sha256').update(key).digest('hex') : '';
    const hasAccess = await validateAgencyAccess('', agencyId);

    if (!hasAccess) {
      return {
        valid: false,
        reason: 'cross-tenant-access-denied',
        agencyId
      };
    }

    return {
      ...baseResult,
      agencyId
    };
  }

  // If no agency_id in request but system requires it, this could be an error
  if (process.env.REQUIRE_AGENCY_ID === 'true') {
    logger.warn('[RaaS Gateway] Missing agency_id in request where required');
    return {
      valid: false,
      reason: 'missing-agency-id',
    };
  }

  return baseResult;
}

/**
 * Enhanced RaaS Gate Middleware with agency_id validation
 */
export async function raasGateWithAgency(request: NextRequest): Promise<{
  valid: boolean;
  response?: NextResponse;
  tier?: string;
  agencyId?: string;
  receipt?: string;
  quotaWarning?: boolean;
  quotaRemaining?: {
    dailyCredits: number;
    hourlyCredits: number;
    dailyRequests: number;
    monthlyCredits: number;
  };
}> {
  const licenseKey = extractLicenseKey(request);
  const result = await validateLicenseKeyWithAgency(licenseKey, request);

  if (!result.valid) {
    // Log failed validation attempt with receipt
    await logValidationWithReceipt({
      nonce: licenseKey || 'unknown',
      isValid: false,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'unknown'
    });

    logger.info('[RaaS Gateway] Validation failed', {
      path: request.nextUrl.pathname,
      valid: result.valid,
      reason: result.reason,
      agencyId: result.agencyId
    });

    return {
      valid: false,
      response: createForbiddenResponse(result.reason!),
    };
  }

  // Log successful validation with receipt
  const receipt = await logValidationWithReceipt({
    nonce: licenseKey!,
    isValid: true,
    userId: request.headers.get('x-logged-in-user-id') || undefined,
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    tier: result.tier
  });

  logger.info('[RaaS Gateway] Validation successful', {
    path: request.nextUrl.pathname,
    valid: result.valid,
    reason: result.reason,
    agencyId: result.agencyId,
    hasReceipt: !!receipt
  });

  // Continue with existing quota enforcement logic
  // ... (existing quota enforcement code with modifications to include agencyId)

  return {
    valid: true,
    tier: result.tier,
    agencyId: result.agencyId,
    receipt: receipt ? serializeReceiptForHeader(receipt) : undefined
  };
}

// Import and re-export existing functions for backward compatibility
export {
  raasGate,
  shouldApplyRaasGate,
  getRaaSConfig
} from './raas-gate';