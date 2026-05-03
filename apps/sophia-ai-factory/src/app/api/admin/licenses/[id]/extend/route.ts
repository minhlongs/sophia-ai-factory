/**
 * API Endpoint: POST /api/admin/licenses/[id]/extend
 * Extend license expiration by specified duration
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getLicenseByNonce,
  extendLicense as extendLicenseService,
  logLicenseExtension
} from '@/lib/raas-audit'
import { requireAdmin } from '@/seed/auth/require-admin'
import { logger } from '@/seed/utils/logger-utility'
import { z } from 'zod'

/**
 * Request body validation
 */
const extendLicenseSchema = z.object({
  days: z.number().int().positive().max(730) // Max 2 years
})

/**
 * POST /api/admin/licenses/[id]/extend
 * Body: { days: number } - 7, 30, 90, 180, 365, 730
 */
export async function POST(
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

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const validated = extendLicenseSchema.parse(body)
    const { days } = validated

    // Get existing license
    const existingLicense = await getLicenseByNonce(nonce)
    if (!existingLicense) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      )
    }

    // Check if already revoked
    if (existingLicense.is_revoked) {
      return NextResponse.json(
        { error: 'Cannot extend a revoked license. Reactivate first.' },
        { status: 400 }
      )
    }

    // Check if master tier (perpetual - cannot extend)
    if (existingLicense.tier === 'MASTER') {
      return NextResponse.json(
        { error: 'Master tier licenses are perpetual and cannot be extended' },
        { status: 400 }
      )
    }

    // Store previous expiration for audit
    const previousExpiresAt = existingLicense.expires_at

    // Extend license
    const updatedLicense = await extendLicenseService(nonce, days, 'admin')

    // Calculate new expiration timestamp
    const newExpiresAt = (previousExpiresAt ?? Math.floor(Date.now() / 1000)) + (days * 24 * 60 * 60)

    // Log audit trail
    await logLicenseExtension({
      nonce,
      tier: existingLicense.tier,
      days,
      extendedBy: 'admin',
      previousExpiresAt: previousExpiresAt ?? undefined,
      newExpiresAt
    })

    logger.info(`License extended: ${nonce} by ${days} days`)

    const now = Math.floor(Date.now() / 1000)

    return NextResponse.json({
      success: true,
      extendedAt: now,
      license: {
        id: updatedLicense.nonce,
        tier: updatedLicense.tier.toLowerCase(),
        previousExpiresAt,
        newExpiresAt: updatedLicense.expires_at,
        daysAdded: days,
        metadata: updatedLicense.metadata
      },
      message: `License extended by ${days} days successfully`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid extend request', { issues: error.issues })
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    logger.error('API: POST /api/admin/licenses/[id]/extend failed', error instanceof Error ? error : new Error(String(error)))

    const errorMessage = error instanceof Error ? error.message : 'Failed to extend license'
    return NextResponse.json(
      { error: errorMessage },
      { status: error instanceof Error && error.message.includes('not found') ? 404 : 500 }
    )
  }
}
