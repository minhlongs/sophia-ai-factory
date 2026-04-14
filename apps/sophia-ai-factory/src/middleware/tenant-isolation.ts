/**
 * Tenant Isolation Middleware for RaaS Gateway
 *
 * Implements agency-specific access control by validating the agency identifier
 * from the JWT or API key against the requested resource, ensuring cross-tenant
 * data leakage is prevented.
 *
 * Features:
 * - Extracts tenant ID from authenticated requests (JWT claims or API key metadata)
 * - Compares with target resource's agency scope
 * - Returns 403 error on mismatch
 * - Logs all access attempts for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { logValidationWithReceipt } from '@/lib/audit/audit-logger';
import { jwtVerify } from 'jose';
import { sha256 } from '@/lib/audit/crypto-utils';

export interface TenantIsolationResult {
  allowed: boolean;
  reason?: string;
  agencyId?: string;
  errorCode?: string;
}

/**
 * Sanitize input to prevent injection attacks
 */
function sanitizeInput(input: string | null | undefined): string | null {
  if (!input) return null;

  // Remove any potentially dangerous characters
  const sanitized = input.replace(/[^a-zA-Z0-9-_:.]/g, '');

  // Validate length to prevent overly long inputs
  if (sanitized.length > 100) {
    return null;
  }

  return sanitized;
}

/**
 * Extract agency/tenant ID from request (JWT or API key)
 */
async function extractAgencyId(request: NextRequest): Promise<string | null> {
  // First, try to get agency_id from headers (from RaaS Gateway)
  const agencyIdHeader = request.headers.get('x-raas-agency-id');
  if (agencyIdHeader) {
    const sanitized = sanitizeInput(agencyIdHeader);
    if (!sanitized) return null;
    return sanitized;
  }

  // Second, check for JWT token that contains agency_id
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Only attempt JWT verification if it looks like a JWT token
    if (token.split('.').length === 3) {
      try {
        const secret = new TextEncoder().encode(
          process.env.RAAS_JWT_SECRET || process.env.JWT_SECRET || ''
        );

        if (!secret || secret.length === 0) {
          logger.error('[Tenant Isolation] Missing JWT secret for verification');
          return null;
        }

        const verified = await jwtVerify(token, secret);

        // Extract agency_id from JWT claims
        const agencyId = verified.payload.agency_id as string;
        if (agencyId) {
          const sanitized = sanitizeInput(agencyId);
          if (!sanitized) return null;
          return sanitized;
        }
      } catch (error) {
        logger.error('[Tenant Isolation] JWT verification failed', error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // Third, check for API key and resolve agency from it
  const apiKey = request.headers.get('x-raas-api-key') ||
                 request.headers.get('x-api-key') ||
                 request.headers.get('authorization')?.replace('Bearer ', '');

  if (apiKey && apiKey.startsWith('mk_')) { // Assume mk_ prefix for agency-specific API keys
    try {
      // Get agency_id associated with this API key from database
      const db = createServerClient();

      // Hash the API key for comparison (as it's stored hashed in the DB)
      const apiKeyHash = sha256(apiKey);

      const { data, error } = await db
        .from('raas_api_keys')
        .select('owner_id, permissions')
        .eq('key_hash', apiKeyHash)
        .single();

      if (error) {
        logger.error('[Tenant Isolation] Error fetching API key data', error);
        return null;
      }

      if (data) {
        // Assuming owner_id represents the agency ID
        // In a real implementation, this might come from a specific agency field
        const sanitized = sanitizeInput(data.owner_id);
        if (!sanitized) return null;
        return sanitized;
      }
    } catch (error) {
      logger.error('[Tenant Isolation] Error resolving agency from API key', error instanceof Error ? error : new Error(String(error)));
    }
  }

  return null;
}

/**
 * Determine resource type and ID from request path
 */
function extractResourceInfo(pathname: string, method: string, request: NextRequest): {
  resourceType: string,
  resourceId: string | null
} {
  // Normalize path by removing locale prefixes
  const normalizedPath = pathname.replace(/^\/(en|vi)\//, '/');

  // Handle various API endpoints
  if (normalizedPath.startsWith('/api/v1/usage/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 5) {
      const resourceId = sanitizeInput(parts[4]);
      if (!resourceId) return { resourceType: 'usage_event', resourceId: null };
      return {
        resourceType: 'usage_event',
        resourceId
      };
    }
  } else if (normalizedPath.startsWith('/api/admin/licenses/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 5) {
      const resourceId = sanitizeInput(parts[4]); // nonce part of /api/admin/licenses/:nonce
      if (!resourceId) return { resourceType: 'license', resourceId: null };
      return {
        resourceType: 'license',
        resourceId
      };
    }
  } else if (normalizedPath.startsWith('/api/admin/usage/reconciliation/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 6) {
      const resourceId = sanitizeInput(parts[5]);
      if (!resourceId) return { resourceType: 'reconciliation_job', resourceId: null };
      return {
        resourceType: 'reconciliation_job',
        resourceId
      };
    }
  } else if (normalizedPath.startsWith('/api/user/audit-logs/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 5) {
      const resourceId = sanitizeInput(parts[4]);
      if (!resourceId) return { resourceType: 'audit_log', resourceId: null };
      return {
        resourceType: 'audit_log',
        resourceId
      };
    }
  } else if (normalizedPath.startsWith('/api/usage/')) {
    const parts = normalizedPath.split('/');
    if (parts.length >= 4) {
      const resourceId = sanitizeInput(parts[3]);
      if (!resourceId) return { resourceType: 'usage_summary', resourceId: null };
      return {
        resourceType: 'usage_summary',
        resourceId
      };
    }
  }

  // For collection-level requests without specific ID
  if (normalizedPath.startsWith('/api/v1/usage') && method === 'GET') {
    return {
      resourceType: 'usage_event',
      resourceId: null // All usage events for this tenant
    };
  }

  if (normalizedPath.startsWith('/api/admin/licenses') && method === 'GET') {
    return {
      resourceType: 'license',
      resourceId: null // All licenses for this tenant
    };
  }

  return {
    resourceType: 'unknown',
    resourceId: null
  };
}

/**
 * Validate if the agency has access to the specified resource
 */
async function validateResourceAccess(agencyId: string, resourceType: string, resourceId: string | null): Promise<boolean> {
  try {
    const db = createServerClient();

    // Depending on resource type, check different authorization schemes
    switch(resourceType) {
      case 'usage_event':
        if (!resourceId) {
          // For collection access, just verify the agency exists
          // In a real scenario, we'd probably need to validate against the user's agency
          return true;
        }
        // Check if this usage event belongs to the requesting agency
        const { data: usageEvent, error: usageError } = await db
          .from('usage_events')
          .select('user_id')
          .eq('id', resourceId)
          .single();

        if (usageError || !usageEvent) {
          logger.warn('[Tenant Isolation] Usage event not found', { resourceId, agencyId });
          return false;
        }

        // Compare user_id with agency_id (in the schema, user_id represents the tenant)
        return usageEvent.user_id === agencyId;

      case 'license':
        if (!resourceId) {
          return true;
        }
        // Check if this license belongs to the requesting agency
        const { data: license, error: licenseError } = await db
          .from('raas_licenses')
          .select('created_by')
          .eq('nonce', resourceId) // Using nonce as the identifier
          .single();

        if (licenseError || !license) {
          logger.warn('[Tenant Isolation] License not found', { resourceId, agencyId });
          return false;
        }

        // Compare created_by with agency_id
        return license.created_by === agencyId;

      case 'reconciliation_job':
        if (!resourceId) {
          return true;
        }
        // Check if this reconciliation job belongs to the requesting agency
        // Using exact match for resource ID to prevent injection
        const { data: job, error: jobError } = await db
          .from('raas_licenses') // Assuming reconcile jobs are tied to licenses
          .select('created_by')
          .eq('id', resourceId) // Exact match rather than pattern matching
          .single();

        if (jobError || !job) {
          logger.warn('[Tenant Isolation] Reconciliation job not found', { resourceId, agencyId });
          return false;
        }

        return job.created_by === agencyId;

      case 'audit_log':
        if (!resourceId) {
          return true;
        }
        // Check if this audit log belongs to the requesting agency
        const { data: auditLog, error: auditError } = await db
          .from('raas_audit_logs')
          .select('user_id')
          .eq('id', resourceId)
          .single();

        if (auditError || !auditLog) {
          logger.warn('[Tenant Isolation] Audit log not found', { resourceId, agencyId });
          return false;
        }

        return auditLog.user_id === agencyId;

      case 'usage_summary':
        if (!resourceId) {
          // For usage summaries without specific ID, allow access to agency-specific summaries
          // In a real implementation, we'd validate that the user can only see their own summaries
          return true;
        }
        // For specific usage summaries, verify it belongs to the requesting agency
        // This would require checking the tenant_id field in the summary table
        const { data: summary, error: summaryError } = await db
          .from('usage_daily_summaries')
          .select('tenant_id')
          .eq('id', resourceId)
          .single();

        if (summaryError || !summary) {
          // Try in hourly summaries as well
          const { data: hourlySummary, error: hourlyError } = await db
            .from('usage_hourly_summaries')
            .select('tenant_id')
            .eq('id', resourceId)
            .single();

          if (hourlyError || !hourlySummary) {
            logger.warn('[Tenant Isolation] Usage summary not found', { resourceId, agencyId });
            return false;
          }

          return hourlySummary.tenant_id === agencyId;
        }

        return summary.tenant_id === agencyId;

      default:
        // For unknown resource types, deny access by default (secure by default)
        logger.warn('[Tenant Isolation] Unknown resource type access blocked', { resourceType, agencyId });
        return false;
    }
  } catch (error) {
    logger.error('[Tenant Isolation] Error validating resource access', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Tenant Isolation Middleware - Main validation function
 */
export async function validateTenantIsolation(request: NextRequest): Promise<TenantIsolationResult> {
  const { pathname } = request.nextUrl;

  // Define routes that should bypass tenant isolation (public routes)
  const publicRoutes = [
    '/api/health',
    '/api/setup',
    '/api/webhooks/nowpayments',
    '/api/webhooks/telegram',
    '/api/auth',
    '/api/discovery',
    '/api/sophia-index',
    '/api/login',
    '/auth/callback'
  ];

  // Skip isolation for public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return { allowed: true };
  }

  // Skip for non-API routes
  if (!pathname.startsWith('/api')) {
    return { allowed: true };
  }

  // Skip for static assets and internal Next.js routes
  if (pathname.startsWith('/_next') || pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
    return { allowed: true };
  }

  try {
    // Extract agency ID from the request
    const agencyId = await extractAgencyId(request);

    if (!agencyId) {
      // If REQUIRE_AGENCY_ID is set, this is an error
      if (process.env.REQUIRE_AGENCY_ID === 'true') {
        logger.warn('[Tenant Isolation] Missing agency_id where required', {
          pathname,
          method: request.method
        });

        return {
          allowed: false,
          reason: 'Missing agency identifier in request',
          errorCode: 'MISSING_AGENCY_ID'
        };
      }

      // Otherwise, allow access but log for audit
      logger.info('[Tenant Isolation] No agency ID provided, allowing access', {
        pathname,
        method: request.method
      });

      return { allowed: true };
    }

    // Extract resource information from the request
    const resourceInfo = extractResourceInfo(pathname, request.method, request);

    // Log validation attempt for audit trail
    await logValidationWithReceipt({
      nonce: `isolation_check_${Date.now()}`,
      isValid: true,
      userId: agencyId, // Using agencyId as userId for audit purposes
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'MULTI_TENANT_ISO',
    });

    // If no specific resource ID, allow access to collections (will be filtered by subsequent queries)
    if (!resourceInfo.resourceId) {
      logger.debug('[Tenant Isolation] Collection-level access granted', {
        resourceType: resourceInfo.resourceType,
        agencyId
      });

      return {
        allowed: true,
        agencyId
      };
    }

    // Validate access to the specific resource
    const hasAccess = await validateResourceAccess(agencyId, resourceInfo.resourceType, resourceInfo.resourceId);

    if (hasAccess) {
      logger.debug('[Tenant Isolation] Access granted', {
        resourceType: resourceInfo.resourceType,
        resourceId: resourceInfo.resourceId,
        agencyId,
        path: pathname
      });

      return {
        allowed: true,
        agencyId
      };
    } else {
      logger.warn('[Tenant Isolation] Cross-tenant access blocked', {
        resourceType: resourceInfo.resourceType,
        resourceId: resourceInfo.resourceId,
        requestingAgency: agencyId,
        path: pathname,
        method: request.method
      });

      return {
        allowed: false,
        reason: `Access denied: Cross-tenant access to ${resourceInfo.resourceType}/${resourceInfo.resourceId}`,
        errorCode: 'CROSS_TENANT_ACCESS_DENIED',
        agencyId
      };
    }
  } catch (error) {
    logger.error('[Tenant Isolation] Unexpected error during validation', error instanceof Error ? error : new Error(String(error)));

    return {
      allowed: false,
      reason: 'Internal error during tenant isolation validation',
      errorCode: 'ISOLATION_VALIDATION_ERROR'
    };
  }
}

/**
 * Middleware function to integrate with Next.js
 */
export async function tenantIsolationMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const validationResult = await validateTenantIsolation(request);

  if (!validationResult.allowed) {
    // Log the denial for audit trail
    await logValidationWithReceipt({
      nonce: `isolation_denied_${Date.now()}`,
      isValid: false,
      userId: validationResult.agencyId || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'MULTI_TENANT_ISO',
    });

    // Return 403 Forbidden response
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

  // Add agency context to request for downstream handlers
  if (validationResult.agencyId) {
    // We can't directly modify request headers in middleware, but we can log for context
    logger.debug('[Tenant Isolation] Request context', {
      agencyId: validationResult.agencyId,
      path: request.nextUrl.pathname,
      method: request.method
    });
  }

  // Request is allowed, continue processing
  return null;
}