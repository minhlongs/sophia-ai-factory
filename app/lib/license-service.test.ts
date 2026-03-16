import { describe, it, expect, beforeEach } from 'vitest'
import { LicenseService, generateLicenseKey, validateLicenseKey } from './license-service'
import type { LicenseTier } from './license-types'

describe('LicenseService - Phase 2 (LICENSE_UI)', () => {
  beforeEach(() => {
    // Reset to mock data
    LicenseService.clear()
  })

  describe('generateLicenseKey', () => {
    it('generates key with correct format RAAS-{TIER}-{RANDOM}-{SIGNATURE}', () => {
      const key = generateLicenseKey('PRO')
      expect(key).toMatch(/^RAAS-PRO-[A-F0-9]+-[A-F0-9]+-[A-F0-9]+$/)
    })

    it('generates different keys for different tiers', () => {
      const proKey = generateLicenseKey('PRO')
      const enterpriseKey = generateLicenseKey('ENTERPRISE')
      expect(proKey).not.toBe(enterpriseKey)
      expect(proKey).toContain('PRO')
      expect(enterpriseKey).toContain('ENTERPRISE')
    })

    it('generates unique keys on each call', () => {
      const keys = new Set([generateLicenseKey('FREE'), generateLicenseKey('FREE'), generateLicenseKey('FREE')])
      expect(keys.size).toBe(3)
    })
  })

  describe('validateLicenseKey', () => {
    it('returns true for valid HMAC-signed key', () => {
      const key = generateLicenseKey('PRO')
      expect(validateLicenseKey(key)).toBe(true)
    })

    it('returns false for invalid key format', () => {
      expect(validateLicenseKey('')).toBe(false)
      expect(validateLicenseKey('invalid-key')).toBe(false)
      expect(validateLicenseKey('RAAS-PRO-123')).toBe(false)
    })

    it('returns false for tampered key', () => {
      const key = generateLicenseKey('PRO')
      const tampered = key.slice(0, -1) + 'X'
      expect(validateLicenseKey(tampered)).toBe(false)
    })
  })

  describe('LicenseService.create', () => {
    it('creates license with HMAC-signed key', () => {
      const license = LicenseService.create({
        tier: 'PRO',
        customerId: 'cust_test',
        customerName: 'Test Customer',
        expiresInDays: 30,
      })

      expect(license.id).toMatch(/^lic_/)
      expect(license.tier).toBe('PRO')
      expect(license.metadata?.licenseKey).toMatch(/^RAAS-PRO-/)
      expect(validateLicenseKey(license.metadata!.licenseKey as string)).toBe(true)
    })

    it('assigns default features by tier', () => {
      const proLicense = LicenseService.create({
        tier: 'PRO',
        customerId: 'cust_pro',
        customerName: 'Pro Customer',
      })
      expect(proLicense.features).toContain('hd-video')
      expect(proLicense.features).toContain('api-access')

      const enterpriseLicense = LicenseService.create({
        tier: 'ENTERPRISE',
        customerId: 'cust_ent',
        customerName: 'Enterprise Customer',
      })
      expect(enterpriseLicense.features).toContain('4k-video')
      expect(enterpriseLicense.features).toContain('sla')
    })
  })

  describe('LicenseService.rotateKey', () => {
    it('generates new valid key for existing license', () => {
      const license = LicenseService.create({
        tier: 'PRO',
        customerId: 'cust_rotate',
        customerName: 'Rotate Test',
      })

      const oldKey = license.metadata?.licenseKey
      const result = LicenseService.rotateKey(license.id)

      expect(result).toBeDefined()
      expect(result?.newKey).toBeDefined()
      expect(validateLicenseKey(result!.newKey)).toBe(true)
      expect(oldKey).not.toBe(result?.newKey)
    })

    it('stores rotation metadata', () => {
      const license = LicenseService.create({
        tier: 'ENTERPRISE',
        customerId: 'cust_rot',
        customerName: 'Rotation Test',
      })

      const result = LicenseService.rotateKey(license.id)
      const updated = LicenseService.getById(license.id)

      expect(updated?.metadata?.rotatedFrom).toBeDefined()
      expect(updated?.metadata?.rotatedAt).toBeDefined()
    })

    it('returns undefined for non-existent license', () => {
      const result = LicenseService.rotateKey('non-existent-id')
      expect(result).toBeUndefined()
    })
  })

  describe('LicenseService.validateKey', () => {
    it('validates existing license key', () => {
      const license = LicenseService.create({
        tier: 'MASTER',
        customerId: 'cust_val',
        customerName: 'Validation Test',
      })

      const isValid = LicenseService.validateKey(license.metadata!.licenseKey as string)
      expect(isValid).toBe(true)
    })

    it('rejects invalid key', () => {
      const isValid = LicenseService.validateKey('RAAS-FAKE-12345678-ABCDEFGH')
      expect(isValid).toBe(false)
    })
  })

  describe('LicenseService.getStats', () => {
    it('returns correct tier and status counts', () => {
      LicenseService.clear()
      LicenseService.create({ tier: 'FREE', customerId: 'c1', customerName: 'Free 1' })
      LicenseService.create({ tier: 'PRO', customerId: 'c2', customerName: 'Pro 1' })
      LicenseService.create({ tier: 'PRO', customerId: 'c3', customerName: 'Pro 2' })

      const stats = LicenseService.getStats()

      expect(stats.total).toBe(3)
      expect(stats.byTier.FREE).toBe(1)
      expect(stats.byTier.PRO).toBe(2)
      expect(stats.byTier.ENTERPRISE).toBe(0)
      expect(stats.byTier.MASTER).toBe(0)
      expect(stats.byStatus.active).toBe(3)
    })
  })
})
