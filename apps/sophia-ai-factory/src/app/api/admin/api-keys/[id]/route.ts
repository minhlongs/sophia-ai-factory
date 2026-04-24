/**
 * API Key Management Route - Single Key Operations
 *
 * DELETE /api/admin/api-keys/[id] - Revoke/delete an API key
 *
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger-utility'
import { toError } from '@/lib/utils/to-error'

import {
  revokeApiKey,
  deleteApiKey,
  validateApiKey,
} from '@/lib/security/api-key-validator'
import { validateJwt } from '@/lib/security/jwt-validator'
import { logApiKeyRevocation } from '@/lib/audit/audit-query-logger'

export const dynamic = 'force-dynamic'

/**
 * Check admin authorization via Basic Auth or JWT
 * Returns user ID if authorized, null otherwise
 */
async function getAuthorizedUserId(request: NextRequest): Promise<string | null> {
  // Try JWT first (Authorization: Bearer <token>)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const jwtResult = await validateJwt(authHeader)
    if (jwtResult.valid) {
      return jwtResult.payload?.sub || null
    }
  }

  // Fallback to Basic Auth
  const basicAuth = authHeader
  if (basicAuth) {
    try {
      const authValue = basicAuth.split(' ')[1]
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
 * DELETE /api/admin/api-keys/[id]
 * Revoke an API key (soft delete - marks as revoked)
 *
 * Query params:
 * - hard: boolean (optional) - If true, permanently delete instead of revoke
 * - reason: string (optional) - Reason for revocation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthorizedUserId(request)

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const keyId = (await params).id

  try {
    // Check if hard delete is requested
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true'
    const reason = searchParams.get('reason') || undefined

    let success: boolean

    if (hardDelete) {
      // Permanent deletion
      success = await deleteApiKey(keyId)

      if (success) {
        logger.info('[API Keys] Permanently deleted API key', {
          keyId,
          deletedBy: userId,
        })
      }
    } else {
      // Soft revoke
      success = await revokeApiKey(keyId)

      if (success) {
        // Log the revocation
        await logApiKeyRevocation(
          userId,
          keyId,
          reason,
          request.headers.get('x-forwarded-for')?.split(',')[0]
        )

        logger.info('[API Keys] Revoked API key', {
          keyId,
          revokedBy: userId,
          reason,
        })
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete API key', keyId },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'API key permanently deleted' : 'API key revoked',
      keyId,
    })
  } catch (error) {
    logger.error('[API Keys] Failed to delete API key', toError(error))
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
