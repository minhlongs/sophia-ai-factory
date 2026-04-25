/**
 * Tenant Isolation Middleware for RaaS Gateway
 *
 * Validates agency-specific access control to prevent cross-tenant data leakage.
 *
 * Sub-modules:
 *   tenant-isolation-types.ts             — TenantIsolationResult
 *   tenant-isolation-agency-extractor.ts  — sanitizeInput, extractAgencyId
 *   tenant-isolation-resource-resolver.ts — extractResourceInfo
 *   tenant-isolation-access-validator.ts  — validateResourceAccess
 *
 * @module middleware/tenant-isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger-utility';
import { logValidationWithReceipt } from '@/lib/audit/audit-logger';
import type { TenantIsolationResult } from './tenant-isolation-types';
import { extractAgencyId } from './tenant-isolation-agency-extractor';
import { extractResourceInfo } from './tenant-isolation-resource-resolver';
import { validateResourceAccess } from './tenant-isolation-access-validator';

export type { TenantIsolationResult } from './tenant-isolation-types';

const PUBLIC_ROUTES = [
  '/api/health',
  '/api/setup',
  '/api/webhooks/nowpayments',
  '/api/webhooks/telegram',
  '/api/auth',
  '/api/discovery',
  '/api/sophia-index',
  '/api/login',
  '/auth/callback',
];

/** Main tenant isolation validation. Returns allowed/denied with reason. */
export async function validateTenantIsolation(request: NextRequest): Promise<TenantIsolationResult> {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) return { allowed: true };
  if (!pathname.startsWith('/api')) return { allowed: true };
  if (pathname.startsWith('/_next') || pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) return { allowed: true };

  try {
    const agencyId = await extractAgencyId(request);

    if (!agencyId) {
      if (process.env.REQUIRE_AGENCY_ID === 'true') {
        logger.warn('[Tenant Isolation] Missing agency_id where required', { pathname, method: request.method });
        return { allowed: false, reason: 'Missing agency identifier in request', errorCode: 'MISSING_AGENCY_ID' };
      }

      logger.info('[Tenant Isolation] No agency ID provided, allowing access', { pathname, method: request.method });
      return { allowed: true };
    }

    const resourceInfo = extractResourceInfo(pathname, request.method, request);

    await logValidationWithReceipt({
      nonce: `isolation_check_${Date.now()}`,
      isValid: true,
      userId: agencyId,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'MULTI_TENANT_ISO',
    });

    if (!resourceInfo.resourceId) {
      logger.debug('[Tenant Isolation] Collection-level access granted', { resourceType: resourceInfo.resourceType, agencyId });
      return { allowed: true, agencyId };
    }

    const hasAccess = await validateResourceAccess(agencyId, resourceInfo.resourceType, resourceInfo.resourceId);

    if (hasAccess) {
      logger.debug('[Tenant Isolation] Access granted', {
        resourceType: resourceInfo.resourceType,
        resourceId: resourceInfo.resourceId,
        agencyId,
        path: pathname,
      });
      return { allowed: true, agencyId };
    }

    logger.warn('[Tenant Isolation] Cross-tenant access blocked', {
      resourceType: resourceInfo.resourceType,
      resourceId: resourceInfo.resourceId,
      requestingAgency: agencyId,
      path: pathname,
      method: request.method,
    });

    return {
      allowed: false,
      reason: `Access denied: Cross-tenant access to ${resourceInfo.resourceType}/${resourceInfo.resourceId}`,
      errorCode: 'CROSS_TENANT_ACCESS_DENIED',
      agencyId,
    };
  } catch (error) {
    logger.error('[Tenant Isolation] Unexpected error during validation', error instanceof Error ? error : new Error(String(error)));
    return { allowed: false, reason: 'Internal error during tenant isolation validation', errorCode: 'ISOLATION_VALIDATION_ERROR' };
  }
}

/** Next.js middleware integration — returns 403 NextResponse on denial, null to continue. */
export async function tenantIsolationMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const validationResult = await validateTenantIsolation(request);

  if (!validationResult.allowed) {
    await logValidationWithReceipt({
      nonce: `isolation_denied_${Date.now()}`,
      isValid: false,
      userId: validationResult.agencyId || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'MULTI_TENANT_ISO',
    });

    return NextResponse.json(
      {
        error: 'Forbidden',
        message: validationResult.reason || 'Access denied due to tenant isolation',
        code: validationResult.errorCode || 'FORBIDDEN',
      },
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Isolation-Reason': validationResult.errorCode || 'unknown',
        },
      }
    );
  }

  if (validationResult.agencyId) {
    logger.debug('[Tenant Isolation] Request context', {
      agencyId: validationResult.agencyId,
      path: request.nextUrl.pathname,
      method: request.method,
    });
  }

  return null;
}
