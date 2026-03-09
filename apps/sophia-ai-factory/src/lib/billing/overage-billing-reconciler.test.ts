/**
 * Overage Billing Reconciler Tests
 *
 * Unit tests for overage billing reconciliation service
 */

import { describe, it, expect, vi } from 'vitest';
import {
  calculateOverageCharges,
} from './overage-billing-reconciler';
import {
  generateIdempotencyKey,
  PRICING_TIERS,
  mapOverageEventRow,
  type UnbilledEventsByUser,
} from './billing-types';

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        update: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

// Mock logger
vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Overage Billing Reconciler', () => {
  describe('PRICING_TIERS', () => {
    it('has correct pricing for BASIC tier', () => {
      expect(PRICING_TIERS.BASIC.pricePerCredit).toBe(0.1);
      expect(PRICING_TIERS.BASIC.currency).toBe('USD');
    });

    it('has correct pricing for PREMIUM tier', () => {
      expect(PRICING_TIERS.PREMIUM.pricePerCredit).toBe(0.05);
      expect(PRICING_TIERS.PREMIUM.currency).toBe('USD');
    });

    it('has correct pricing for ENTERPRISE tier', () => {
      expect(PRICING_TIERS.ENTERPRISE.pricePerCredit).toBe(0.03);
      expect(PRICING_TIERS.ENTERPRISE.currency).toBe('USD');
    });

    it('has correct pricing for MASTER tier', () => {
      expect(PRICING_TIERS.MASTER.pricePerCredit).toBe(0.02);
      expect(PRICING_TIERS.MASTER.currency).toBe('USD');
    });
  });

  describe('calculateOverageCharges', () => {
    const createMockUserEvents = (
      tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER',
      overageCredits: number,
      eventCount: number = 1
    ): UnbilledEventsByUser => ({
      userId: 'test-user-123',
      licenseNonce: 'test-nonce-abc',
      tier,
      externalCustomerId: 'cus_test123',
      events: Array.from({ length: eventCount }, (_, i) => ({
        id: `event-${i}`,
        userId: 'test-user-123',
        licenseNonce: 'test-nonce-abc',
        exceededType: 'daily_credits' as const,
        exceededLimit: 100,
        exceededCurrent: 100 + Math.floor(overageCredits / eventCount),
        exceededBy: Math.floor(overageCredits / eventCount),
        requestedCredits: 1,
        tierAtExceeded: tier,
        billable: false,
        createdAt: Date.now(),
      })),
      totalOverageCredits: overageCredits,
      periodStart: Date.now() - 3600000,
      periodEnd: Date.now(),
    });

    it('calculates BASIC tier charges correctly', () => {
      const userEvents = createMockUserEvents('BASIC', 50);
      const charge = calculateOverageCharges(userEvents);

      expect(charge.userId).toBe('test-user-123');
      expect(charge.tier).toBe('BASIC');
      expect(charge.overageCredits).toBe(50);
      expect(charge.pricePerCredit).toBe(0.1);
      expect(charge.totalCharge).toBe(5.0); // 50 * 0.1
      expect(charge.currency).toBe('USD');
    });

    it('calculates PREMIUM tier charges correctly', () => {
      const userEvents = createMockUserEvents('PREMIUM', 100);
      const charge = calculateOverageCharges(userEvents);

      expect(charge.tier).toBe('PREMIUM');
      expect(charge.overageCredits).toBe(100);
      expect(charge.pricePerCredit).toBe(0.05);
      expect(charge.totalCharge).toBe(5.0); // 100 * 0.05
    });

    it('calculates ENTERPRISE tier charges correctly', () => {
      const userEvents = createMockUserEvents('ENTERPRISE', 200);
      const charge = calculateOverageCharges(userEvents);

      expect(charge.tier).toBe('ENTERPRISE');
      expect(charge.overageCredits).toBe(200);
      expect(charge.pricePerCredit).toBe(0.03);
      expect(charge.totalCharge).toBe(6.0); // 200 * 0.03
    });

    it('calculates MASTER tier charges correctly', () => {
      const userEvents = createMockUserEvents('MASTER', 500);
      const charge = calculateOverageCharges(userEvents);

      expect(charge.tier).toBe('MASTER');
      expect(charge.overageCredits).toBe(500);
      expect(charge.pricePerCredit).toBe(0.02);
      expect(charge.totalCharge).toBe(10.0); // 500 * 0.02
    });

    it('includes externalCustomerId in charge', () => {
      const userEvents = createMockUserEvents('BASIC', 10);
      const charge = calculateOverageCharges(userEvents);

      expect(charge.externalCustomerId).toBe('cus_test123');
    });

    it('handles multiple events correctly', () => {
      const userEvents = createMockUserEvents('BASIC', 30, 3); // 3 events, 30 credits total

      expect(userEvents.events.length).toBe(3);
      expect(userEvents.totalOverageCredits).toBe(30);

      const charge = calculateOverageCharges(userEvents);

      expect(charge.eventCount).toBe(3);
      expect(charge.overageCredits).toBe(30);
      expect(charge.totalCharge).toBe(3.0);
    });

    it('throws error for unknown tier', () => {
      const invalidEvents = {
        ...createMockUserEvents('BASIC', 10),
        tier: 'INVALID' as any,
      };

      expect(() => calculateOverageCharges(invalidEvents)).toThrow('Unknown tier: INVALID');
    });
  });

  describe('generateIdempotencyKey', () => {
    it('generates unique key from license nonce and period', () => {
      const periodStart = 1709856000; // 2024-03-08 00:00:00
      const periodEnd = 1709942400; // 2024-03-09 00:00:00

      const key1 = generateIdempotencyKey('nonce-abc', periodStart, periodEnd);
      const key2 = generateIdempotencyKey('nonce-abc', periodStart, periodEnd);
      const key3 = generateIdempotencyKey('nonce-xyz', periodStart, periodEnd);

      expect(key1).toBe(key2); // Same inputs = same key
      expect(key1).not.toBe(key3); // Different nonce = different key
      expect(key1).toBe('overage-nonce-abc-1709856000-1709942400');
    });
  });

  describe('mapOverageEventRow', () => {
    it('maps database row to OverageEvent', () => {
      const row = {
        id: 'event-123',
        user_id: 'user-456',
        license_nonce: 'nonce-abc',
        exceeded_type: 'daily_credits',
        exceeded_limit: 100,
        exceeded_current: 120,
        exceeded_by: 20,
        requested_credits: 5,
        endpoint: '/api/v1/generate',
        service_name: 'heygen',
        action: 'createVideo',
        tier_at_exceeded: 'PREMIUM',
        external_customer_id: 'cus_test123',
        billable: false,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        created_at: 1709856000,
      };

      const event = mapOverageEventRow(row as any);

      expect(event.id).toBe('event-123');
      expect(event.userId).toBe('user-456');
      expect(event.licenseNonce).toBe('nonce-abc');
      expect(event.exceededType).toBe('daily_credits');
      expect(event.exceededLimit).toBe(100);
      expect(event.exceededCurrent).toBe(120);
      expect(event.exceededBy).toBe(20);
      expect(event.requestedCredits).toBe(5);
      expect(event.endpoint).toBe('/api/v1/generate');
      expect(event.serviceName).toBe('heygen');
      expect(event.action).toBe('createVideo');
      expect(event.tierAtExceeded).toBe('PREMIUM');
      expect(event.externalCustomerId).toBe('cus_test123');
      expect(event.billable).toBe(false);
      expect(event.ipAddress).toBe('192.168.1.1');
      expect(event.userAgent).toBe('Mozilla/5.0');
      expect(event.createdAt).toBe(1709856000);
    });

    it('handles null optional fields', () => {
      const row = {
        id: 'event-123',
        user_id: 'user-456',
        license_nonce: 'nonce-abc',
        exceeded_type: 'hourly_credits',
        exceeded_limit: 20,
        exceeded_current: 25,
        exceeded_by: 5,
        requested_credits: 1,
        endpoint: null,
        service_name: null,
        action: null,
        tier_at_exceeded: 'BASIC',
        external_customer_id: null,
        billable: false,
        ip_address: null,
        user_agent: null,
        created_at: 1709856000,
      };

      const event = mapOverageEventRow(row as any);

      expect(event.endpoint).toBeUndefined();
      expect(event.serviceName).toBeUndefined();
      expect(event.action).toBeUndefined();
      expect(event.externalCustomerId).toBeUndefined();
      expect(event.ipAddress).toBeUndefined();
      expect(event.userAgent).toBeUndefined();
    });
  });
});
