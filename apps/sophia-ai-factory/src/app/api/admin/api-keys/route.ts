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
import { toError, getErrorMessage } from '@/lib/utils/to-error'

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
    logger.error('[API Keys] Failed to fetch API keys', toError(error))
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}

const PERMISSION_VALUES = ['audit:read', 'audit:write', 'reports:download', 'reports:generate'] as const

const createApiKeyBodySchema = z.object({
  permissions: z.array(z.enum(PERMISSION_VALUES)).min(1, 'permissions array is required'),
  expiresAt: z.coerce.number().int().positive().optional(),
  rateLimitPerMinute: z.coerce.number().int().positive().default(100),
})

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
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createApiKeyBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { permissions, expiresAt, rateLimitPerMinute } = parsed.data

    // Generate API key
    const result = await generateApiKey(
      userId,
      permissions,
      expiresAt,
      rateLimitPerMinute
    )

    // Log the creation (non-blocking — don't fail key creation if audit log fails)
    logApiKeyCreation(
      userId,
      result.keyId,
      permissions,
      request.headers.get('x-forwarded-for')?.split(',')[0]
    ).catch(e => logger.error('[API Keys] Audit log failed', toError(e)))

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
        permissions,
        expiresAt,
        rateLimitPerMinute,
        createdAt: Date.now(),
      },
      warning: 'Store this API key securely. It will never be shown again.',
    })
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('[API Keys] Failed to create API key', toError(error))
    return NextResponse.json(
      { error: `Failed to create API key: ${msg}` },
      { status: 500 }
    )
  }
}
