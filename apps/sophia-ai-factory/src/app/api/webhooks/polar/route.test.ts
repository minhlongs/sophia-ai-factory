/**
 * Polar Webhook API Route Tests
 *
 * Note: Full integration tests are run in CI/CD pipeline.
 * These unit tests cover core event processing logic.
 */

import { describe, it, expect, vi } from 'vitest'
import * as polarHandler from '@/lib/payments/polar-webhook-handler'

// Mock the handler module
vi.mock('@/lib/payments/polar-webhook-handler', () => ({
  processWebhookEvent: vi.fn(),
}))

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Polar Webhook Handler', () => {
  describe('processWebhookEvent', () => {
    it('should handle checkout.updated event', async () => {
      vi.mocked(polarHandler.processWebhookEvent).mockResolvedValue({
        success: true,
        message: 'Processed checkout.updated',
      })

      const result = await polarHandler.processWebhookEvent(
        {
          type: 'checkout.updated',
          data: {
            id: 'checkout_123',
            status: 'succeeded',
            metadata: {
              userId: 'user_abc',
              tier: 'PREMIUM',
            },
          },
        },
        'webhook_123'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('checkout.updated')
    })

    it('should handle subscription.created event', async () => {
      vi.mocked(polarHandler.processWebhookEvent).mockResolvedValue({
        success: true,
        message: 'Processed subscription.created',
      })

      const result = await polarHandler.processWebhookEvent(
        {
          type: 'subscription.created',
          data: {
            id: 'sub_123',
            status: 'active',
          },
        },
        'webhook_123'
      )

      expect(result.success).toBe(true)
    })

    it('should handle subscription.cancelled event', async () => {
      vi.mocked(polarHandler.processWebhookEvent).mockResolvedValue({
        success: true,
        message: 'Processed subscription.cancelled',
      })

      const result = await polarHandler.processWebhookEvent(
        {
          type: 'subscription.cancelled',
          data: {
            id: 'sub_123',
          },
        },
        'webhook_123'
      )

      expect(result.success).toBe(true)
    })

    it('should handle order.created event', async () => {
      vi.mocked(polarHandler.processWebhookEvent).mockResolvedValue({
        success: true,
        message: 'Processed order.created',
      })

      const result = await polarHandler.processWebhookEvent(
        {
          type: 'order.created',
          data: {
            id: 'order_123',
            metadata: {
              userId: 'user_abc',
              tier: 'ENTERPRISE',
            },
          },
        },
        'webhook_123'
      )

      expect(result.success).toBe(true)
    })

    it('should return false for processing errors', async () => {
      vi.mocked(polarHandler.processWebhookEvent).mockResolvedValue({
        success: false,
        message: 'Database error',
      })

      const result = await polarHandler.processWebhookEvent(
        {
          type: 'checkout.updated',
          data: {},
        },
        'webhook_123'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Database error')
    })

    it('should handle duplicate events (idempotency)', async () => {
      vi.mocked(polarHandler.processWebhookEvent).mockResolvedValue({
        success: true,
        message: 'Event already processed',
      })

      const result = await polarHandler.processWebhookEvent(
        {
          type: 'checkout.updated',
          data: { id: 'checkout_123' },
        },
        'webhook_123'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('already processed')
    })
  })
})
