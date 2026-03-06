/**
 * API Endpoint: POST /api/admin/licenses/create
 * Tạo license key mới
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateLicenseKey } from '@/lib/raas-key-generator'
import { createLicense, logLicenseCreation } from '@/lib/raas-audit'
import { checkAdminAuth } from '../middleware'
import { logger } from '@/lib/utils/logger-utility'
import { Tier, TierLowercase } from '@/types'
import { createHash } from 'crypto'

const VALID_TIERS: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']

/**
 * POST /api/admin/licenses/create
 * Body: { tier: string, expiresAt?: number (timestamp), metadata?: object }
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { tier, expiresAt, metadata = {} } = body

    // Validate tier
    if (!tier || !VALID_TIERS.includes(tier.toUpperCase() as Tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be one of: BASIC, PREMIUM, ENTERPRISE, MASTER' },
        { status: 400 }
      )
    }

    const tierUpper = tier.toUpperCase() as Tier

    // Calculate expiration
    const now = Math.floor(Date.now() / 1000)
    let timestamp: number

    if (tierUpper === 'MASTER') {
      // Master tier = perpetual (timestamp = 0)
      timestamp = 0
    } else if (expiresAt) {
      timestamp = expiresAt
      if (timestamp <= now) {
        return NextResponse.json(
          { error: 'expiresAt must be in the future' },
          { status: 400 }
        )
      }
    } else {
      // Default: 1 year from now
      timestamp = now + (365 * 24 * 60 * 60)
    }

    // Get secret from env
    const secret = process.env.RAAS_LICENSE_SECRET
    if (!secret || secret.length < 16) {
      logger.error('RAAS_LICENSE_SECRET missing or too short')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Generate license key (key generator uses lowercase)
    const fullKey = generateLicenseKey(
      tierUpper.toLowerCase() as TierLowercase,
      new Date(timestamp * 1000),
      secret
    )

    // Parse nonce from key (format: raas_tier_timestamp_nonce_hmac)
    const parts = fullKey.split('_')
    const nonce = parts[3]

    // Create SHA256 hash of full key for secure storage
    const keyHash = createHash('sha256').update(fullKey).digest('hex')

    // Store license in Supabase
    const license = await createLicense({
      tier: tierUpper,
      nonce,
      keyHash,
      expiresAt: timestamp,
      createdBy: 'admin',
      metadata
    })

    // Log audit trail
    await logLicenseCreation({
      nonce,
      tier: tierUpper,
      timestamp: now,
      createdBy: 'admin'
    })

    logger.info(`License created: ${tierUpper} (${nonce})`)

    // Trả về full key CHỈ 1 LẦN DUY NHẤT
    return NextResponse.json({
      key: fullKey,
      license: {
        id: nonce,
        tier: tierUpper.toLowerCase(),
        createdAt: now,
        expiresAt: timestamp,
        isRevoked: false
      },
      warning: '⚠️ IMPORTANT: Copy this key now! It will never be shown again.'
    })

  } catch (error) {
    logger.error('API: POST /api/admin/licenses/create failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: 'Failed to create license' },
      { status: 500 }
    )
  }
}
