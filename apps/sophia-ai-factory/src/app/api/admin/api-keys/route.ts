/**
 * API Key Management Routes
 *
 * GET /api/admin/api-keys - List all API keys for current user
 * POST /api/admin/api-keys - Create new API key
 *
 * Requires admin authentication via Basic Auth or JWT
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger-utility'

import {
  generateApiKey,
  getUserApiKeys,
  validateApiKey,
} from '@/lib/security/api-key-validator'
import { validateJwt } from '@/lib/security/jwt-validator'
import { logApiKeyCreation, logApiKeyValidationFailure } from '@/lib/audit/audit-query-logger'

export const dynamic = 'force-dynamic'

/**
 * Check admin authorization via Basic Auth or JWT
 * Returns user ID if authorized, null otherwise
 */
async function getAuthorizedUserId(request: NextRequest): Promise<string | null> {
  // Try JWT from Authorization header first (Bearer <token>)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const jwtResult = await validateJwt(authHeader)
    if (jwtResult.valid) {
      return jwtResult.payload?.sub || null
    }
  }

  // Try Better Auth session cookie (dashboard users)
  try {
    const { getCurrentUserFromHeaders } = await import('@/lib/better-auth-session')
    const user = await getCurrentUserFromHeaders(request.headers)
    if (user) return user.id
  } catch { /* Better Auth session check failed */ }

  // Legacy: Try JWT from auth-token cookie
  const cookieToken = request.cookies.get('auth-token')?.value
  if (cookieToken) {
    const jwtResult = await validateJwt(`Bearer ${cookieToken}`)
    if (jwtResult.valid) {
      return jwtResult.payload?.sub || null
    }
  }

  // Fallback to Basic Auth
  if (authHeader) {
    try {
      const authValue = authHeader.split(' ')[1]
      const [user, pwd] = atob(authValue).split(':')
      const validUser = process.env.ADMIN_USER
      const validPass = process.env.ADMIN_PASS
      if (user === validUser && pwd === validPass) {
        return 'admin-basic-auth'
      }
    } catch {
      // Invalid basic auth format
    }
  }

  return null
}

/**
 * GET /api/admin/api-keys
 * List all API keys for the authenticated user
 */
export async function GET(request: NextRequest) {
  const userId = await getAuthorizedUserId(request)

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const apiKeys = await getUserApiKeys(userId)

    return NextResponse.json({
      success: true,
      count: apiKeys.length,
      keys: apiKeys.map(key => ({
        keyId: key.keyId,
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        rateLimitPerMinute: key.rateLimitPerMinute,
        // Don't include full key - only shown on creation
      })),
    })
  } catch (error) {
    logger.error('[API Keys] Failed to fetch API keys', error as Error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/api-keys
 * Create a new API key
 *
 * Body:
 * - permissions: string[] (required) - e.g., ['audit:read', 'audit:write']
 * - expiresAt: number (optional) - Expiration timestamp in ms
 * - rateLimitPerMinute: number (optional, default 100)
 */
export async function POST(request: NextRequest) {
  const userId = await getAuthorizedUserId(request)

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    // Validate request body
    if (!body.permissions || !Array.isArray(body.permissions)) {
      return NextResponse.json(
        { error: 'permissions array is required' },
        { status: 400 }
      )
    }

    const validPermissions = ['audit:read', 'audit:write', 'reports:download', 'reports:generate']
    const invalidPermissions = body.permissions.filter(
      (p: string) => !validPermissions.includes(p)
    )

    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { error: 'Invalid permissions', invalid: invalidPermissions },
        { status: 400 }
      )
    }

    const expiresAt = body.expiresAt ? Number(body.expiresAt) : undefined
    const rateLimitPerMinute = body.rateLimitPerMinute ? Number(body.rateLimitPerMinute) : 100

    // Generate API key
    const result = await generateApiKey(
      userId,
      body.permissions,
      expiresAt,
      rateLimitPerMinute
    )

    // Log the creation
    await logApiKeyCreation(
      userId,
      result.keyId,
      body.permissions,
      request.headers.get('x-forwarded-for')?.split(',')[0]
    )

    logger.info('[API Keys] Created new API key', {
      keyId: result.keyId,
      keyPrefix: result.keyPrefix,
      userId,
    })

    return NextResponse.json({
      success: true,
      key: {
        apiKey: result.apiKey, // Full key - only shown once!
        keyId: result.keyId,
        keyPrefix: result.keyPrefix,
        permissions: body.permissions,
        expiresAt,
        rateLimitPerMinute,
        createdAt: Date.now(),
      },
      warning: 'Store this API key securely. It will never be shown again.',
    })
  } catch (error) {
    logger.error('[API Keys] Failed to create API key', error as Error)
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}
