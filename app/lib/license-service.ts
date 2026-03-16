// License Service for Sophia ROIaaS Phase 2 (LICENSE_UI)
// Provides CRUD operations for license management with HMAC-signed keys

import { createHmac, randomBytes } from 'crypto'
import type {
  License,
  LicenseTier,
  LicenseStats,
  CreateLicenseInput,
} from './license-types'
import { UsageMetering } from './usage-metering'
import type { UsageSummary } from './usage-metering'
import {
  CreateLicenseInputSchema,
  UpdateSubscriptionInputSchema,
} from './license-schemas'

/**
 * Get HMAC secret from environment
 * Fallback to dev key in non-production
 */
function getHmacSecret(): string {
  return process.env.LICENSE_SECRET || 'dev-secret-key-change-in-prod'
}

/**
 * Generate HMAC signature for license key
 */
function generateHmacSignature(payload: string): string {
  return createHmac('sha256', getHmacSecret())
    .update(payload)
    .digest('hex')
    .substring(0, 8)
}

/**
 * Generate unique license key with HMAC signature
 * Format: RAAS-{TIER}-{RANDOM}-{TIMESTAMP}-{SIGNATURE}
 * All parts are uppercase hex
 */
function generateLicenseKey(tier: LicenseTier): string {
  const tierPrefix = tier.toUpperCase()
  // Use 4 bytes random (8 hex chars)
  const randomPart = randomBytes(4).toString('hex').toUpperCase()
  // Use 4 bytes timestamp-like (8 hex chars)
  const timestampPart = randomBytes(4).toString('hex').toUpperCase()
  const payload = `${tierPrefix}-${randomPart}-${timestampPart}`
  const signature = generateHmacSignature(payload)
  return `RAAS-${payload}-${signature.toUpperCase()}`
}

/**
 * Validate license key HMAC signature
 */
function validateLicenseKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false

  const parts = key.split('-')
  if (parts.length < 5) return false

  // Extract signature (last part)
  const providedSignature = parts[parts.length - 1]

  // Reconstruct payload: TIER-RANDOM-TIMESTAMP (skip 'RAAS' prefix at index 0)
  // Key format: RAAS-TIER-RANDOM-TIMESTAMP-SIGNATURE
  // Payload should be: TIER-RANDOM-TIMESTAMP
  const payload = parts.slice(1, -1).join('-')

  // Generate expected signature
  const expectedSignature = generateHmacSignature(payload)

  // Case-insensitive hex comparison
  const provided = Buffer.from(providedSignature.toLowerCase(), 'hex')
  const expected = Buffer.from(expectedSignature.toLowerCase(), 'hex')

  if (provided.length !== expected.length) return false

  let result = 0
  for (let i = 0; i < provided.length; i++) {
    result |= provided[i] ^ expected[i]
  }

  return result === 0
}

/**
 * Get default features by tier
 */
function getDefaultFeatures(tier: LicenseTier): string[] {
  const features: Record<LicenseTier, string[]> = {
    FREE: ['basic-video', 'watermark'],
    PRO: ['hd-video', 'no-watermark', 'custom-branding', 'api-access'],
    ENTERPRISE: [
      '4k-video',
      'no-watermark',
      'custom-branding',
      'api-access',
      'priority-support',
      'sla',
      'dedicated-account',
    ],
    MASTER: [
      '4k-video',
      'no-watermark',
      'custom-branding',
      'api-access',
      'priority-support',
      'sla',
      'dedicated-account',
      'white-glove-service',
      'custom-integrations',
    ],
  }
  return features[tier]
}

/**
 * License Service - Singleton pattern for license management
 */
class LicenseServiceClass {
  private licenses: Map<string, License> = new Map()

  constructor() {
    this.initializeMockData()
  }

  /**
   * Initialize with mock data for development
   */
  private initializeMockData(): void {
    const now = new Date()
    const mockLicenses: License[] = [
      {
        id: 'lic_001',
        tier: 'FREE',
        status: 'active',
        customerId: 'cust_001',
        customerName: 'Demo User',
        createdAt: now,
        features: ['basic-video', 'watermark'],
      },
      {
        id: 'lic_002',
        tier: 'PRO',
        status: 'active',
        customerId: 'cust_002',
        customerName: 'Startup Inc',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
        features: ['hd-video', 'no-watermark', 'custom-branding', 'api-access'],
      },
      {
        id: 'lic_003',
        tier: 'ENTERPRISE',
        status: 'active',
        customerId: 'cust_003',
        customerName: 'Enterprise Corp',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000),
        features: ['4k-video', 'no-watermark', 'custom-branding', 'api-access', 'priority-support', 'sla', 'dedicated-account'],
      },
    ]
    mockLicenses.forEach((license) => this.licenses.set(license.id, license))
  }

  /**
   * Get all licenses
   */
  getAll(): License[] {
    return Array.from(this.licenses.values())
  }

  /**
   * Get license by ID
   */
  getById(id: string): License | undefined {
    return this.licenses.get(id)
  }

  /**
   * Get license by customer ID
   */
  getByCustomerId(customerId: string): License | undefined {
    const allLicenses = Array.from(this.licenses.values())
    return allLicenses.find((license) => license.customerId === customerId)
  }

  /**
   * Create new license
   */
  create(input: CreateLicenseInput): License {
    // Validate input using Zod schema
    const validatedInput = CreateLicenseInputSchema.parse(input)

    const id = `lic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const licenseKey = generateLicenseKey(validatedInput.tier)
    const now = new Date()

    const license: License = {
      id,
      tier: validatedInput.tier,
      status: 'active',
      customerId: validatedInput.customerId,
      customerName: validatedInput.customerName,
      createdAt: now,
      expiresAt: validatedInput.expiresInDays
        ? new Date(now.getTime() + validatedInput.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
      features: validatedInput.features || getDefaultFeatures(validatedInput.tier),
      metadata: {
        licenseKey,
      },
    }

    this.licenses.set(id, license)
    return license
  }

  /**
   * Revoke license
   */
  revoke(id: string): License | undefined {
    const license = this.licenses.get(id)
    if (!license) {
      return undefined
    }

    license.status = 'revoked'
    this.licenses.set(id, license)
    return license
  }

  /**
   * Rotate license key (generate new key for existing license)
   */
  rotateKey(id: string): { license: License | undefined; newKey: string } | undefined {
    const license = this.licenses.get(id)
    if (!license) {
      return undefined
    }

    const newKey = generateLicenseKey(license.tier)
    const oldKey = license.metadata?.licenseKey as string | undefined

    license.metadata = {
      ...license.metadata,
      licenseKey: newKey,
      rotatedFrom: oldKey,
      rotatedAt: new Date().toISOString(),
    }

    this.licenses.set(id, license)
    return { license, newKey }
  }

  /**
   * Delete license
   */
  delete(id: string): boolean {
    return this.licenses.delete(id)
  }

  /**
   * Get license statistics
   */
  getStats(): LicenseStats {
    const licenses = this.getAll()

    const stats: LicenseStats = {
      total: licenses.length,
      byTier: { FREE: 0, PRO: 0, ENTERPRISE: 0, MASTER: 0 },
      byStatus: { active: 0, revoked: 0, expired: 0 },
    }

    licenses.forEach((license) => {
      stats.byTier[license.tier]++
      stats.byStatus[license.status]++
    })

    return stats
  }

  /**
   * Update subscription info (ROIaaS Phase 3)
   */
  updateSubscription(
    id: string,
    subscriptionId: string,
    subscriptionStatus: 'active' | 'cancelled' | 'uncancelled'
  ): License | undefined {
    const license = this.licenses.get(id)
    if (!license) {
      return undefined
    }

    // Validate subscription input using Zod schema
    UpdateSubscriptionInputSchema.parse({
      subscriptionId,
      subscriptionStatus,
    })

    license.subscriptionId = subscriptionId
    license.subscriptionStatus = subscriptionStatus
    this.licenses.set(id, license)
    return license
  }

  /**
   * Clear all licenses (for testing)
   */
  clear(): void {
    this.licenses.clear()
  }

  /**
   * Validate a license key using HMAC
   */
  validateKey(key: string): boolean {
    return validateLicenseKey(key)
  }

  /**
   * Get usage statistics for a license (ROIaaS Phase 4)
   * Integrates with UsageMetering service
   */
  getUsageStats(licenseId: string): {
    license: License | undefined
    usage: UsageSummary | null
    stats: {
      tier: string
      apiCalls: { used: number; limit: number; percent: number }
      transferMb: { used: number; limit: number; percent: number }
      status: 'normal' | 'warning' | 'critical' | 'exceeded'
    } | null
  } {
    const license = this.getById(licenseId)
    if (!license) {
      return { license: undefined, usage: null, stats: null }
    }

    const usage = UsageMetering.getUsage(licenseId)
    const stats = UsageMetering.getUsageStats(licenseId)

    return { license, usage, stats }
  }
}

// Singleton instance
export const LicenseService = new LicenseServiceClass()

// Export helper functions for CLI admin
export { generateLicenseKey, validateLicenseKey, getHmacSecret }
