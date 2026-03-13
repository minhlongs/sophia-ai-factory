import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditLogger } from './audit-logger'
import type { License } from './license-types'

describe('audit-logger', () => {
  beforeEach(() => {
    AuditLogger.clear()
    AuditLogger.setEnabled(true)
    vi.clearAllMocks()
  })

  describe('AuditLogger Singleton', () => {
    it('should be a singleton instance', () => {
      expect(AuditLogger).toBeDefined()
      expect(typeof AuditLogger.log).toBe('function')
    })

    it('should start with empty logs', () => {
      expect(AuditLogger.getAll()).toHaveLength(0)
    })
  })

  describe('logLicenseCreate', () => {
    it('should log license creation', () => {
      const mockLicense: Partial<License> = {
        id: 'lic_123',
        customerId: 'cust_456',
        customerName: 'Test Customer',
        tier: 'PRO',
        status: 'active',
        features: ['feature1', 'feature2'],
        metadata: { key: 'value' },
      }

      const log = AuditLogger.logLicenseCreate(mockLicense as License)

      expect(log).toBeDefined()
      expect(log.action).toBe('LICENSE_CREATE')
      expect(log.entity).toBe('LICENSE')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.customerId).toBe('cust_456')
      expect(log.details.customerName).toBe('Test Customer')
      expect(log.details.tier).toBe('PRO')
      expect(log.details.status).toBe('active')
    })

    it('should add log to history', () => {
      const mockLicense: Partial<License> = {
        id: 'lic_123',
        customerId: 'cust_456',
        customerName: 'Test Customer',
        tier: 'PRO',
        status: 'active',
        features: [],
        createdAt: new Date(),
      }

      AuditLogger.logLicenseCreate(mockLicense as Partial<License> as License)
      const logs = AuditLogger.getAll()

      expect(logs).toHaveLength(1)
      expect(logs[0].action).toBe('LICENSE_CREATE')
    })
  })

  describe('logLicenseRead', () => {
    it('should log license read', () => {
      const log = AuditLogger.logLicenseRead('lic_123', 'cust_456')

      expect(log.action).toBe('LICENSE_READ')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.customerId).toBe('cust_456')
    })

    it('should work without customerId', () => {
      const log = AuditLogger.logLicenseRead('lic_123')

      expect(log.action).toBe('LICENSE_READ')
      expect(log.details.customerId).toBeUndefined()
    })
  })

  describe('logLicenseUpdate', () => {
    it('should log license update with status change', () => {
      const log = AuditLogger.logLicenseUpdate('lic_123', { status: 'revoked' })

      expect(log.action).toBe('LICENSE_UPDATE')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.status).toBe('revoked')
    })

    it('should log license update with tier change', () => {
      const log = AuditLogger.logLicenseUpdate('lic_123', { tier: 'ENTERPRISE' })

      expect(log.action).toBe('LICENSE_UPDATE')
      expect(log.details.tier).toBe('ENTERPRISE')
    })

    it('should log license update with features change', () => {
      const log = AuditLogger.logLicenseUpdate('lic_123', {
        features: ['new-feature'],
      })

      expect(log.action).toBe('LICENSE_UPDATE')
      expect(log.details.features).toEqual(['new-feature'])
    })
  })

  describe('logLicenseDelete', () => {
    it('should log license deletion', () => {
      const log = AuditLogger.logLicenseDelete('lic_123', 'cust_456')

      expect(log.action).toBe('LICENSE_DELETE')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.customerId).toBe('cust_456')
    })

    it('should work without customerId', () => {
      const log = AuditLogger.logLicenseDelete('lic_123')

      expect(log.action).toBe('LICENSE_DELETE')
      expect(log.details.customerId).toBeUndefined()
    })
  })

  describe('logLicenseRevoke', () => {
    it('should log license revocation', () => {
      const log = AuditLogger.logLicenseRevoke('lic_123', 'cust_456')

      expect(log.action).toBe('LICENSE_REVOKE')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.customerId).toBe('cust_456')
      expect(log.details.status).toBe('revoked')
    })

    it('should include reason if provided', () => {
      const log = AuditLogger.logLicenseRevoke(
        'lic_123',
        'cust_456',
        'Payment failed'
      )

      expect(log.details.metadata).toEqual({ reason: 'Payment failed' })
    })
  })

  describe('logSubscriptionUpdate', () => {
    it('should log active subscription', () => {
      const log = AuditLogger.logSubscriptionUpdate(
        'lic_123',
        'sub_456',
        'active'
      )

      expect(log.action).toBe('SUBSCRIPTION_UPDATE')
      expect(log.entity).toBe('SUBSCRIPTION')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.subscriptionId).toBe('sub_456')
      expect(log.details.subscriptionStatus).toBe('active')
    })

    it('should log cancelled subscription', () => {
      const log = AuditLogger.logSubscriptionUpdate(
        'lic_123',
        'sub_456',
        'cancelled'
      )

      expect(log.details.subscriptionStatus).toBe('cancelled')
    })

    it('should log uncancelled subscription', () => {
      const log = AuditLogger.logSubscriptionUpdate(
        'lic_123',
        'sub_456',
        'uncancelled'
      )

      expect(log.details.subscriptionStatus).toBe('uncancelled')
    })
  })

  describe('logUsageAccess', () => {
    it('should log usage access', () => {
      const log = AuditLogger.logUsageAccess('lic_123', 'cust_456', 'api_calls')

      expect(log.action).toBe('USAGE_ACCESS')
      expect(log.entity).toBe('USAGE')
      expect(log.entityId).toBe('lic_123')
      expect(log.details.customerId).toBe('cust_456')
      expect(log.details.metadata).toEqual({ usageType: 'api_calls' })
    })

    it('should work without usageType', () => {
      const log = AuditLogger.logUsageAccess('lic_123')

      expect(log.action).toBe('USAGE_ACCESS')
      expect(log.details.metadata).toEqual({})
    })
  })

  describe('getByEntityId', () => {
    it('should filter logs by entity ID', () => {
      AuditLogger.logLicenseCreate({
        id: 'lic_111',
        customerId: 'cust_1',
        customerName: 'Customer 1',
        tier: 'PRO',
        status: 'active',
        features: [],
        createdAt: new Date(),
      } as Partial<License> as License)
      AuditLogger.logLicenseCreate({
        id: 'lic_222',
        customerId: 'cust_2',
        customerName: 'Customer 2',
        tier: 'PRO',
        status: 'active',
        features: [],
        createdAt: new Date(),
      } as Partial<License> as License)
      AuditLogger.logLicenseRead('lic_111')

      const logs = AuditLogger.getByEntityId('lic_111')

      expect(logs).toHaveLength(2)
      expect(logs.every((log) => log.entityId === 'lic_111')).toBe(true)
    })
  })

  describe('getByAction', () => {
    it('should filter logs by action', () => {
      AuditLogger.logLicenseCreate({
        id: 'lic_111',
        customerId: 'cust_1',
        customerName: 'Customer 1',
        tier: 'PRO',
        status: 'active',
        features: [],
        createdAt: new Date(),
      } as Partial<License> as License)
      AuditLogger.logLicenseRead('lic_111')
      AuditLogger.logLicenseRead('lic_222')

      const logs = AuditLogger.getByAction('LICENSE_READ')

      expect(logs).toHaveLength(2)
      expect(logs.every((log) => log.action === 'LICENSE_READ')).toBe(true)
    })
  })

  describe('setEnabled', () => {
    it('should disable logging when set to false', () => {
      AuditLogger.setEnabled(false)
      const log = AuditLogger.logLicenseRead('lic_123')

      expect(log).toBeNull()
    })

    it('should enable logging when set to true', () => {
      AuditLogger.setEnabled(true)
      const log = AuditLogger.logLicenseRead('lic_123')

      expect(log).not.toBeNull()
      expect(log.action).toBe('LICENSE_READ')
    })
  })

  describe('clear', () => {
    it('should clear all logs', () => {
      AuditLogger.logLicenseRead('lic_123')
      AuditLogger.logLicenseRead('lic_456')

      expect(AuditLogger.getAll()).toHaveLength(2)

      AuditLogger.clear()

      expect(AuditLogger.getAll()).toHaveLength(0)
    })
  })
})
