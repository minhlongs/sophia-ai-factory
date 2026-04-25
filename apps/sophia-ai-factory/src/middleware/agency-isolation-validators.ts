/**
 * Agency Isolation Validators
 *
 * Validation helpers for multi-tenant isolation middleware:
 * JWT/header extraction, tenant access checks, and resource ID parsing.
 * Extracted from agency-isolation.ts to keep that file under 200 lines.
 *
 * @module middleware/agency-isolation-validators
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger-utility'
import { jwtVerify } from 'jose'

/**
 * Extract agency_id from request headers or JWT token
 *
 * Priority: x-raas-agency-id header > Bearer JWT claim
 *
 * @param request - Incoming Next.js request
 * @returns agency_id string or null if not found / invalid
 */
export async function extractAndValidateAgencyId(request: NextRequest): Promise<string | null> {
  // 1. Try header set by RaaS Gateway
  const agencyId = request.headers.get('x-raas-agency-id')
  if (agencyId) {
    return agencyId
  }

  // 2. Fall back to JWT Bearer token
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // Only verify proper JWT (3 parts)
    if (token.split('.').length === 3) {
      try {
        const secret = new TextEncoder().encode(
          process.env.RAAS_JWT_SECRET || process.env.JWT_SECRET || ''
        )
        const verified = await jwtVerify(token, secret)
        const jwtAgencyId = verified.payload.agency_id as string
        if (jwtAgencyId) {
          return jwtAgencyId
        }
      } catch (error) {
        logger.error(
          '[Agency Isolation] JWT verification failed',
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }
  }

  return null
}

/**
 * Validate that the requesting agency can access the requested resource
 *
 * @param agencyId - Requesting agency identifier
 * @param tableName - Target database table
 * @param resourceId - Specific resource identifier
 * @returns true if access is permitted
 */
export async function validateTenantAccess(
  agencyId: string,
  tableName: string,
  resourceId: string
): Promise<boolean> {
  try {
    const db = createServerClient()

    let query

    switch (tableName) {
      case 'usage_events':
        query = db
          .from('usage_events')
          .select('id')
          .eq('id', resourceId)
          .eq('user_id', agencyId)
        break
      case 'raas_licenses':
        query = db
          .from('raas_licenses')
          .select('id')
          .eq('nonce', resourceId)
          .eq('created_by', agencyId)
        break
      case 'raas_audit_logs':
        query = db
          .from('raas_audit_logs')
          .select('id')
          .eq('id', resourceId)
          .eq('user_id', agencyId)
        break
      default:
        // Unknown table — allow by default; individual route handlers validate
        return true
    }

    const { data, error } = await query.single()

    if (error) {
      logger.error('[Agency Isolation] Database query failed', error as unknown as Error)
      return false
    }

    return !!data
  } catch (error) {
    logger.error(
      '[Agency Isolation] Tenant access validation failed',
      error instanceof Error ? error : new Error(String(error))
    )
    return false
  }
}

/**
 * Extract table name and resource identifier from a request path
 *
 * Supports:
 * - /api/v1/usage/:id       → usage_events
 * - /api/v1/licenses/:id    → raas_licenses
 * - /api/admin/licenses/:id → raas_licenses
 * - /api/v1/audit/:id       → raas_audit_logs
 *
 * @param requestPath - URL pathname (e.g. "/api/v1/usage/abc123")
 * @returns { tableName, resourceId } or null if path not recognised
 */
export function extractResourceId(
  requestPath: string
): { tableName: string; resourceId: string } | null {
  const pathParts = requestPath.split('/')

  if (
    pathParts.length >= 5 &&
    pathParts[1] === 'api' &&
    pathParts[2] === 'v1' &&
    pathParts[3] === 'usage'
  ) {
    return { tableName: 'usage_events', resourceId: pathParts[4] }
  }

  if (
    pathParts.length >= 5 &&
    pathParts[1] === 'api' &&
    pathParts[2] === 'v1' &&
    pathParts[3] === 'licenses'
  ) {
    return { tableName: 'raas_licenses', resourceId: pathParts[4] }
  }

  if (
    pathParts.length >= 4 &&
    pathParts[1] === 'api' &&
    pathParts[2] === 'admin' &&
    pathParts[3] === 'licenses' &&
    pathParts[4]
  ) {
    return { tableName: 'raas_licenses', resourceId: pathParts[4] }
  }

  if (
    pathParts.length >= 5 &&
    pathParts[1] === 'api' &&
    pathParts[2] === 'v1' &&
    pathParts[3] === 'audit'
  ) {
    return { tableName: 'raas_audit_logs', resourceId: pathParts[4] }
  }

  return null
}
