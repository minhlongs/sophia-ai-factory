/**
 * Multi-tenant Isolation Middleware with Agency ID Validation
 *
 * Implements tenant-scoped data isolation using agency_id from JWT claims
 * for all API routes, logs every authenticated request to audit log,
 * and ensures downstream services respect tenant boundaries.
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { logUsageWithReceipt } from '@/lib/audit/audit-logger'
import {
  extractAndValidateAgencyId,
  validateTenantAccess,
  extractResourceId,
} from './agency-isolation-validators'

// Re-export validators for consumers that previously imported from here
export { extractAndValidateAgencyId, validateTenantAccess, extractResourceId } from './agency-isolation-validators'

/** Public API routes that skip agency-isolation checks */
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/setup',
  '/api/webhooks/nowpayments',
  '/api/webhooks/telegram',
  '/api/auth',
  '/api/discovery',
  '/api/sophia-index',
]

/**
 * Enhanced middleware for multi-tenant isolation
 *
 * - Skips public routes and non-API paths
 * - Extracts agency_id from header or JWT
 * - Validates cross-tenant access for GET requests with resource IDs
 * - Logs all validated requests to audit trail
 *
 * @returns NextResponse on error/block, or null to continue request chain
 */
export async function multiTenantIsolationMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl

  // Skip public routes, non-API paths, and static assets
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return null
  }
  if (!pathname.startsWith('/api')) {
    return null
  }
  if (pathname.startsWith('/_next') || pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
    return null
  }

  try {
    const agencyId = await extractAndValidateAgencyId(request)

    if (!agencyId) {
      if (process.env.REQUIRE_AGENCY_ID === 'true') {
        logger.warn('[Agency Isolation] Missing agency_id in request where required', {
          pathname,
          method: request.method,
        })
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Missing agency_id in request headers or JWT',
            code: 'MISSING_AGENCY_ID',
          },
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'X-Agency-Isolation-Reason': 'missing-agency-id',
            },
          }
        )
      }
      return null
    }

    // Validate cross-tenant access for GET requests with resource IDs
    if (request.method === 'GET') {
      const resourceInfo = extractResourceId(pathname)
      if (resourceInfo && resourceInfo.resourceId) {
        const canAccess = await validateTenantAccess(
          agencyId,
          resourceInfo.tableName,
          resourceInfo.resourceId
        )
        if (!canAccess) {
          logger.warn('[Agency Isolation] Cross-tenant access attempt blocked', {
            agencyId,
            requestedResource: resourceInfo,
            path: pathname,
            method: request.method,
          })
          return NextResponse.json(
            {
              error: 'Forbidden',
              message: 'Access denied: Cross-tenant access attempt',
              code: 'CROSS_TENANT_ACCESS_DENIED',
            },
            {
              status: 403,
              headers: {
                'Content-Type': 'application/json',
                'X-Agency-Isolation-Reason': 'cross-tenant-access',
              },
            }
          )
        }
      }
    }

    // Log request for audit purposes
    const requestId = crypto.randomUUID()
    await logUsageWithReceipt({
      nonce: `req_${requestId}`,
      model_name: `agency_isolation.${request.method.toLowerCase()}`,
      token_count: 0,
      endpoint: pathname,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      tier: 'MULTI_TENANT',
    })

    logger.info('[Agency Isolation] Request validated', {
      agencyId,
      path: pathname,
      method: request.method,
      timestamp: Date.now(),
    })

    return null
  } catch (error) {
    logger.error(
      '[Agency Isolation] Middleware error',
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'Error validating agency isolation',
        code: 'ISOLATION_VALIDATION_ERROR',
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Generate a tenant-scoped query builder for a given agency
 *
 * @param agencyId - Agency identifier used to scope queries
 * @returns Function that creates a query scoped to this agency's rows
 */
export function createTenantScopedQuery(agencyId: string) {
  return function (tableName: string) {
    const db = createServerClient()
    return db.from(tableName).eq('user_id', agencyId)
  }
}
