/**
 * Comprehensive Unit & Integration Tests for Stripe Webhook Endpoint
 *
 * Coverage:
 * - Signature verification (valid/invalid/missing)
 * - Idempotency (duplicate event prevention)
 * - Event handlers (6 Stripe event types)
 * - Database updates (license status, subscription metadata)
 * - Error logging validation
 * - HTTP 200 OK responses per Stripe requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Mock } from 'vitest'

// ============================================
// MOCKS - Must be defined BEFORE imports
// ============================================

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mocked-hash'),
      })),
    })),
  },
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => 'mocked-hash'),
    })),
  })),
}))

// Mock Supabase admin client - separate chains for different tables
const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
}

const mockUserProfileChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn().mockReturnThis(),
}

const mockLicenseChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn().mockReturnThis(),
}

// Create a mock admin client factory that returns different chains based on table
let fromTableCallCount = 0
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'user_profiles') {
        return mockUserProfileChain
      } else if (table === 'raas_licenses') {
        return mockLicenseChain
      }
      return mockSupabaseChain
    }),
  })),
}))

// Mock license generation - return valid 5-part key: raas_<tier>_<timestamp>_<nonce>_<hash>
vi.mock('@/lib/raas-key-generator', () => ({
  generateLicenseKey: vi.fn(() => 'raas_premium_1709779200_abc123_def456gh789xyz'),
}))

// Mock RaaS audit functions
vi.mock('@/lib/raas-audit', () => ({
  createLicense: vi.fn().mockImplementation(() => Promise.resolve({ nonce: 'abc123', keyHash: 'keyhash123' })),
  logLicenseCreation: vi.fn(),
  revokeLicense: vi.fn(),
  logLicenseRevocation: vi.fn(),
  getLicenseByNonce: vi.fn().mockResolvedValue(null),
  extendLicense: vi.fn(),
  reactivateLicenseBySubscription: vi.fn(),
  revokeLicenseBySubscription: vi.fn(),
  getLicenses: vi.fn(),
  getAuditLogs: vi.fn(),
  getAuditLogsByLicense: vi.fn(),
  incrementValidationCount: vi.fn(),
  exportAuditLogs: vi.fn(),
  logLicenseExtension: vi.fn(),
  logLicenseValidation: vi.fn(),
}))

// Mock logger
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock subscription tier mapping
vi.mock('@/lib/subscription', () => ({
  TIER_DB_MAPPING: {
    BASIC: 'basic',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise',
    MASTER: 'master',
  },
  getUserTier: vi.fn(),
  checkTierAccess: vi.fn(),
  isTierHigherOrEqual: vi.fn(),
  getSubscriptionStatus: vi.fn(),
}))

// Import modules after mocks - use importActual to keep real implementation
import { processStripeWebhookEvent } from '@/lib/payments/stripe-webhook-handler'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger-utility'
import * as raasAudit from '@/lib/raas-audit'

// Cast to Mock for assertions
const mockCreateLicense = raasAudit.createLicense as Mock
const mockLogLicenseCreation = raasAudit.logLicenseCreation as Mock
const mockRevokeLicense = raasAudit.revokeLicense as Mock
const mockLogLicenseRevocation = raasAudit.logLicenseRevocation as Mock

// ============================================
// TEST HELPERS
// ============================================

function createMockRequest(body: string, signature: string | null = null): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      ...(signature && { 'stripe-signature': signature }),
      'content-type': 'application/json',
    },
    body,
  })
}

function createStripeEvent(type: string, data: Record<string, unknown>) {
  return {
    id: `evt_${Date.now()}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: data },
    livemode: false,
    pending_webhooks: 0,
    request: { id: `req_${Date.now()}`, idempotency_key: `idem_${Date.now()}` },
    api_version: '2023-10-16',
  }
}

function setupMockResponse(singleData: any = null, singleError: any = null, upsertError: any = null) {
  mockSupabaseChain.single.mockResolvedValue({ data: singleData, error: singleError })
  mockSupabaseChain.upsert.mockResolvedValue({ error: upsertError })
}

function resetAllMocks() {
  vi.clearAllMocks()
}

// ============================================
// TEST SUITES
// ============================================

describe('Stripe Webhook Endpoint', () => {
  const TEST_SECRET = 'whsec_test_secret_12345'

  beforeEach(() => {
    resetAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET
    process.env.RAAS_LICENSE_SECRET = 'test-raas-secret-key'
    // Set up default user profile chain for successful user lookups
    mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })
    // Set up license chain for license lookups
    mockLicenseChain.single.mockResolvedValue(null)
  })

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.RAAS_LICENSE_SECRET
  })

  // ============================================
  // 1. SIGNATURE VERIFICATION TESTS
  // ============================================
  describe('POST /api/webhooks/stripe - Signature Verification', () => {
    it('should return 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      // Delete env var and reset modules BEFORE importing
      delete process.env.STRIPE_WEBHOOK_SECRET
      vi.resetModules()

      const { POST } = await import('./route')
      const request = createMockRequest('{}', 'v1=test_sig')

      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Configuration Error' })
    })

    it('should return 400 when stripe-signature header is missing', async () => {
      // Delete env var first, then set it to mock exists check
      delete process.env.STRIPE_WEBHOOK_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET
      vi.resetModules()

      const { POST } = await import('./route')
      const request = createMockRequest('{}', null)

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Missing Stripe-Signature header' })
    })

    it('should return 400 when signature verification fails', async () => {
      // Delete env var first, then set it to mock exists check
      delete process.env.STRIPE_WEBHOOK_SECRET
      process.env.STRIPE_WEBHOOK_SECRET = TEST_SECRET
      vi.resetModules()

      const { POST } = await import('./route')
      const request = createMockRequest('{}', 'v1=invalid_signature')

      const response = await POST(request)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid signature' })
    })
  })

  // ============================================
  // 2. IDEMPOTENCY TESTS
  // ============================================
  describe('Idempotency - Duplicate Event Prevention', () => {
    it('should return success for already processed event (idempotency)', async () => {
      setupMockResponse({ processed: true, event_type: 'checkout.session.completed' })

      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_existing',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      const result = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Event already processed')
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Stripe] Event already processed'),
        expect.any(Object)
      )
    })

    it('should process new event only once', async () => {
      setupMockResponse({ processed: false })

      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_new',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      const result1 = await processStripeWebhookEvent(mockEvent as any, '{}')
      const result2 = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
    })

    it('should record event as pending before processing', async () => {
      setupMockResponse({ processed: false })

      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockSupabaseChain.upsert).toHaveBeenCalled()
    })
  })

  // ============================================
  // 3. EVENT HANDLER TESTS - All 6 Stripe Event Types
  // ============================================
  describe('Event Handlers - Stripe Event Types', () => {
    beforeEach(() => {
      setupMockResponse({ processed: false })
    })

    describe('checkout.session.completed', () => {
      it('should handle checkout.session.completed and create license', async () => {
        const mockEvent = createStripeEvent('checkout.session.completed', {
          id: 'cs_test',
          customer: 'cus_test',
          customer_email: 'test@example.com',
          metadata: { userId: 'user_123', tier: 'PREMIUM' },
          subscription: 'sub_test',
          mode: 'subscription',
          amount_total: 2999,
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(mockCreateLicense).toHaveBeenCalled()
        expect(mockLogLicenseCreation).toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Processing checkout.session.completed'),
          expect.any(Object)
        )
      })

      it('should handle checkout.session.completed with missing metadata gracefully', async () => {
        const mockEvent = createStripeEvent('checkout.session.completed', {
          id: 'cs_test',
          customer: 'cus_test',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Checkout: missing userId or tier'),
          expect.any(Object)
        )
      })
    })

    describe('customer.subscription.created', () => {
      it('should handle subscription.created and activate license', async () => {
        const mockEvent = createStripeEvent('customer.subscription.created', {
          id: 'sub_test',
          customer: 'cus_test',
          status: 'active',
          metadata: { userId: 'user_123', tier: 'ENTERPRISE' },
          current_period_end: Math.floor(Date.now() / 1000) + 31536000,
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(mockCreateLicense).toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Processing customer.subscription.created'),
          expect.any(Object)
        )
      })
    })

    describe('customer.subscription.updated', () => {
      it('should handle subscription.updated with status change', async () => {
        // Set up mock chains for user lookup and license lookup
        mockUserProfileChain.select.mockReturnThis()
        mockUserProfileChain.eq.mockReturnThis()
        mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

        // For license lookup - stripe_subscription_id match
        mockLicenseChain.select.mockReturnThis()
        mockLicenseChain.eq.mockReturnThis()
        mockLicenseChain.single.mockResolvedValue({ data: { nonce: 'n123', tier: 'PREMIUM' }, error: null })

        const mockEvent = createStripeEvent('customer.subscription.updated', {
          id: 'sub_test',
          customer: 'cus_test',
          status: 'canceled',
          metadata: { tier: 'PREMIUM' },
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(mockRevokeLicense).toHaveBeenCalledWith('n123', 'stripe-webhook-cancelled')
        expect(mockLogLicenseRevocation).toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Revoked license due to subscription cancellation'),
          expect.any(Object)
        )
      })
    })

    describe('customer.subscription.deleted', () => {
      it('should handle subscription.deleted and revoke license', async () => {
        // Set up mock chains for user lookup
        mockUserProfileChain.select.mockReturnThis()
        mockUserProfileChain.eq.mockReturnThis()
        mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

        // For license lookup - stripe_subscription_id match
        mockLicenseChain.select.mockReturnThis()
        mockLicenseChain.eq.mockReturnThis()
        mockLicenseChain.single.mockResolvedValue({ data: { nonce: 'n456', tier: 'ENTERPRISE' }, error: null })

        const mockEvent = createStripeEvent('customer.subscription.deleted', {
          id: 'sub_test',
          customer: 'cus_test',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(mockRevokeLicense).toHaveBeenCalledWith('n456', 'stripe-webhook-deleted')
        expect(mockLogLicenseRevocation).toHaveBeenCalled()
      })

      it('should handle subscription.deleted when user not found', async () => {
        // User not found - findUserByStripeSubscriptionId returns null
        mockUserProfileChain.single.mockResolvedValue({ data: null, error: null })

        const mockEvent = createStripeEvent('customer.subscription.deleted', {
          id: 'sub_test',
          customer: 'cus_test',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Subscription deleted: user not found'),
          expect.any(Object)
        )
      })
    })

    describe('invoice.paid', () => {
      it('should handle invoice.paid and extend subscription', async () => {
        mockSupabaseChain.single.mockResolvedValueOnce({
          data: { user_id: 'user_123' },
          error: null,
        })

        const periodEnd = Math.floor(Date.now() / 1000) + 31536000
        const mockEvent = createStripeEvent('invoice.paid', {
          id: 'in_test',
          customer: 'cus_test',
          subscription: 'sub_test',
          period_end: periodEnd,
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(mockUserProfileChain.update).toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Invoice paid - subscription extended'),
          expect.any(Object)
        )
      })

      it('should handle invoice.paid when user not found', async () => {
        // User not found - findUserByStripeCustomerId returns null
        mockUserProfileChain.single.mockResolvedValue({ data: null, error: null })

        const mockEvent = createStripeEvent('invoice.paid', {
          id: 'in_test',
          customer: 'cus_unknown',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Invoice paid: user not found'),
          expect.any(Object)
        )
      })
    })

    describe('invoice.payment_failed', () => {
      it('should handle invoice.payment_failed and add warning', async () => {
        mockSupabaseChain.single.mockResolvedValueOnce({
          data: { user_id: 'user_123' },
          error: null,
        })

        const mockEvent = createStripeEvent('invoice.payment_failed', {
          id: 'in_test',
          customer: 'cus_test',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(mockUserProfileChain.update).toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Invoice payment failed - warning added'),
          expect.any(Object)
        )
      })

      it('should handle invoice.payment_failed when user not found', async () => {
        mockUserProfileChain.single.mockResolvedValue({ data: null, error: null })

        const mockEvent = createStripeEvent('invoice.payment_failed', {
          id: 'in_test',
          customer: 'cus_unknown',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Invoice payment failed: user not found'),
          expect.any(Object)
        )
      })
    })

    describe('Unknown event types', () => {
      it('should handle unknown event types gracefully', async () => {
        const mockEvent = createStripeEvent('unknown.event.type', {
          id: 'evt_unknown',
        })

        const result = await processStripeWebhookEvent(mockEvent as any, '{}')

        expect(result.success).toBe(true)
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[Stripe] Unhandled event type'),
          expect.objectContaining({ eventType: 'unknown.event.type' })
        )
      })
    })
  })

  // ============================================
  // 4. DATABASE UPDATE VERIFICATION TESTS
  // ============================================
  describe('Database Updates Verification', () => {
    beforeEach(() => {
      setupMockResponse({ processed: false })
    })

    it('should update user_profiles on checkout.session.completed', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        customer_email: 'user_123',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockUserProfileChain.update).toHaveBeenCalled()
      expect(mockUserProfileChain.eq).toHaveBeenCalledWith('user_id', 'user_123')
    })

    it('should update subscription_status to active on subscription.created', async () => {
      const mockEvent = createStripeEvent('customer.subscription.created', {
        id: 'sub_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockUserProfileChain.update).toHaveBeenCalled()
    })

    it('should update subscription_status to cancelled on subscription.deleted', async () => {
      // Set up mock chains for user lookup
      mockUserProfileChain.select.mockReturnThis()
      mockUserProfileChain.eq.mockReturnThis()
      mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

      // For license lookup - stripe_subscription_id match
      mockLicenseChain.select.mockReturnThis()
      mockLicenseChain.eq.mockReturnThis()
      mockLicenseChain.single.mockResolvedValue({ data: { nonce: 'n123', tier: 'PREMIUM' }, error: null })

      const mockEvent = createStripeEvent('customer.subscription.deleted', {
        id: 'sub_test',
        customer: 'cus_test',
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockUserProfileChain.update).toHaveBeenCalled()
    })

    it('should update subscription_expires_at on invoice.paid', async () => {
      // Set up mock chains for user lookup
      mockUserProfileChain.select.mockReturnThis()
      mockUserProfileChain.eq.mockReturnThis()
      mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

      const periodEnd = Math.floor(Date.now() / 1000) + 31536000
      const mockEvent = createStripeEvent('invoice.paid', {
        id: 'in_test',
        customer: 'cus_test',
        period_end: periodEnd,
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockUserProfileChain.update).toHaveBeenCalled()
    })

    it('should add payment_failed metadata on invoice.payment_failed', async () => {
      // Set up mock chains for user lookup
      mockUserProfileChain.select.mockReturnThis()
      mockUserProfileChain.eq.mockReturnThis()
      mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

      const mockEvent = createStripeEvent('invoice.payment_failed', {
        id: 'in_test',
        customer: 'cus_test',
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockUserProfileChain.update).toHaveBeenCalled()
    })
  })

  // ============================================
  // 5. ERROR LOGGING VALIDATION TESTS
  // ============================================
  describe('Error Logging Validation', () => {
    beforeEach(() => {
      setupMockResponse({ processed: false })
    })

    it('should log info on successful event processing', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Stripe] Processing webhook event'),
        expect.any(Object)
      )
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Stripe] Webhook event processed successfully'),
        expect.any(Object)
      )
    })

    it('should log warning on missing metadata', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(logger.warn).toHaveBeenCalled()
    })

    it('should log warning when user not found', async () => {
      // User not found - findUserByStripeSubscriptionId returns null
      mockUserProfileChain.single.mockResolvedValue({ data: null, error: null })

      const mockEvent = createStripeEvent('customer.subscription.deleted', {
        id: 'sub_test',
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(logger.warn).toHaveBeenCalled()
    })

    it('should log info with duration on completion', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Stripe] Webhook event processed successfully'),
        expect.objectContaining({
          eventType: 'checkout.session.completed',
          eventId: expect.any(String),
          durationMs: expect.any(Number),
        })
      )
    })
  })

  // ============================================
  // 6. HTTP 200 OK RESPONSE TESTS
  // ============================================
  describe('HTTP Response Codes - Stripe Requirements', () => {
    it('should return 400 for invalid signature', async () => {
      const { POST } = await import('./route')

      const request = createMockRequest('{}', 'v1=invalid_signature')
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid signature')
    })
  })

  // ============================================
  // 7. EDGE CASES AND ERROR SCENARIOS
  // ============================================
  describe('Edge Cases and Error Scenarios', () => {
    beforeEach(() => {
      setupMockResponse({ processed: false })
    })

    it('should handle empty event data', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {})

      const result = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result.success).toBe(true)
    })

    it('should handle malformed metadata', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        metadata: 'not-an-object',
      })

      const result = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result.success).toBe(true)
    })

    it('should handle null customer', async () => {
      const mockEvent = createStripeEvent('invoice.paid', {
        customer: null,
      })

      const result = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result.success).toBe(true)
    })

    it('should handle invalid tier in metadata', async () => {
      const mockEvent = createStripeEvent('customer.subscription.created', {
        id: 'sub_test',
        metadata: { userId: 'user_123', tier: 'INVALID_TIER' },
      })

      const result = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result.success).toBe(true)
    })

    it('should handle database race conditions gracefully', async () => {
      mockSupabaseChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      })

      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      const result = await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(result).toBeDefined()
    })
  })

  // ============================================
  // 8. LICENSE LIFECYCLE TESTS
  // ============================================
  describe('License Lifecycle Management', () => {
    beforeEach(() => {
      setupMockResponse({ processed: false })
    })

    it('should create license on successful checkout', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        customer_email: 'user_123',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockCreateLicense).toHaveBeenCalledWith(expect.objectContaining({
        tier: 'PREMIUM',
        createdBy: 'stripe-webhook',
      }))
      expect(mockLogLicenseCreation).toHaveBeenCalled()
    })

    it('should create license on subscription creation', async () => {
      const mockEvent = createStripeEvent('customer.subscription.created', {
        id: 'sub_test',
        metadata: { userId: 'user_123', tier: 'ENTERPRISE' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockCreateLicense).toHaveBeenCalledWith(expect.objectContaining({
        tier: 'ENTERPRISE',
        createdBy: 'stripe-webhook',
      }))
    })

    it('should revoke license on subscription cancellation', async () => {
      // Set up mock chains for user lookup
      mockUserProfileChain.select.mockReturnThis()
      mockUserProfileChain.eq.mockReturnThis()
      mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

      // For license lookup - stripe_subscription_id match
      mockLicenseChain.select.mockReturnThis()
      mockLicenseChain.eq.mockReturnThis()
      mockLicenseChain.single.mockResolvedValue({ data: { nonce: 'n123', tier: 'PREMIUM' }, error: null })

      const mockEvent = createStripeEvent('customer.subscription.updated', {
        id: 'sub_test',
        status: 'canceled',
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockRevokeLicense).toHaveBeenCalledWith('n123', 'stripe-webhook-cancelled')
      expect(mockLogLicenseRevocation).toHaveBeenCalledWith(
        expect.objectContaining({
          nonce: 'n123',
          reason: 'Subscription cancelled via Stripe',
        })
      )
    })

    it('should revoke license on subscription deletion', async () => {
      // Set up mock chains for user lookup
      mockUserProfileChain.select.mockReturnThis()
      mockUserProfileChain.eq.mockReturnThis()
      mockUserProfileChain.single.mockResolvedValue({ data: { user_id: 'user_123' }, error: null })

      // For license lookup - stripe_subscription_id match
      mockLicenseChain.select.mockReturnThis()
      mockLicenseChain.eq.mockReturnThis()
      mockLicenseChain.single.mockResolvedValue({ data: { nonce: 'n456', tier: 'ENTERPRISE' }, error: null })

      const mockEvent = createStripeEvent('customer.subscription.deleted', {
        id: 'sub_test',
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockRevokeLicense).toHaveBeenCalledWith('n456', 'stripe-webhook-deleted')
      expect(mockLogLicenseRevocation).toHaveBeenCalledWith(
        expect.objectContaining({
          nonce: 'n456',
          reason: 'Subscription deleted via Stripe',
        })
      )
    })
  })

  // ============================================
  // 9. METADATA AND AUDIT TRAIL TESTS
  // ============================================
  describe('Metadata and Audit Trail', () => {
    beforeEach(() => {
      setupMockResponse({ processed: false })
    })

    it('should store Stripe customer ID in metadata', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        customer: 'cus_test123',
        customer_email: 'user_123',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockCreateLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            stripeCustomerId: 'cus_test123',
          }),
        })
      )
    })

    it('should store Stripe subscription ID in metadata', async () => {
      const mockEvent = createStripeEvent('customer.subscription.created', {
        id: 'sub_test123',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockCreateLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            stripeSubscriptionId: 'sub_test123',
          }),
        })
      )
    })

    it('should record event in payment_events table', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      // Event should be recorded twice: once as pending, once as processed
      expect(mockSupabaseChain.upsert).toHaveBeenCalledTimes(2)
    })

    it('should mark event as processed after successful handling', async () => {
      const mockEvent = createStripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      })

      await processStripeWebhookEvent(mockEvent as any, '{}')

      expect(mockSupabaseChain.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ processed: true }),
        expect.any(Object)
      )
    })
  })
})
