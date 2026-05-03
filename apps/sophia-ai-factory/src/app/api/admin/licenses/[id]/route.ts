/**
 * API Endpoint: GET /api/admin/licenses/[id]
 * Get license details by nonce
 *
 * API Endpoint: POST /api/admin/licenses/[id]/revoke
 * Revoke license key
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLicenseByNonce, revokeLicense, logLicenseRevocation } from '@/forest/raas-audit'
import { requireAdmin } from '@/seed/auth/require-admin'
import { logger } from '@/seed/utils/logger-utility'

/**
 * GET /api/admin/licenses/[id]
 * Get license by nonce (id)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: nonce } = await params

    if (!nonce) {
      return NextResponse.json(
        { error: 'License ID (nonce) is required' },
        { status: 400 }
      )
    }

    const license = await getLicenseByNonce(nonce)

    if (!license) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const isExpired = license.expires_at !== null && license.expires_at !== 0 && license.expires_at < now
    const validateCount = (license.metadata as { validateCount?: number })?.validateCount || 0

    return NextResponse.json({
      license: {
        id: license.nonce,
        tier: license.tier,
        createdAt: license.created_at,
        expiresAt: license.expires_at,
        isRevoked: license.is_revoked,
        isExpired,
        validateCount,
        metadata: license.metadata || {}
      }
    })

  } catch (error) {
    logger.error('API: GET /api/admin/licenses/[id] failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to fetch license details' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/licenses/[id]/revoke
 * Revoke license by nonce (id)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: nonce } = await params
    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    const { reason } = body

    if (!nonce) {
      return NextResponse.json(
        { error: 'License ID (nonce) is required' },
        { status: 400 }
      )
    }

    // Get license to find tier
    const existingLicense = await getLicenseByNonce(nonce)
    if (!existingLicense) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      )
    }

    // Revoke license
    await revokeLicense(nonce, 'admin')

    // Log audit trail with optional reason
    await logLicenseRevocation({
      nonce,
      tier: existingLicense.tier,
      revokedBy: 'admin',
      reason
    })

    const now = Math.floor(Date.now() / 1000)

    logger.info(`License revoked: ${nonce}`)

    return NextResponse.json({
      success: true,
      revokedAt: now,
      message: 'License key has been revoked successfully'
    })

  } catch (error) {
    logger.error('API: POST /api/admin/licenses/[id]/revoke failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to revoke license' },
      { status: 500 }
    )
  }
}
