/**
 * GET /api/audit - RaaS Gateway Audit Log Query Endpoint
 *
 * Requires dual authentication:
 * 1. JWT token from Authorization: Bearer <token> header
 * 2. API key from X-API-Key: mk_{keyId}_{signature} header
 *
 * Features:
 * - Dual authentication (JWT + mk_ API key)
 * - Rate limiting (default 100 req/min per API key)
 * - Self-auditing (every query is logged)
 * - GDPR-compliant redaction (optional)
 * - Pagination and filtering
 *
 * @module api/audit
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/seed/utils/logger-utility'

// Import security utilities
import { validateApiKey } from '@/seed/security/api-key-validator'
import { validateJwt } from '@/seed/security/jwt-validator'
import { checkRateLimit, recordRequest } from '@/seed/security/rate-limiter'

// Import audit query logger
import { logAuditQuery, queryAuditLogs } from '@/tree/audit/audit-query-logger'

export const dynamic = 'force-dynamic'

/**
 * Query parameters schema with Zod validation
 */
const auditQuerySchema = z.object({
  // Date range filtering (Unix timestamps in seconds)
  dateFrom: z.coerce.number().int().positive().optional(),
  dateTo: z.coerce.number().int().positive().optional(),

  // Filter by action type
  action: z.string().max(50).optional(),

  // Filter by license nonce
  license: z.string().max(100).optional(),

  // Filter by model name (stored in details)
  model: z.string().max(100).optional(),

  // Filter by user ID
  userId: z.string().max(100).optional(),

  // Pagination
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),

  // GDPR: Include personally identifiable information
  // Default: false (returns hashed/pseudonymized data)
  includePII: z.coerce.boolean().default(false),
})

type AuditQueryParams = z.infer<typeof auditQuerySchema>

/**
 * GET /api/audit - Query audit logs
 *
 * Headers required:
 * - Authorization: Bearer <jwt_token>
 * - X-API-Key: mk_{keyId}_{hmacSignature}
 *
 * Query params (optional):
 * - dateFrom: Unix timestamp (seconds)
 * - dateTo: Unix timestamp (seconds)
 * - action: Filter by action (VALIDATE, CREATE, REVOKE, USAGE, etc.)
 * - license: Filter by license nonce
 * - model: Filter by model name
 * - userId: Filter by user ID
 * - limit: Max results (default 100, max 500)
 * - offset: Pagination offset (default 0)
 * - includePII: Include personal data (default false)
 *
 * Response:
 * - 200: Array of audit log entries
 * - 401: Missing or invalid authentication
 * - 429: Rate limit exceeded
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Step 1: Extract and validate API key from X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key')
  const apiKeyResult = await validateApiKey(apiKeyHeader)

  if (!apiKeyResult.valid) {
    logger.warn('[Audit API] Invalid API key', { error: apiKeyResult.error })
    return NextResponse.json(
      { error: 'Invalid API key', code: apiKeyResult.error },
      { status: 401 }
    )
  }

  // Step 2: Extract and validate JWT from Authorization header
  const authHeader = request.headers.get('authorization')
  const jwtResult = await validateJwt(authHeader)

  if (!jwtResult.valid) {
    logger.warn('[Audit API] Invalid JWT', { error: jwtResult.error })
    return NextResponse.json(
      { error: 'Invalid authentication token', code: jwtResult.error },
      { status: 401 }
    )
  }

  // Step 3: Check rate limit
  const apiKeyId = apiKeyResult.apiKey!.keyId
  const rateLimit = apiKeyResult.apiKey!.rateLimitPerMinute
  const rateLimitResult = await checkRateLimit(apiKeyId, rateLimit)

  if (!rateLimitResult.allowed) {
    const retryAfter = rateLimitResult.retryAfter || 60
    logger.warn('[Audit API] Rate limit exceeded', {
      apiKeyId,
      retryAfter,
    })

    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
        },
      }
    )
  }

  // Record this request for rate limiting
  await recordRequest(apiKeyId)

  // Step 4: Parse and validate query parameters
  const searchParams = request.nextUrl.searchParams
  let queryParams: AuditQueryParams

  try {
    queryParams = auditQuerySchema.parse(Object.fromEntries(searchParams))
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('[Audit API] Invalid query parameters', {
        issues: error.issues,
      })
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: error.issues },
        { status: 400 }
      )
    }
    throw error
  }

  // Step 5: Query audit logs
  const { includePII, limit, offset, ...filters } = queryParams

  const results = await queryAuditLogs(
    {
      ...filters,
      limit,
      offset,
    },
    includePII
  )

  const duration = Date.now() - startTime

  // Step 6: Self-audit - log this query
  const userId = jwtResult.payload?.sub || 'unknown'
  await logAuditQuery({
    queriedBy: userId,
    apiKeyId,
    filters: queryParams,
    resultCount: results.length,
    duration,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0],
    userAgent: request.headers.get('user-agent') || undefined,
  })

  // Step 7: Return results with headers
  return NextResponse.json(
    {
      data: results,
      meta: {
        count: results.length,
        limit,
        offset,
        hasMore: results.length === limit,
        queriedAt: new Date().toISOString(),
        duration,
      },
    },
    {
      headers: {
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetAt).toISOString(),
      },
    }
  )
}
