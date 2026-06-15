/**
 * API Endpoint: POST /api/admin/licenses/[id]/reactivate
 * Reactivate a revoked license by setting is_revoked = false
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLicenseByNonce } from '@/forest/raas-audit'
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin'
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { createServerClient } from '@/seed/db/client'

interface ReactivatedLicenseRow {
  nonce: string
  tier: string
  metadata: Record<string, unknown> | null
}

/**
 * POST /api/admin/licenses/[id]/reactivate
 * Reactivate revoked license
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: nonce } = await params

    if (!nonce) {
      return NextResponse.json(
        { error: 'License ID is required' },
        { status: 400 }
      )
    }

    // Get existing license
    const existingLicense = await getLicenseByNonce(nonce)
    if (!existingLicense) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      )
    }

    // Check if already active
    if (!existingLicense.is_revoked) {
      return NextResponse.json(
        { error: 'License is already active' },
        { status: 400 }
      )
    }

    // Reactivate license
    const db = createServerClient()
    const { data: rawData, error } = await (db.from('raas_licenses') as ReturnType<typeof db.from>)
      .update({
        is_revoked: false,
        revoked_at: null,
        revoked_by: null
      })
      .eq('nonce', nonce)
      .select()
      .single()
    const data = rawData as ReactivatedLicenseRow | null

    if (error) {
      logger.error('Failed to reactivate license', toError(error))
      return NextResponse.json(
        { error: 'Failed to reactivate license' },
        { status: 500 }
      )
    }

    logger.info(`License reactivated: ${nonce}`)

    const now = Math.floor(Date.now() / 1000)

    return NextResponse.json({
      success: true,
      reactivatedAt: now,
      license: {
        id: data?.nonce ?? nonce,
        tier: data?.tier?.toLowerCase() ?? '',
        isRevoked: false,
        metadata: data?.metadata ?? null
      },
      message: 'License has been reactivated successfully'
    })

  } catch (error) {
    logger.error('API: POST /api/admin/licenses/[id]/reactivate failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to reactivate license' },
      { status: 500 }
    )
  }
}
