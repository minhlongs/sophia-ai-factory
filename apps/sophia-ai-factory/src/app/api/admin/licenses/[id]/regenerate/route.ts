/**
 * API Endpoint: POST /api/admin/licenses/[id]/regenerate
 * Regenerate a license key with new key but same metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getLicenseByNonce,
  revokeLicense,
  createLicense,
  logLicenseRevocation,
  logLicenseCreation
} from '@/lib/raas-audit'
import { generateLicenseKey, generateMasterKey } from '@/lib/raas-key-generator'
import { requireAdmin } from '@/seed/auth/require-admin'
import { logger } from '@/seed/utils/logger-utility'
import { Tier, TierLowercase } from '@/seed/types'
import { createHash } from 'crypto'

/**
 * POST /api/admin/licenses/[id]/regenerate
 * Regenerate license by creating new key with same metadata
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: oldLicenseNonce } = await params

    if (!oldLicenseNonce) {
      return NextResponse.json(
        { error: 'License ID is required' },
        { status: 400 }
      )
    }

    // Get existing license
    const existingLicense = await getLicenseByNonce(oldLicenseNonce)
    if (!existingLicense) {
      return NextResponse.json(
        { error: 'License not found' },
        { status: 404 }
      )
    }

    // Revoke old license first
    await revokeLicense(oldLicenseNonce, 'admin')
    await logLicenseRevocation({
      nonce: oldLicenseNonce,
      tier: existingLicense.tier,
      revokedBy: 'admin',
      reason: 'Regenerated - replaced by new key'
    })

    // Get secret from env
    const secret = process.env.RAAS_LICENSE_SECRET
    if (!secret || secret.length < 16) {
      logger.error('RAAS_LICENSE_SECRET missing or too short')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Generate new key based on tier
    const tierLower = existingLicense.tier.toLowerCase() as TierLowercase
    const isMaster = existingLicense.tier === 'MASTER'
    const newKey = isMaster
      ? generateMasterKey(tierLower, secret)
      : generateLicenseKey(tierLower, new Date((existingLicense.expires_at ?? 0) * 1000), secret)

    // Parse nonce from key (format: raas_tier_timestamp_nonce_hmac)
    const parts = newKey.split('_')
    const newNonce = parts[3]

    // Create SHA256 hash of full key for secure storage
    const newKeyHash = createHash('sha256').update(newKey).digest('hex')

    // Create new license with same metadata
    const newLicense = await createLicense({
      tier: existingLicense.tier as Tier,
      nonce: newNonce,
      keyHash: newKeyHash,
      expiresAt: existingLicense.expires_at ?? 0,
      createdBy: 'admin',
      metadata: (existingLicense.metadata as Record<string, unknown>) ?? {}
    })

    // Log creation
    await logLicenseCreation({
      nonce: newNonce,
      tier: existingLicense.tier as Tier,
      timestamp: Math.floor(Date.now() / 1000),
      createdBy: 'admin'
    })

    logger.info(`License regenerated: ${oldLicenseNonce} -> ${newNonce}`)

    const now = Math.floor(Date.now() / 1000)

    return NextResponse.json({
      success: true,
      newKey,
      newLicense: {
        id: newNonce,
        tier: existingLicense.tier.toLowerCase(),
        createdAt: now,
        expiresAt: newLicense.expires_at,
        isRevoked: newLicense.is_revoked,
        metadata: newLicense.metadata
      },
      oldLicenseId: oldLicenseNonce,
      message: 'License regenerated successfully. Old key is now invalid.'
    })

  } catch (error) {
    logger.error('API: POST /api/admin/licenses/[id]/regenerate failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to regenerate license' },
      { status: 500 }
    )
  }
}
