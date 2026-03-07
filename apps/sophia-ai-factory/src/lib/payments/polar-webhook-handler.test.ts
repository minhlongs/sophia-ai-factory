import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processWebhookEvent } from './polar-webhook-handler';
import type { PolarWebhookEvent } from './polar-types';

// Mock crypto module for testing
vi.mock('crypto', () => {
  return {
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
  };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    })),
  })),
}));

vi.mock('./polar-subscription-service', () => ({
  activateSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  findUserByPolarSubId: vi.fn(),
}));

vi.mock('@/lib/services/notification-service', () => ({
  notifySubscriptionActivated: vi.fn(),
  notifySubscriptionCancelled: vi.fn(),
}));

vi.mock('@/lib/raas-key-generator', () => ({
  generateLicenseKey: vi.fn(() => 'raas_basic_1234567890_abcdef_nonce123'),
}));

vi.mock('@/lib/raas-audit', () => ({
  createLicense: vi.fn().mockResolvedValue({}),
  logLicenseCreation: vi.fn(),
  revokeLicense: vi.fn(),
  logLicenseRevocation: vi.fn(),
}));

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { activateSubscription, cancelSubscription, findUserByPolarSubId } from './polar-subscription-service';
import { notifySubscriptionActivated } from '@/lib/services/notification-service';
import { createLicense, revokeLicense } from '@/lib/raas-audit';
import { logger } from '@/lib/utils/logger-utility';
import { createAdminClient } from '@/lib/supabase/admin';

describe('polar-webhook-handler', () => {
  const webhookId = 'wh_123';
  const userId = 'user_abc';
  const subId = 'sub_xyz';
  const chatId = 'tg_789';

  const getMockChain = (table?: string) => {
    // Return user data for user_profiles table queries, null for others
    const userData = table === 'user_profiles' ? { user_id: userId } : null;
    const licenseData = table === 'raas_licenses' ? { nonce: 'n123', tier: 'PREMIUM' } : null;

    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: table === 'payment_events' ? null : (userData || licenseData),
        error: null
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAAS_LICENSE_SECRET = 'test-secret';
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => getMockChain(table))
    } as any);
    // Default: user lookup returns valid user ID
    vi.mocked(findUserByPolarSubId).mockResolvedValue(userId);
  });

  const createEvent = (type: PolarWebhookEvent['type'], data: Record<string, unknown>): PolarWebhookEvent => ({
    type,
    data,
  });

  const metadata = (overrides?: Record<string, unknown>) => ({
    userId,
    tier: 'PREMIUM',
    telegram_chat_id: chatId,
    ...overrides,
  });

  describe('Idempotency', () => {
    it('skips processed events', async () => {
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { processed: true }, error: null }),
          upsert: vi.fn(),
          update: vi.fn().mockReturnThis(),
        })),
      } as any);

      const result = await processWebhookEvent(createEvent('checkout.updated', {
        id: subId,
        status: 'succeeded',
        metadata: metadata(),
      }), webhookId);

      expect(result.message).toBe('Event already processed');
      expect(activateSubscription).not.toHaveBeenCalled();
    });

    it('processes new events', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: mockUpsert,
          update: vi.fn().mockReturnThis(),
        })),
      } as any);

      await processWebhookEvent(createEvent('checkout.updated', {
        id: subId,
        status: 'succeeded',
        metadata: metadata(),
      }), webhookId);

      expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ processed: true }), expect.any(Object));
    });
  });

  describe('checkout.updated', () => {
    it('handles successful checkout', async () => {
      await processWebhookEvent(createEvent('checkout.updated', {
        id: subId,
        status: 'succeeded',
        metadata: metadata(),
        customer: { email: 'test@example.com' },
      }), webhookId);

      expect(createLicense).toHaveBeenCalled();
      expect(notifySubscriptionActivated).toHaveBeenCalledWith(chatId, 'PREMIUM');
    });

    it('skips non-succeeded status', async () => {
      await processWebhookEvent(createEvent('checkout.updated', {
        id: subId,
        status: 'pending',
        metadata: metadata(),
      }), webhookId);

      expect(createLicense).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    });

    it('handles missing userId', async () => {
      const result = await processWebhookEvent(createEvent('checkout.updated', {
        id: subId,
        status: 'succeeded',
        metadata: metadata({ userId: null }),
      }), webhookId);

      expect(result.success).toBe(true);
      expect(createLicense).not.toHaveBeenCalled();
    });
  });

  describe('subscription.created', () => {
    it('activates subscription and generates license', async () => {
      await processWebhookEvent(createEvent('subscription.created', {
        id: subId,
        status: 'active',
        metadata: metadata(),
        current_period_end: '2027-01-01T00:00:00Z',
      }), webhookId);

      expect(activateSubscription).toHaveBeenCalledWith(userId, subId, 'PREMIUM', '2027-01-01T00:00:00Z', null);
      expect(createLicense).toHaveBeenCalled();
    });

    it('uses default tier PREMIUM', async () => {
      await processWebhookEvent(createEvent('subscription.created', {
        id: subId,
        status: 'active',
        metadata: metadata({ tier: undefined }),
      }), webhookId);

      expect(activateSubscription).toHaveBeenCalledWith(userId, subId, 'PREMIUM', null, null);
    });
  });

  describe('subscription.cancelled', () => {
    it('cancels subscription and revokes license', async () => {
      vi.mocked(findUserByPolarSubId).mockResolvedValue(userId);
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'raas_licenses') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { nonce: 'n123', tier: 'PREMIUM' }, error: null }),
            };
          }
          return getMockChain();
        }),
      } as any);

      const result = await processWebhookEvent(createEvent('subscription.cancelled', {
        id: subId,
        current_period_end: '2026-04-01T00:00:00Z',
      }), webhookId);

      expect(result.success).toBe(true);
      expect(cancelSubscription).toHaveBeenCalledWith(subId);
      expect(revokeLicense).toHaveBeenCalledWith('n123', 'polar-webhook-cancelled');
    });
  });

  describe('subscription.updated', () => {
    it('handles cancellation', async () => {
      vi.mocked(findUserByPolarSubId).mockResolvedValue(userId);

      await processWebhookEvent(createEvent('subscription.updated', {
        id: subId,
        status: 'canceled',
        metadata: metadata(),
      }), webhookId);

      expect(cancelSubscription).toHaveBeenCalledWith(subId);
    });
  });

  describe('order.created', () => {
    it('handles one-time order', async () => {
      await processWebhookEvent(createEvent('order.created', {
        id: subId,
        metadata: metadata(),
      }), webhookId);

      expect(createLicense).toHaveBeenCalled();
    });

    it('handles missing metadata', async () => {
      const result = await processWebhookEvent(createEvent('order.created', {
        id: subId,
        metadata: {},
      }), webhookId);

      expect(result.success).toBe(true);
      expect(createLicense).not.toHaveBeenCalled();
    });
  });

  describe('License expiration', () => {
    it('sets perpetual license for MASTER tier', async () => {
      await processWebhookEvent(createEvent('order.created', {
        id: subId,
        metadata: metadata({ tier: 'MASTER' }),
      }), webhookId);

      expect(createLicense).toHaveBeenCalledWith(expect.objectContaining({
        tier: 'MASTER',
        expiresAt: 0,
      }));
    });
  });

  describe('Error handling', () => {
    it('handles DB errors', async () => {
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
          }),
        })),
      } as any);

      const result = await processWebhookEvent(createEvent('checkout.updated', {
        id: subId,
        status: 'succeeded',
        metadata: metadata(),
      }), webhookId);

      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Unknown events', () => {
    it('logs warning for unhandled types', async () => {
      const result = await processWebhookEvent(createEvent('checkout.created', {
        id: subId,
        metadata: metadata(),
      }), webhookId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('Unhandled webhook event type', expect.any(Object));
    });
  });
});
