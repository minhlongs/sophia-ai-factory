/**
 * API Key Management Route - Single Key Operations
 *
 * DELETE /api/admin/api-keys/[id] - Revoke/delete an API key
 *
 * Requires admin authentication via Better Auth session + role check
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin'

import {
  revokeApiKey,
  deleteApiKey,
} from '@/seed/security/api-key-validator'
import { logApiKeyRevocation } from '@/tree/audit/audit-query-logger'

export const dynamic = 'force-dynamic'

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
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;
  const userId = auth.user.id;

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
